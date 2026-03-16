// lib/market_data_api.ts

const BASE_URL = "https://api.topstepx.com";
const RETRIEVE_BARS_URL = `${BASE_URL}/api/History/retrieveBars`;

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiAuthError";
  }
}

export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface RawBar {
  t?: string;
  o?: number | string;
  h?: number | string;
  l?: number | string;
  c?: number | string;
  v?: number | string;
}

export interface Bar {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface FetchBarsParams {
  requestOrigin: string;
  contractId: string;
  live: boolean;
  startTime: Date;
  endTime: Date;
  unit?: number;
  unitNumber?: number;
  limit?: number;
  includePartialBar?: boolean;
}

interface InternalAuthResponse {
  success?: boolean;
  data?: {
    token?: string;
    success?: boolean;
    errorCode?: number;
    errorMessage?: string | null;
  };
}

function baseHeaders(): HeadersInit {
  return {
    accept: "text/plain",
    "Content-Type": "application/json",
  };
}

function authHeaders(token: string): HeadersInit {
  return {
    ...baseHeaders(),
    Authorization: `Bearer ${token}`,
  };
}

function toIsoZ(dt: Date): string {
  return new Date(dt).toISOString();
}

async function getTokenFromInternalAuth(
  requestOrigin: string,
): Promise<string> {
  const url = `${requestOrigin}/api/auth`;

  const resp = await fetch(url, {
    method: "POST",
    cache: "no-store",
  });

  const text = await resp.text();

  if (!resp.ok) {
    throw new ApiAuthError(
      `Auth route HTTP ${resp.status}. URL=${url} RESPONSE=${text.slice(0, 1000)}`,
    );
  }

  let data: InternalAuthResponse;
  try {
    data = JSON.parse(text) as InternalAuthResponse;
  } catch {
    throw new ApiAuthError(
      `Auth route returned non-JSON response: ${text.slice(0, 1000)}`,
    );
  }

  const token = data?.data?.token;

  if (!data?.success || !token) {
    throw new ApiAuthError(
      `Auth route did not return a valid token: ${JSON.stringify(data)}`,
    );
  }

  return token;
}

async function postJson(
  url: string,
  token: string,
  payload: Record<string, unknown>,
  timeout = 30000,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await resp.text();

    console.log("[TopstepX] URL =", url);
    console.log("[TopstepX] STATUS =", resp.status);
    console.log("[TopstepX] RESPONSE =", text);

    if (resp.status === 401) {
      throw new ApiAuthError(
        `401 Unauthorized. URL=${url} STATUS=${resp.status} RESPONSE=${text.slice(0, 1000)}`,
      );
    }

    if (!resp.ok) {
      throw new ApiRequestError(
        `HTTP ${resp.status}. URL=${url} RESPONSE=${text.slice(0, 1000)}`,
      );
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiRequestError(
        `Non-JSON response from ${url}: ${text.slice(0, 1000)}`,
      );
    }

    if (!data?.success) {
      throw new ApiRequestError(
        `API returned success=false: ${JSON.stringify(data)}`,
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBars(rawBars: RawBar[]): Bar[] {
  const seen = new Map<string, Bar>();

  for (const item of rawBars) {
    const timeStr = item.t;
    if (!timeStr) continue;

    const time = new Date(timeStr);
    if (Number.isNaN(time.getTime())) continue;

    const open = Number(item.o);
    const high = Number(item.h);
    const low = Number(item.l);
    const close = Number(item.c);

    const volume =
      item.v === undefined || item.v === null || item.v === ""
        ? null
        : Number(item.v);

    if (
      Number.isNaN(open) ||
      Number.isNaN(high) ||
      Number.isNaN(low) ||
      Number.isNaN(close)
    ) {
      continue;
    }

    seen.set(time.toISOString(), {
      time,
      open,
      high,
      low,
      close,
      volume: volume !== null && Number.isNaN(volume) ? null : volume,
    });
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  );
}

/**
 * fetchBars:
 * 1. call internal /api/auth
 * 2. get token from response.data.token
 * 3. call TopstepX retrieveBars
 */
export async function fetchBars(params: FetchBarsParams): Promise<Bar[]> {
  const {
    requestOrigin,
    contractId,
    live,
    startTime,
    endTime,
    unit = 2,
    unitNumber = 1,
    limit = 1000,
    includePartialBar = false,
  } = params;

  const token = await getTokenFromInternalAuth(requestOrigin);

  const payload = {
    contractId,
    live,
    startTime: toIsoZ(startTime),
    endTime: toIsoZ(endTime),
    unit,
    unitNumber,
    limit,
    includePartialBar,
  };

  console.log("[retrieveBars] payload =", payload);

  const data = await postJson(RETRIEVE_BARS_URL, token, payload, 30000);
  const bars: RawBar[] = Array.isArray(data?.bars) ? data.bars : [];

  if (!bars.length) {
    return [];
  }

  return normalizeBars(bars);
}

export function appendOnlyNewBars(oldBars: Bar[], newBars: Bar[]): Bar[] {
  if (!oldBars?.length) return [...newBars];
  if (!newBars?.length) return [...oldBars];

  const lastTime = oldBars[oldBars.length - 1].time.getTime();
  const addBars = newBars.filter((bar) => bar.time.getTime() > lastTime);

  if (!addBars.length) {
    return [...oldBars];
  }

  const merged = [...oldBars, ...addBars];
  const seen = new Map<string, Bar>();

  for (const bar of merged) {
    seen.set(bar.time.toISOString(), bar);
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  );
}

export function latestClosedBarTime(bars: Bar[]): Date | null {
  if (!bars?.length) return null;
  return bars[bars.length - 1].time;
}
