import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatPercent } from "../lib/format";
import type { DCFScenario, HoldingValuation, PeriodMultiples } from "../lib/types";
import { MULTIPLE_LABELS, MULTIPLE_ORDER } from "../lib/types";
import { Button, Card, EmptyState } from "./ui";

/** Valuation panel for HoldingDetailPage (Sprint 3 — Brain Step 4:
 * "Valuation & Margin of Safety"). Mirrors ResearchPanel's
 * load/refresh/error shape (see backend/app/api/valuation.py, which
 * itself mirrors app/api/research.py). Every figure here is deterministic
 * application code (app/services/valuation/*), never an LLM guess —
 * CLAUDE.md Rule 1 — this panel only renders numbers the backend already
 * computed. */

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function ScenarioCard({ scenario, currency }: { scenario: DCFScenario; currency: string | null }) {
  const mos = scenario.margin_of_safety;
  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{scenario.label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-ink">
        {formatDecimal(scenario.intrinsic_value_per_share)}
        {currency && <span className="ml-1 text-xs font-normal text-ink-faint">{currency}</span>}
      </p>
      <p className="mt-1 text-xs text-ink-muted">Growth {formatPercent(scenario.growth_rate)}</p>
      <p
        className={`mt-1 text-xs font-medium ${
          mos === null ? "text-ink-faint" : Number(mos) >= 0 ? "text-positive" : "text-negative"
        }`}
      >
        {mos === null ? "Margin of safety unavailable" : `Margin of safety ${formatPercent(mos)}`}
      </p>
    </div>
  );
}

/** One small-multiple line chart per metric — never combined onto shared
 * axes, since P/E, P/B, P/S, and EV/EBITDA all sit on different scales. */
function MultiplesChart({
  metricKey,
  label,
  series,
}: {
  metricKey: string;
  label: string;
  series: PeriodMultiples[];
}) {
  const points = series
    .filter((p) => p.computed[metricKey] !== undefined)
    .map((p) => ({ period: p.period, value: Number(p.computed[metricKey]) }));

  if (points.length === 0) {
    const reason = series.find((p) => p.skipped[metricKey])?.skipped[metricKey];
    return (
      <div className="rounded-lg border border-border-subtle p-3">
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</h5>
        <p className="text-xs text-ink-faint">{reason ?? "Not available for any period yet."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</h5>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgb(var(--c-border-subtle))" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
              axisLine={{ stroke: "rgb(var(--c-border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              formatter={(value: number) => value.toFixed(2)}
              cursor={{ fill: "rgb(var(--c-border-subtle))", stroke: "rgb(var(--c-border))" }}
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
            <Line
              type="monotone"
              dataKey="value"
              stroke="rgb(var(--c-accent))"
              strokeWidth={2}
              dot={{ r: 4, fill: "rgb(var(--c-accent))", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ValuationPanel({ holdingId, ticker }: { holdingId: string; ticker: string }) {
  const [valuation, setValuation] = useState<HoldingValuation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setValuation(null);
    api
      .getHoldingValuation(holdingId)
      .then(setValuation)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load valuation."));
  }, [holdingId]);

  async function handleRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      setValuation(await api.refreshHoldingValuation(holdingId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{ticker} — valuation</h3>
          {valuation?.as_of && (
            <p className="mt-0.5 text-xs text-ink-faint">
              As of {formatDate(valuation.as_of)} · assumptions {valuation.assumptions_version}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      {!error && valuation === null && <p className="text-sm text-ink-muted">Loading…</p>}

      {!error && valuation !== null && (
        <div className="space-y-6">
          {valuation.unavailable_reasons.length > 0 && (
            <div className="rounded-md border border-caution/30 bg-caution-subtle px-3 py-2 text-xs text-caution">
              {valuation.unavailable_reasons.join(" · ")}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 border-b border-border-subtle pb-5 sm:grid-cols-4">
            <StatTile
              label="Price"
              value={
                valuation.current_price_per_share
                  ? `${formatDecimal(valuation.current_price_per_share)} ${valuation.valuation_currency ?? ""}`
                  : "—"
              }
            />
            <StatTile
              label="Discount rate (CAPM)"
              value={valuation.discount_rate ? formatPercent(valuation.discount_rate) : "—"}
              hint={
                valuation.risk_free_rate_pct && valuation.beta
                  ? `rf ${formatPercent(valuation.risk_free_rate_pct)} · β ${formatDecimal(valuation.beta)}`
                  : undefined
              }
            />
            <StatTile
              label="Base growth"
              value={valuation.base_growth_rate ? formatPercent(valuation.base_growth_rate) : "—"}
            />
            <StatTile
              label="Reverse DCF implied growth"
              value={
                valuation.reverse_dcf_implied_growth
                  ? formatPercent(valuation.reverse_dcf_implied_growth)
                  : "—"
              }
            />
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              DCF scenarios (owner earnings)
            </h4>
            {valuation.dcf === null ? (
              <EmptyState>DCF unavailable for this holding — see the note above.</EmptyState>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {valuation.dcf.scenarios.map((s) => (
                    <ScenarioCard key={s.label} scenario={s} currency={valuation.valuation_currency} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  Discount rate {formatPercent(valuation.dcf.discount_rate)} · terminal growth{" "}
                  {formatPercent(valuation.dcf.terminal_growth_rate)}
                </p>
              </>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Multiples over time
            </h4>
            {valuation.multiples.length === 0 ? (
              <EmptyState>No periods with both extracted facts and a market price yet.</EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {MULTIPLE_ORDER.map((key) => (
                  <MultiplesChart
                    key={key}
                    metricKey={key}
                    label={MULTIPLE_LABELS[key]}
                    series={valuation.multiples}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
