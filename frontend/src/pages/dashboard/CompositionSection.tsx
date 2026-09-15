import { useEffect, useRef, useState } from "react";
import { ApiError, refreshSnapshotValuation } from "../../services/api";
import type { HoldingValuationOut, PortfolioValuationOut } from "../../types/market_valuation";
import { num } from "../../lib/num";
import CompositionBreakdown from "../../charts/CompositionBreakdown";
import InfoTooltip from "../../components/InfoTooltip";
import { ALL_COLLECTIONS, SECURITIES, collectionForAssetClass } from "../../components/CollectionFilter";

/** Turns a {name: absolute value} map into pre-sorted, top-N chart slices
 * expressed as a percentage of `total` — the shared "collapse the long tail
 * into Other" convention every breakdown pie on this dashboard uses. */
function toSlices(
  valuesByName: Record<string, number>,
  total: number,
  topN = 8
): { name: string; value: number }[] {
  const entries = Object.entries(valuesByName)
    .map(([name, value]) => [name, total > 0 ? (value / total) * 100 : 0] as const)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length <= topN) return entries.map(([name, value]) => ({ name, value }));
  const head = entries.slice(0, topN - 1);
  const restTotal = entries.slice(topN - 1).reduce((sum, [, v]) => sum + v, 0);
  return [...head.map(([name, value]) => ({ name, value })), { name: "Other", value: restTotal }];
}

function sumBy(items: HoldingValuationOut[], selector: (h: HoldingValuationOut) => number | null): number {
  return items.reduce((acc, h) => {
    const v = selector(h);
    return v === null ? acc : acc + v;
  }, 0);
}

function groupSum(
  items: HoldingValuationOut[],
  keyOf: (h: HoldingValuationOut) => string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of items) {
    const v = num(h.market_value_reporting_ccy);
    if (v === null) continue;
    const key = keyOf(h);
    out[key] = (out[key] ?? 0) + v;
  }
  return out;
}

type Breakdown = {
  totalMarketValue: number;
  totalUnrealizedPnl: number | null;
  largestSingleNamePct: number | null;
  byCollectionValues: Record<string, number>;
  byHoldingSlices: { name: string; value: number }[];
  sectorSlices: { name: string; value: number }[];
  currencySlices: { name: string; value: number }[];
};

/**
 * Recomputes every Composition number/chart straight from
 * `valuation.holdings` (each already carries `asset_class`,
 * `market_value_reporting_ccy`, `sector`, `trading_currency` — everything
 * needed) rather than trusting the backend's ticker/sector/currency weight
 * maps directly. Two reasons: (1) it lets the collection filter apply
 * instantly, with no new network call, by just re-aggregating data already
 * on hand; (2) it collapses every COMMODITY holding into one "Coin
 * collection" slice and every COLLECTIBLE holding into one "Whisky
 * collection" slice for the "By holding" chart, instead of the one-slice-
 * per-bottle/coin result the backend's per-ticker `single_name_weights`
 * naturally produces (see the project doc "Portfolio composition:
 * collections aggregation and filter" for the before/after).
 *
 * `includedCollections` (empty = all three) both narrows which holdings
 * count at all and re-normalizes every percentage against just the
 * remaining total — excluding Whisky doesn't just hide its slice, it
 * removes it from the denominator too, same as the account filter already
 * does for accounts.
 */
function buildBreakdown(holdings: HoldingValuationOut[], includedCollections: string[]): Breakdown {
  const included = holdings.filter((h) => {
    if (num(h.market_value_reporting_ccy) === null) return false;
    if (includedCollections.length === 0) return true;
    return includedCollections.includes(collectionForAssetClass(h.asset_class));
  });

  const totalMarketValue = sumBy(included, (h) => num(h.market_value_reporting_ccy));

  const costItems = included.filter((h) => h.cost_basis_value_reporting_ccy !== null);
  const totalUnrealizedPnl =
    costItems.length > 0
      ? totalMarketValue - sumBy(costItems, (h) => num(h.cost_basis_value_reporting_ccy))
      : null;

  // Largest single position stays grouped by ticker only (matching the
  // backend's own multi-account-holding fix) — never collapsed into a
  // collection bucket, so "largest position" keeps meaning "the single
  // biggest instrument I hold", not "my coin collection as a whole".
  const byTicker = groupSum(included, (h) => h.ticker);
  const tickerValues = Object.values(byTicker);
  const largestSingleNamePct =
    totalMarketValue > 0 && tickerValues.length > 0 ? (Math.max(...tickerValues) / totalMarketValue) * 100 : null;

  // "By holding": individual securities stay individual; every coin and
  // every whisky bottle collapses into one "Coin collection"/"Whisky
  // collection" slice apiece.
  const byHoldingValues: Record<string, number> = {};
  for (const h of included) {
    const v = num(h.market_value_reporting_ccy);
    if (v === null) continue;
    const collection = collectionForAssetClass(h.asset_class);
    const key = collection === SECURITIES ? h.ticker : collection;
    byHoldingValues[key] = (byHoldingValues[key] ?? 0) + v;
  }

  const sectorValues = groupSum(included, (h) => h.sector || "Unclassified");
  const currencyValues = groupSum(included, (h) => h.trading_currency);
  const byCollectionValues = groupSum(included, (h) => collectionForAssetClass(h.asset_class));

  return {
    totalMarketValue,
    totalUnrealizedPnl,
    largestSingleNamePct,
    byCollectionValues,
    byHoldingSlices: toSlices(byHoldingValues, totalMarketValue),
    sectorSlices: toSlices(sectorValues, totalMarketValue),
    currencySlices: toSlices(currencyValues, totalMarketValue),
  };
}

