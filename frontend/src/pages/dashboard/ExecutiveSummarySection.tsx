import { useEffect, useState } from "react";
import { ApiError, getExecutiveSummary } from "../../services/api";
import type { ExecutiveSummaryOut } from "../../types/executive_summary";
import { num } from "../../lib/num";
import { bandColor } from "../../charts/palette";
import InfoTooltip from "../../components/InfoTooltip";

const SECTION_EXPLANATION =
  "A one-glance rollup of everything else on this dashboard: total value and P&L, overall risk band, how much of the portfolio has an AI analysis behind it, the collection/currency mix, and the current macro backdrop — plus every warning and stale-data flag from those sections gathered into one list, so you don't have to check each section separately to know what needs attention. Built entirely from what Composition/Portfolio risk/Factor profile/Macro dashboard already computed — refreshing this re-reads that data, it never fetches live prices or research itself.";

function formatMoney(value: number | null, currency: string): string {
  if (value === null) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function formatPct(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatRegime(regime: string): string {
  return regime.charAt(0).toUpperCase() + regime.slice(1).replace(/_/g, " ");
}

export default function ExecutiveSummarySection({
  snapshotId,
  accountIds,
}: {
  snapshotId: string;
  accountIds: string[];
}) {
  const [summary, setSummary] = useState<ExecutiveSummaryOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getExecutiveSummary(snapshotId, accountIds)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Could not load executive summary.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, accountIds.join(",")]);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getExecutiveSummary(snapshotId, accountIds));
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Could not load executive summary.");
    } finally {
      setLoading(false);
    }
  }

  const collectionLine = summary?.composition.by_collection
    .filter((c) => num(c.pct_of_total) !== null && num(c.pct_of_total)! > 0)
    .map((c) => `${c.collection} ${num(c.pct_of_total)!.toFixed(1)}%`)
    .join(" · ");

  return (
    <section className="terminal-card">
      <div className="terminal-card-header">
        <h2 className="terminal-card-title flex items-center gap-2">
          Executive summary
          <InfoTooltip text={SECTION_EXPLANATION} />
        </h2>
        <button onClick={handleRefresh} disabled={loading} className="btn-terminal text-xs px-3 py-1">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      {!summary && !error && <p className="text-sm text-tertiary">Loading…</p>}

      {summary && (
        <div className="space-y-4">
          <div className="grid-3">
            <div className="stat-panel">
              <div className="stat-label">Total value</div>
              <div className="stat-value">{formatMoney(num(summary.headline.total_market_value), summary.headline.reporting_currency)}</div>
              <div className="text-xs text-disabled font-mono mt-1">
                {summary.headline.valuation_as_of
                  ? `as of ${new Date(summary.headline.valuation_as_of).toLocaleDateString()}`
                  : "never priced"}
              </div>
            </div>

            <div className="stat-panel">
              <div className="stat-label">Unrealized P&amp;L</div>
              <div
                className={`stat-value ${
                  (num(summary.headline.total_unrealized_pnl) ?? 0) >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatMoney(num(summary.headline.total_unrealized_pnl), summary.headline.reporting_currency)}
              </div>
              <div className="text-xs text-tertiary mt-1">
                {summary.headline.total_unrealized_pnl_pct !== null
                  ? formatPct(num(summary.headline.total_unrealized_pnl_pct), 2)
                  : "—"}
              </div>
            </div>

            <div className="stat-panel">
              <div className="stat-label">Overall risk</div>
              {summary.risk.available ? (
                <>
                  <span
                    className="terminal-badge"
                    style={{
                      backgroundColor: `${bandColor(summary.risk.risk_band)}26`,
                      color: bandColor(summary.risk.risk_band),
                      border: `1px solid ${bandColor(summary.risk.risk_band)}4D`,
                    }}
                  >
                    {summary.risk.risk_band}
                  </span>
                  <div className="text-xs text-tertiary mt-1 font-mono">
                    {summary.risk.composite_risk_score !== null ? `score ${summary.risk.composite_risk_score}/100` : " "}
                  </div>
                </>
              ) : (
                <div className="text-sm text-tertiary">No risk snapshot yet</div>
              )}
            </div>
          </div>

          <div className="grid-3">
            <div className="stat-panel">
              <div className="stat-label">Largest position</div>
              <div className="stat-value text-base">{formatPct(num(summary.headline.largest_single_name_pct))}</div>
            </div>
            <div className="stat-panel">
              <div className="stat-label">Outside {summary.headline.reporting_currency}</div>
              <div className="stat-value text-base">{formatPct(num(summary.composition.currency_exposure_pct))}</div>
            </div>
            <div className="stat-panel">
              <div className="stat-label">Macro regime</div>
              <div className="stat-value text-base">{summary.macro.available ? formatRegime(summary.macro.regime) : "—"}</div>
            </div>
          </div>

          {collectionLine && (
            <p className="text-xs text-tertiary">
              <span className="text-secondary">By collection:</span> {collectionLine}
            </p>
          )}

          {(summary.factor_profile.holdings_total > 0 || summary.risk.available) && (
            <div className="text-sm text-secondary space-y-1">
              {summary.factor_profile.holdings_total > 0 && (
                <p>
                  {summary.factor_profile.holdings_analyzed} of {summary.factor_profile.holdings_total} holdings have an AI
                  analysis on record
                  {summary.factor_profile.coverage_pct !== null && ` (${formatPct(num(summary.factor_profile.coverage_pct))})`}
                  {summary.factor_profile.avg_overall_score !== null &&
                    ` — average overall score ${summary.factor_profile.avg_overall_score}/10`}
                  .
                </p>
              )}
              {summary.risk.available && summary.risk.worst_dimensions.length > 0 && (
                <p>
                  Highest-severity risk dimension: {summary.risk.worst_dimensions[0].label} (
                  {summary.risk.worst_dimensions[0].band}).
                  {summary.risk.worst_scenario &&
                    ` Worst modeled scenario: ${summary.risk.worst_scenario.label} (${num(
                      summary.risk.worst_scenario.estimated_portfolio_impact_pct,
                    )?.toFixed(1)}% estimated portfolio impact).`}
                  {summary.risk.wealth_tax_estimated_tax !== null &&
                    ` Estimated Norwegian wealth tax: ${num(summary.risk.wealth_tax_estimated_tax)?.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} NOK.`}
                </p>
              )}
            </div>
          )}

          {summary.watch_items.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-secondary mb-1">Needs attention</h3>
              <ul className="text-sm space-y-1">
                {summary.watch_items.map((item, i) => (
                  <li key={i} className={item.severity === "warning" ? "text-warning" : "text-tertiary"}>
                    {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-positive">Nothing needs attention right now.</p>
          )}
        </div>
      )}
    </section>
  );
}
