import { useState } from "react";
import { ApiError, refreshSnapshotValuation } from "../../services/api";
import type { PortfolioValuationOut } from "../../types/market_valuation";
import { num } from "../../lib/num";
import CompositionBreakdown from "../../charts/CompositionBreakdown";

function toSlices(weights: Record<string, string>, topN = 8): { name: string; value: number }[] {
  const entries = Object.entries(weights).map(([name, value]) => [name, num(value) ?? 0] as const);
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length <= topN) return entries.map(([name, value]) => ({ name, value }));
  const head = entries.slice(0, topN - 1);
  const restTotal = entries.slice(topN - 1).reduce((sum, [, v]) => sum + v, 0);
  return [...head.map(([name, value]) => ({ name, value })), { name: "Other", value: restTotal }];
}

/**
 * Portfolio composition (architecture §19 "Portfolio composition — current
 * allocation"). Requires a live market-data valuation
 * (`POST /portfolio/snapshots/{id}/valuation`, §26 Phase 2), so it's a
 * manual "Refresh valuation" trigger rather than an automatic fetch — same
 * convention as Analysis.tsx's manual "Run analysis" for the network-
 * dependent Phase 3 endpoint.
 */
export default function CompositionSection({ snapshotId }: { snapshotId: string }) {
  const [valuation, setValuation] = useState<PortfolioValuationOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      setValuation(await refreshSnapshotValuation(snapshotId));
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Valuation refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  const totalMarketValue = valuation ? num(valuation.total_market_value) : null;
  const totalUnrealizedPnl = valuation ? num(valuation.total_unrealized_pnl) : null;
  const largestSingleNamePct = valuation ? num(valuation.concentration.largest_single_name_pct) : null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">Portfolio composition</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded px-3 py-1 text-xs font-medium"
        >
          {loading ? "Refreshing…" : valuation ? "Refresh valuation" : "Load valuation"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!valuation && !loading && (
        <p className="text-sm text-slate-500">
          Fetches live prices/FX and computes market value, P&L, and concentration for this snapshot.
        </p>
      )}

      {valuation && (
        <>
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            {totalMarketValue !== null && (
              <div>
                <span className="text-slate-500">Total value: </span>
                <span className="font-medium">
                  {totalMarketValue.toLocaleString()} {valuation.reporting_currency}
                </span>
              </div>
            )}
            {totalUnrealizedPnl !== null && (
              <div>
                <span className="text-slate-500">Unrealized P&L: </span>
                <span className={totalUnrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {totalUnrealizedPnl.toLocaleString()} {valuation.reporting_currency}
                </span>
              </div>
            )}
            {largestSingleNamePct !== null && (
              <div>
                <span className="text-slate-500">Largest position: </span>
                <span className="font-medium">{largestSingleNamePct.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {valuation.warnings.length > 0 && (
            <ul className="text-xs text-amber-400 list-disc list-inside mb-4">
              {valuation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-1">By holding</h3>
              <CompositionBreakdown data={toSlices(valuation.concentration.single_name_weights)} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-1">By sector</h3>
              <CompositionBreakdown data={toSlices(valuation.concentration.sector_weights)} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-1">By currency</h3>
              <CompositionBreakdown data={toSlices(valuation.concentration.currency_weights)} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
