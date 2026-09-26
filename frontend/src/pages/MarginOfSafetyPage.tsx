import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatNok, formatPercent } from "../lib/format";
import type { BoardRow, BoardZone, MarginOfSafetyBoard } from "../lib/types";
import { Card, EmptyState, PageHeader, VerdictBadge } from "../components/ui";

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

function RankedTable({ rows }: { rows: BoardRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="py-2 pr-4 font-medium">Holding</th>
            <th className="py-2 pr-4 font-medium">Verdict</th>
            <th className="py-2 pr-4 font-medium">Price vs. bear · base · bull</th>
            <th className="py-2 pr-4 text-right font-medium">Price</th>
            <th className="py-2 pr-4 text-right font-medium">Base value</th>
            <th className="py-2 pr-4 text-right font-medium">Margin of safety</th>
            <th className="py-2 text-right font-medium">Weight</th>
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
                  <p className="text-xs text-ink-faint">{row.ticker}</p>
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
                  {row.weight_pct ? formatPercent(row.weight_pct) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MarginOfSafetyPage() {
  const [board, setBoard] = useState<MarginOfSafetyBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMarginOfSafetyBoard()
      .then(setBoard)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the board."));
  }, []);

  const ranked = board?.rows.filter((r) => r.zone !== "unavailable") ?? [];
  const unavailable = board?.rows.filter((r) => r.zone === "unavailable") ?? [];
  const valueBelowBase = ranked
    .filter((r) => r.zone === "below_bear" || r.zone === "bear_to_base")
    .reduce((sum, r) => sum + Number(r.market_value_nok ?? 0), 0);
  const totalValue = Number(board?.total_equity_value_nok ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Margin of safety"
        subtitle="Every stock you own, ranked by how far today's price sits below its DCF value."
      />

      {error && <p className="text-sm text-negative">{error}</p>}
      {!board && !error && (
        <p className="text-sm text-ink-muted">
          Valuing your holdings… the first load of the day refreshes prices and can take a little while.
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
            <p className="text-sm text-ink-muted">
              {formatPercent(String(valueBelowBase / totalValue))} of your equity value (
              {formatNok(board.total_equity_value_nok)}) is priced at or below its base-case value.
            </p>
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
                  <li key={row.holding_id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link to={`/holdings/${row.holding_id}`} className="font-medium text-ink hover:text-accent">
                        {row.name}
                      </Link>
                      <span className="ml-2 text-xs text-ink-faint">{row.ticker}</span>
                      {/* 2026-09-26: a price fetched despite no DCF now
                          reads as "No DCF yet", not a bare "no price". */}
                      {row.price ? (
                        <p className="text-xs text-ink-muted">
                          No DCF yet — price {formatDecimal(row.price)} {row.valuation_currency}. {row.unavailable_reason}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-muted">{row.unavailable_reason}</p>
                      )}
                    </div>
                    <span className="tabular text-xs text-ink-muted">{formatNok(row.market_value_nok)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
