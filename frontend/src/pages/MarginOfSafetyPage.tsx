import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import { formatDate, formatDecimal, formatNok, formatPercent } from "../lib/format";
import type { BoardRow, BoardZone, MarginOfSafetyBoard } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, SnapshotStamp, VerdictBadge } from "../components/ui";
import { InfoTooltip } from "../components/InfoTooltip";
import { GLOSSARY } from "../lib/glossary";
import { shortReason } from "../lib/unrankable";

/** Feature F3 — every stock you own, ranked by how far its price sits below
 * the DCF value (backend/app/services/valuation/board.py). All numbers are
 * Sprint 3's deterministic valuation; nothing here comes from the LLM except
 * the verdict column, which is the latest stored analysis run. */

const ZONES: { key: Exclude<BoardZone, "unavailable">; label: string; hint: string; tone: string }[] = [
  { key: "below_bear", label: "Below bear value", hint: "Cheaper than even the pessimistic case", tone: "text-positive" },
  { key: "bear_to_base", label: "Bear to base", hint: "Some margin of safety", tone: "text-ink" },
  { key: "base_to_bull", label: "Base to bull", hint: "Priced for more than the base case", tone: "text-ink" },
  { key: "above_bull", label: "Above bull value", hint: "Priced beyond the optimistic case", tone: "text-negative" },
];

const ZONE_DOT: Record<BoardZone, string> = {
  below_bear: "bg-positive",
  bear_to_base: "bg-positive/60",
  base_to_bull: "bg-caution",
  above_bull: "bg-negative",
  unavailable: "bg-ink-faint",
};

/** Each row gets its own scale (prices and currencies differ per holding):
 * the bear–bull band, a tick at base, and a dot for today's price. */
