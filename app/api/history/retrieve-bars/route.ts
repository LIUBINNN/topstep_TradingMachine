import { NextRequest, NextResponse } from "next/server";
import {
  ApiAuthError,
  ApiRequestError,
  fetchBars,
  latestClosedBarTime,
} from "@/lib/market_data_api";

interface RetrieveBarsRequestBody {
  contractId: string;
  live?: boolean;
  startTime: string;
  endTime: string;
  unit?: number;
  unitNumber?: number;
  limit?: number;
  includePartialBar?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    let body: RetrieveBarsRequestBody;

    try {
      body = (await req.json()) as RetrieveBarsRequestBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const {
      contractId = "CON.F.US.MNQ.H26",
      live = false,
      startTime = "2024-12-01T00:00:00Z",
      endTime = "2024-12-31T21:00:00Z",
      unit = 2,
      unitNumber = 1,
      limit = 1000,
      includePartialBar = false,
    } = body;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Missing contractId" },
        { status: 400 },
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: "Missing startTime or endTime" },
        { status: 400 },
      );
    }

    const bars = await fetchBars({
      requestOrigin: req.nextUrl.origin,
      contractId,
      live: Boolean(live),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      unit: Number(unit),
      unitNumber: Number(unitNumber),
      limit: Number(limit),
      includePartialBar: Boolean(includePartialBar),
    });

    return NextResponse.json({
      success: true,
      bars: bars.map((bar) => ({
        time: bar.time.toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
      latestClosedBarTime: latestClosedBarTime(bars)?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }

    if (error instanceof ApiRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const msg = error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
