import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError } from "../lib/api";
import { formatDate, formatNok, formatPct100 } from "../lib/format";
import type { DailyValue, PortfolioPerformance } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";

/** Sprint 13 — daily portfolio value history and a benchmark comparison,
 * from GET /performance/portfolio (backend/app/services/performance/).
 * APPROXIMATION, shown as a banner rather than buried: this reindexes
 * today's positions backward through price/FX history — it is not a real
 * past-transaction P&L, since only point-in-time portfolio snapshots are
 * stored (see the backend module's docstring). */

const LOOKBACK_OPTIONS: { label: string; days: number }[] = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
  { label: "2y", days: 730 },
];

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p
        className={`tabular mt-1 text-lg font-semibold ${
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function toneFor(pct: string | null): "positive" | "negative" | undefined {
  if (pct === null) return undefined;
  return Number(pct) >= 0 ? "positive" : "negative";
}

function PerformanceChart({ series, benchmarkTicker, benchmarkAvailable }: {
  series: DailyValue[];
  benchmarkTicker: string;
  benchmarkAvailable: boolean;
}) {
  const points = series
    .filter((d) => d.portfolio_return_pct !== null)
    .map((d) => ({
      on: d.on,
      portfolio: Number(d.portfolio_return_pct),
      benchmark: d.benchmark_return_pct !== null ? Number(d.benchmark_return_pct) : null,
    }));

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">Not enough overlapping price history yet to chart a return series.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgb(var(--c-border-subtle))" vertical={false} />
          <XAxis
            dataKey="on"
            tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
            axisLine={{ stroke: "rgb(var(--c-border))" }}
            tickLine={false}
            tickFormatter={(v: string) => formatDate(v)}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip
            formatter={(value: number) => `${value.toFixed(2)}%`}
            labelFormatter={(v: string) => formatDate(v)}
            cursor={{ stroke: "rgb(var(--c-border))" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid rgb(var(--c-border))",
              background: "rgb(var(--c-raised))",
              color: "rgb(var(--c-ink))",
              boxShadow: "0 8px 24px -12px rgba(0,0,0,0.6)",
            }}
            labelStyle={{ color: "rgb(var(--c-ink-muted))" }}
            itemStyle={{ color: "rgb(var(--c-ink))" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="portfolio"
            name="Portfolio"
            stroke="rgb(var(--c-accent))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {benchmarkAvailable && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmarkTicker}
              stroke="rgb(var(--c-ink-faint))"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PerformancePage() {
  const [lookbackDays, setLookbackDays] = useState(365);
  const [perf, setPerf] = useState<PortfolioPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (days: number) => {
    setPerf(null);
    api
      .getPortfolioPerformance({ lookbackDays: days })
      .then(setPerf)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load portfolio performance."));
  };

  useEffect(() => load(lookbackDays), [lookbackDays]);

  const onRefresh = () => {
    setRefreshing(true);
    api
      .refreshPortfolioPerformance({ lookbackDays })
      .then(setPerf)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Refresh failed."))
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Performance"
        subtitle="Daily portfolio value and a benchmark comparison, reindexed from today's positions."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-border-subtle text-xs">
              {LOOKBACK_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setLookbackDays(opt.days)}
                  className={`px-2.5 py-1.5 font-medium ${
                    lookbackDays === opt.days ? "bg-accent text-onfill" : "text-ink-muted hover:bg-raised"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh price data"}
            </Button>
          </div>
        }
      />

      {error && <p className="text-sm text-negative">{error}</p>}
      {!perf && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {perf && perf.series.length === 0 && (
        <EmptyState>
          {perf.excluded.length > 0
            ? "No holding has enough daily price history yet to chart performance."
            : "No portfolio imported yet. Upload a broker export on the "}
          {perf.excluded.length === 0 && (
            <>
              <Link to="/portfolio" className="text-accent hover:text-accent-hover">
                Portfolio
              </Link>{" "}
              page first.
            </>
          )}
        </EmptyState>
      )}

      {perf && perf.series.length > 0 && (
        <div className="space-y-6">
          <p className="rounded-lg border border-border-subtle bg-raised px-3 py-2 text-xs text-ink-faint">
            {perf.method_note}
          </p>

          <Card>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile
                label="Total return"
                value={perf.total_return_pct !== null ? formatPct100(perf.total_return_pct, 2) : "—"}
                tone={toneFor(perf.total_return_pct)}
                hint={perf.full_coverage_from ? `since ${formatDate(perf.full_coverage_from)}` : undefined}
              />
              <StatTile label="Portfolio value" value={perf.ending_value_nok ? formatNok(perf.ending_value_nok) : "—"} />
              <StatTile
                label="Best day"
                value={perf.best_day ? formatNok(perf.best_day.daily_pnl_nok) : "—"}
                tone={perf.best_day ? "positive" : undefined}
                hint={perf.best_day ? formatDate(perf.best_day.on) : undefined}
              />
              <StatTile
                label="Worst day"
                value={perf.worst_day ? formatNok(perf.worst_day.daily_pnl_nok) : "—"}
                tone={perf.worst_day ? "negative" : undefined}
                hint={perf.worst_day ? formatDate(perf.worst_day.on) : undefined}
              />
            </div>
            <SectionTitle
              hint={
                perf.benchmark_available
                  ? `vs. ${perf.benchmark_ticker}`
                  : perf.benchmark_reason ?? "Benchmark unavailable"
              }
            >
              Cumulative return
            </SectionTitle>
            <PerformanceChart
              series={perf.series}
              benchmarkTicker={perf.benchmark_ticker}
              benchmarkAvailable={perf.benchmark_available}
            />
          </Card>

          <Card>
            <SectionTitle>Coverage</SectionTitle>
            <p className="text-sm text-ink-muted">
              {formatNok(perf.included_value_nok)} of {formatNok(perf.equity_value_nok)} equity value has usable daily
              price history{perf.covered_pct !== null && ` (${formatPct100(perf.covered_pct, 1)})`}.
            </p>
            {perf.excluded.length > 0 && (
              <p className="mt-2 text-xs text-ink-faint">
                Excluded: {perf.excluded.map((e) => `${e.name} (${e.reason})`).join("; ")}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