function RangeBar({ row }: { row: BoardRow }) {
  const price = Number(row.price);
  const bear = Number(row.bear);
  const base = Number(row.base);
  const bull = Number(row.bull);
  const low = Math.min(bear, bull);
  const high = Math.max(bear, bull);
  const min = Math.min(low, price);
  const max = Math.max(high, price);
  const pad = (max - min) * 0.08 || 1;
  const scale = (v: number) => ((v - min + pad) / (max - min + 2 * pad)) * 100;

  return (
    <div
      className="relative h-5 w-full min-w-[9rem]"
      role="img"
      aria-label={`Price ${formatDecimal(row.price!)} against bear ${formatDecimal(row.bear!)}, base ${formatDecimal(row.base!)}, bull ${formatDecimal(row.bull!)}`}
    >
      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border" />
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent/20"
        style={{ left: `${scale(low)}%`, width: `${scale(high) - scale(low)}%` }}
      />
      <div className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-accent" style={{ left: `${scale(base)}%` }} />
      <div
        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${ZONE_DOT[row.zone]}`}
        style={{ left: `${scale(price)}%` }}
      />
    </div>
  );
}

function RankedTable({ rows, variant = "portfolio" }: { rows: BoardRow[]; variant?: "portfolio" | "watchlist" }) {
  const watch = variant === "watchlist";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="py-2 pr-4 font-medium">Holding</th>
            <th className="py-2 pr-4 font-medium">Verdict</th>
            <th className="py-2 pr-4 font-medium">
              <span className="inline-flex items-center gap-1">
                Price vs. bear · base · bull
                <InfoTooltip text={GLOSSARY.bearBaseBull} align="left" />
              </span>
            </th>
            <th className="py-2 pr-4 text-right font-medium">Price</th>
            <th className="py-2 pr-4 text-right font-medium">Base value</th>
            <th className="py-2 pr-4 text-right font-medium">
              <span className="inline-flex items-center gap-1">
                Margin of safety
                <InfoTooltip text={GLOSSARY.marginOfSafety} />
              </span>
            </th>
            <th className="py-2 text-right font-medium">{watch ? "Your buy-below" : "Weight"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mos = row.margin_of_safety_base;
            return (
              <tr key={row.holding_id} className="border-t border-border-subtle align-middle">
                <td className="py-3 pr-4">
                  <Link to={`/holdings/${row.holding_id}`} className="font-medium text-ink hover:text-accent">
                    {row.name}
                  </Link>
                  <p className="text-xs text-ink-faint">
                    {row.ticker}
                    {row.valuation_method === "fund_look_through_pe" && (
                      <span
                        className="ml-1.5 rounded bg-border-subtle px-1 py-0.5 text-[10px] font-medium text-ink-muted"
                        title="Fund: valued on its holdings' earnings yield, not a DCF"
                      >
                        look-through
                      </span>
                    )}
                  </p>
                </td>
                <td className="py-3 pr-4">
                  <VerdictBadge
                    rating={row.verdict_rating}
                    title={row.analyzed_at ? `Analyzed ${formatDate(row.analyzed_at)}` : undefined}
                  />
                </td>
                <td className="w-56 py-3 pr-4">
                  {row.zone !== "unavailable" ? (
                    <RangeBar row={row} />
                  ) : (
                    <span className="text-xs text-ink-faint">No price</span>
                  )}
                </td>
                <td className="tabular py-3 pr-4 text-right text-ink">
                  {row.price ? formatDecimal(row.price) : "—"}
                  <span className="ml-1 text-xs text-ink-faint">{row.valuation_currency}</span>
                </td>
                <td className="tabular py-3 pr-4 text-right text-ink-muted">
                  {row.base ? formatDecimal(row.base) : "—"}
                </td>
                <td
                  className={`tabular py-3 pr-4 text-right font-medium ${
                    mos === null ? "text-ink-faint" : Number(mos) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {mos === null ? "—" : formatPercent(mos)}
                </td>
                <td className="tabular py-3 text-right text-ink-muted">
                  {watch
                    ? row.buy_below_price
                      ? `${formatDecimal(row.buy_below_price)} ${row.buy_below_currency ?? ""}`
                      : "—"
                    : row.weight_pct
                      ? formatPercent(row.weight_pct)
                      : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One line per holding that has no valuation: its name and a one-word cause. The full sentence from
 * the backend is one click away, so nothing is hidden, only moved out of the first read. */
function UnrankableRow({ row, withValue = false }: { row: BoardRow; withValue?: boolean }) {
  const short = shortReason(row.unavailable_reason);
  const chip =
    short.kind === "data"
      ? "bg-caution-subtle text-caution"
      : short.kind === "model"
        ? "bg-border-subtle text-ink-muted"
        : "bg-border-subtle text-ink-faint";
  return (
    <li className="py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/holdings/${row.holding_id}`} className="font-medium text-ink hover:text-accent">
            {row.name}
          </Link>
          <span className="ml-2 text-xs text-ink-faint">{row.ticker}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-xs ${chip}`}>{short.label}</span>
          {withValue && <span className="tabular text-xs text-ink-muted">{formatNok(row.market_value_nok)}</span>}
        </div>
      </div>
      <details className="mt-1 text-xs text-ink-muted">
        <summary className="cursor-pointer text-ink-faint hover:text-accent">Why</summary>
        <p className="mt-1">
          {row.price ? `Price ${formatDecimal(row.price)} ${row.valuation_currency}. ` : ""}
          {row.unavailable_reason ?? "No DCF yet"}
        </p>
      </details>
    </li>
  );
}

export default function MarginOfSafetyPage() {
  const query = useCachedQuery<MarginOfSafetyBoard>("board", () => api.getMarginOfSafetyBoard(), {
    errorText: "Could not load the board.",
  });
  const board = query.data;
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const error = refreshError ?? query.error;

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshError(null);
    api
      .refreshMarginOfSafetyBoard()
      .then(query.mutate)
      .catch((e) => setRefreshError(e instanceof ApiError ? e.message : "Could not refresh the board."))
      .finally(() => setRefreshing(false));
  };

  const ranked = board?.rows.filter((r) => r.zone !== "unavailable") ?? [];
  const unavailable = board?.rows.filter((r) => r.zone === "unavailable") ?? [];
  const watchRows = board?.watchlist_rows ?? [];
  const watchRanked = watchRows.filter((r) => r.zone !== "unavailable");
  const watchUnavailable = watchRows.filter((r) => r.zone === "unavailable");
  // Sprint 14 (2026-09-26): when regime-adjusted DCF is on, every row used
  // the same widened discount rate — surfaced once here rather than repeated
  // per row.
  const regimeRow = board?.rows.find((r) => r.regime && r.regime_discount_rate_addon && Number(r.regime_discount_rate_addon) !== 0);
  const valueBelowBase = ranked
    .filter((r) => r.zone === "below_bear" || r.zone === "bear_to_base")
    .reduce((sum, r) => sum + Number(r.market_value_nok ?? 0), 0);
  const totalValue = Number(board?.total_equity_value_nok ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-1.5">
            Margin of safety
            <InfoTooltip text={GLOSSARY.marginOfSafety} />
          </span>
        }
        subtitle="Every stock you own, ranked by how far today's price sits below its DCF value."
        actions={
          <div className="flex items-center gap-3">
            <SnapshotStamp at={board?.snapshot_at} />
            <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        }
      />

      {error && <p className="text-sm text-negative">{error}</p>}
      {!board && !error && (
        <p className="text-sm text-ink-muted">
          Loading your holdings' last-known valuations… (each price/DCF is served from cache — hit
          "Refresh" above for a live re-check, which can take a little while).
        </p>
      )}

      {board && board.rows.length === 0 && (
        <EmptyState>
          No stocks or equity ETFs in your latest portfolio snapshots. Import a portfolio CSV on the
          Portfolio page first.
        </EmptyState>
      )}

      {board && board.rows.length > 0 && (
        <div className="space-y-6">
          {regimeRow && (
            <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-ink-muted">
              Regime-adjusted DCF is on: every holding's discount rate is widened by{" "}
              {formatPercent(regimeRow.regime_discount_rate_addon!)} for the current{" "}
              <span className="font-medium text-ink">{regimeRow.regime}</span> macro regime — see{" "}
              <Link to="/risk" className="underline hover:text-accent">
                Portfolio risk
              </Link>{" "}
              for the full reading.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {ZONES.map((zone) => (
              <Card key={zone.key}>
                <p className="text-xs text-ink-muted">{zone.label}</p>
                <p className={`tabular mt-1 text-2xl font-semibold ${zone.tone}`}>
                  {board.zone_counts[zone.key]}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">{zone.hint}</p>
              </Card>
            ))}
          </div>

          {totalValue > 0 && ranked.length > 0 && (
            <Card>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-border-subtle"
                role="img"
                aria-label="Share of your equity value by valuation zone"
              >
                {[...ZONES, { key: "unavailable" as const, label: "Not ranked", hint: "", tone: "" }].map((z) => {
                  const value = (board.rows ?? [])
                    .filter((r) => r.zone === z.key)
                    .reduce((sum, r) => sum + Number(r.market_value_nok ?? 0), 0);
                  return value > 0 ? (
                    <div
                      key={z.key}
                      className={ZONE_DOT[z.key]}
                      style={{ width: `${(value / totalValue) * 100}%` }}
                      title={`${z.label}: ${formatPercent(String(value / totalValue))}`}
                    />
                  ) : null;
                })}
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                <span className="font-semibold text-ink">
                  {formatPercent(String(valueBelowBase / totalValue))}
                </span>{" "}
                of your {formatNok(board.total_equity_value_nok)} equity is priced at or below its
                base-case value.
              </p>
            </Card>
          )}

          <Card>
            {ranked.length === 0 ? (
              <p className="text-sm text-ink-muted">
                None of your holdings has enough financial history for a DCF yet — see the list below.
              </p>
            ) : (
              <RankedTable rows={ranked} />
            )}
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded-full bg-accent/20" /> bear to bull value
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-px bg-accent" /> base value
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-muted" /> today's price
              </span>
              <span>Values are deterministic DCF output, not model opinions.</span>
            </p>
          </Card>

          {watchRows.length > 0 && (
            <Card className="border-dashed">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  Watchlist — not owned ({watchRows.length})
                </h2>
                <Link to="/watchlist" className="text-xs text-ink-muted underline hover:text-accent">
                  Manage watchlist
                </Link>
              </div>
              <p className="mt-0.5 text-xs text-ink-faint">
                Companies you follow but don't hold. Same valuation as above; kept separate so it never
                counts toward your portfolio totals.
              </p>
              {watchRanked.length > 0 && (
                <div className="mt-3">
                  <RankedTable rows={watchRanked} variant="watchlist" />
                </div>
              )}
              {watchUnavailable.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-ink hover:text-accent">
                    Can't value yet ({watchUnavailable.length})
                  </summary>
                  <ul className="mt-2 divide-y divide-border-subtle">
                    {watchUnavailable.map((row) => (
                      <UnrankableRow key={row.holding_id} row={row} />
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}

          {unavailable.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-ink">
                Can't be ranked yet ({unavailable.length})
              </h2>
              <p className="mt-0.5 text-xs text-ink-faint">
                Usually missing financial history. Open the holding and import from SEC EDGAR or upload
                an annual report.
              </p>
              <ul className="mt-3 divide-y divide-border-subtle">
                {unavailable.map((row) => (
                  <UnrankableRow key={row.holding_id} row={row} withValue />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