const SECTION_EXPLANATION =
  "Shows what you actually own right now — total value, gain/loss, and how concentrated it is by holding, sector, and currency. This is the starting point for risk: a portfolio that's heavily weighted in one stock, sector, or currency carries more concentration risk than one spread out, even before you look at anything else.";

const COLLECTION_EXPLANATION =
  "Splits your total across the three kinds of holding this portfolio actually has: live-priced securities (Nordnet), manually-entered coins (priced at today's gold/silver spot), and the whisky collection (carried at cost basis — no live market for it). Always shows the true total for each, whatever the Collections filter above is set to, so you can spot a bad entry (like a coin's cost basis inflating unrealized P&L) at a glance.";

/**
 * Portfolio composition (architecture §19 "Portfolio composition — current
 * allocation"). Requires a live market-data valuation
 * (`POST /portfolio/snapshots/{id}/valuation`, §26 Phase 2), so it's a
 * manual "Refresh valuation" trigger rather than an automatic fetch — same
 * convention as Analysis.tsx's manual "Run analysis" for the network-
 * dependent Phase 3 endpoint.
 */
export default function CompositionSection({
  snapshotId,
  accountIds,
  includedCollections,
}: {
  snapshotId: string;
  accountIds: string[];
  includedCollections: string[];
}) {
  const [valuation, setValuation] = useState<PortfolioValuationOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether `valuation` above still reflects the current filter —
  // a live valuation is a paid provider call (§2.7), so switching accounts
  // clears the stale numbers and asks for an explicit re-refresh rather than
  // silently re-fetching on every filter change. The Collections filter
  // below does NOT do this — it re-aggregates data already on hand, no
  // network call involved, so it can apply instantly.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setValuation(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, accountIds.join(",")]);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      setValuation(await refreshSnapshotValuation(snapshotId, accountIds));
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Valuation refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  // Always computed unfiltered — the "Securities / Coin collection / Whisky
  // collection" totals panel is a validation tool, so it stays a fixed
  // reference point regardless of what the Collections filter is currently
  // narrowed to (that filter instead drives `view` below, which feeds the
  // headline stats and every chart).
  const full = valuation ? buildBreakdown(valuation.holdings, []) : null;
  const view = valuation ? buildBreakdown(valuation.holdings, includedCollections) : null;

  return (
    <section className="terminal-card">
      <div className="terminal-card-header">
        <h2 className="terminal-card-title flex items-center gap-2">
          Portfolio composition
          <InfoTooltip text={SECTION_EXPLANATION} />
        </h2>
        <button onClick={handleRefresh} disabled={loading} className="btn-terminal btn-terminal-primary text-xs px-3 py-1">
          {loading ? "Refreshing…" : valuation ? "Refresh valuation" : "Load valuation"}
        </button>
      </div>

      {error && <p className="text-negative text-sm mb-3">{error}</p>}

      {!valuation && !loading && (
        <p className="text-sm text-tertiary">
          Fetches live prices/FX and computes market value, P&amp;L, and concentration for{" "}
          {accountIds.length === 0 ? "the whole portfolio" : "the selected account(s)"}.
        </p>
      )}

      {valuation && view && full && (
        <>
          <div className="grid-3 mb-4">
            <div className="stat-panel">
              <div className="stat-label">Total value{includedCollections.length > 0 ? " (filtered)" : ""}</div>
              <div className="stat-value">
                {view.totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-sm text-tertiary font-normal ml-1">{valuation.reporting_currency}</span>
              </div>
            </div>
            {view.totalUnrealizedPnl !== null && (
              <div className="stat-panel">
                <div className="stat-label">Unrealized P&amp;L</div>
                <div className={`stat-value ${view.totalUnrealizedPnl >= 0 ? "text-positive" : "text-negative"}`}>
                  {view.totalUnrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-sm font-normal ml-1">{valuation.reporting_currency}</span>
                </div>
              </div>
            )}
            {view.largestSingleNamePct !== null && (
              <div className="stat-panel">
                <div className="stat-label">Largest position</div>
                <div className="stat-value">{view.largestSingleNamePct.toFixed(1)}%</div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-secondary mb-1 flex items-center gap-2">
              By collection
              <InfoTooltip text={COLLECTION_EXPLANATION} />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ALL_COLLECTIONS.map((key) => {
                const value = full.byCollectionValues[key] ?? 0;
                const pct = full.totalMarketValue > 0 ? (value / full.totalMarketValue) * 100 : 0;
                const isIncluded = includedCollections.length === 0 || includedCollections.includes(key);
                return (
                  <div key={key} className={`stat-panel ${isIncluded ? "" : "opacity-40"}`}>
                    <div className="stat-label">
                      {key}
                      {!isIncluded && <span className="ml-1">(excluded)</span>}
                    </div>
                    <div className="stat-value text-base">
                      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="text-xs text-tertiary font-normal ml-1">{valuation.reporting_currency}</span>
                    </div>
                    <div className="text-xs text-tertiary">{pct.toFixed(1)}% of total portfolio</div>
                  </div>
                );
              })}
            </div>
          </div>

          {valuation.warnings.length > 0 && (
            <ul className="text-xs text-warning list-disc list-inside mb-4">
              {valuation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-secondary mb-1">By holding</h3>
              <CompositionBreakdown data={view.byHoldingSlices} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-secondary mb-1">By sector</h3>
              <CompositionBreakdown data={view.sectorSlices} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-secondary mb-1">By currency</h3>
              <CompositionBreakdown data={view.currencySlices} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
