"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AgCharts } from "ag-charts-react";
import {
  AnimationModule,
  CandlestickSeriesModule,
  ContextMenuModule,
  CrosshairModule,
  LegendModule,
  ModuleRegistry,
  NumberAxisModule,
  OrdinalTimeAxisModule,
} from "ag-charts-enterprise";

ModuleRegistry.registerModules([
  AnimationModule,
  CandlestickSeriesModule,
  CrosshairModule,
  LegendModule,
  NumberAxisModule,
  OrdinalTimeAxisModule,
  ContextMenuModule,
]);

type BarResponseItem = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type RetrieveBarsResponse = {
  success: boolean;
  bars?: BarResponseItem[];
  latestClosedBarTime?: string | null;
  error?: string;
};

type ChartRow = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

const CONTRACTS = [
  { label: "MNQ", value: "CON.F.US.MNQ.H26" },
  { label: "NQ", value: "CON.F.US.NQ.H26" },
  { label: "MES", value: "CON.F.US.MES.H26" },
  { label: "ES", value: "CON.F.US.ES.H26" },
];

export default function StockChartPage() {
  const [contractId, setContractId] = useState("CON.F.US.MNQ.H26");
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [latestClosedBarTime, setLatestClosedBarTime] = useState<string | null>(
    null,
  );

  async function loadBars() {
    try {
      setLoading(true);
      setError(null);

      const end = new Date();
      const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);

      const resp = await fetch("/api/history/retrieve-bars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId,
          live,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          unit: 2,
          unitNumber: 1,
          limit: 500,
          includePartialBar: false,
        }),
      });

      const data = (await resp.json()) as RetrieveBarsResponse;

      if (!resp.ok || !data.success) {
        throw new Error(
          data.error || `Request failed with status ${resp.status}`,
        );
      }

      const nextRows: ChartRow[] = (data.bars || []).map((bar) => ({
        date: new Date(bar.time),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: bar.volume,
      }));

      setRows(nextRows);
      setLatestClosedBarTime(data.latestClosedBarTime ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBars();
  }, [contractId, live]);

  const selectedLabel =
    CONTRACTS.find((item) => item.value === contractId)?.label ?? contractId;

  const options = useMemo(() => {
    return {
      data: rows,
      background: {
        fill: "#0b1220",
      },
      title: {
        text: `${selectedLabel} Candlestick Chart`,
        color: "#e5eefc",
      },
      subtitle: {
        text: live ? "Live data mode" : "Historical data mode",
        color: "#9fb3c8",
      },
      footnote: {
        text: latestClosedBarTime
          ? `Latest closed bar: ${new Date(latestClosedBarTime).toLocaleString()}`
          : "No bar data loaded",
        color: "#7f93ad",
      },
      legend: {
        enabled: true,
        position: "bottom",
      },
      axes: [
        {
          type: "ordinal-time",
          position: "bottom",
          label: {
            color: "#c9d7e8",
          },
        },
        {
          type: "number",
          position: "left",
          label: {
            color: "#c9d7e8",
          },
        },
      ],
      series: [
        {
          type: "candlestick",
          xKey: "date",
          xName: "Time",
          lowKey: "low",
          highKey: "high",
          openKey: "open",
          closeKey: "close",
        },
      ],
    };
  }, [rows, selectedLabel, live, latestClosedBarTime]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              TopstepX Market Data Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Load candlestick bars from your Next.js API and display them with
              AG Charts.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-300">Contract</label>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
              >
                {CONTRACTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
              <input
                id="live-mode"
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
              />
              <label htmlFor="live-mode" className="text-sm text-slate-300">
                Live mode
              </label>
            </div>

            <button
              type="button"
              onClick={() => void loadBars()}
              disabled={loading}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            Error: {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
          <div className="h-[620px] w-full overflow-hidden rounded-xl bg-slate-950 p-2">
            <AgCharts options={options} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">Bars Loaded</div>
            <div className="mt-2 text-2xl font-semibold">{rows.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">Contract</div>
            <div className="mt-2 text-2xl font-semibold">{selectedLabel}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">Mode</div>
            <div className="mt-2 text-2xl font-semibold">
              {live ? "Live" : "Historical"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
