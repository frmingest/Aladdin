import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FRESHNESS_LABEL,
  MOAT_LABEL,
  SIZE_LABEL,
  STRUCTURE_LABEL,
  WALL_LABEL,
  filterLedger,
  ledgerTotals,
  sortLedger,
} from "../../lib/fortress";
import type { LedgerFilter, LedgerSortDir, LedgerSortKey } from "../../lib/fortress";
import { formatNok, formatPct100 } from "../../lib/format";
import type { GameTower } from "../../lib/types";
import { VerdictBadge } from "../ui";

/** The same state as the picture, as a plain table. It exists so no fact is
 * available only as a drawing (accessibility, screen readers, exactness). */
export default function FortressLedger({ towers }: { towers: GameTower[] }) {
  const [sortKey, setSortKey] = useState<LedgerSortKey>("weight");
  const [sortDir, setSortDir] = useState<LedgerSortDir>("desc");
  const [filter, setFilter] = useState<LedgerFilter>("all");

  const rows = useMemo(() => sortLedger(filterLedger(towers, filter), sortKey, sortDir), [towers, filter, sortKey, sortDir]);
  const totals = useMemo(() => ledgerTotals(rows), [rows]);

  const sortBy = (key: LedgerSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "weight" ? "desc" : "asc");
    }
  };
  const header = (key: LedgerSortKey, label: string, align = "") => (
    <th
      className={`py-2 pr-3 font-semibold ${align}`}
      aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => sortBy(key)} className="uppercase tracking-wide hover:text-ink">
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div role="group" aria-label="Ledger filter" className="inline-flex rounded-md border border-border p-0.5">
          {(["all", "attention"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                filter === f ? "bg-accent-subtle text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {f === "all" ? "All holdings" : "Needs a look"}
            </button>
          ))}
        </div>
        <p className="tabular text-xs text-ink-faint">
          {totals.count} shown · {totals.weightPct.toFixed(1)}% of the portfolio · {totals.attention} to look at first
        </p>
      </div>
      {filter === "attention" && (
        <p className="mb-2 text-xs text-ink-faint">
          Timber or rotted walls, no moat, or an analysis that is stale or missing. A reading aid over the
          same categories; it is not a score and not advice to trade.
        </p>
      )}
      {rows.length === 0 && <p className="py-4 text-sm text-ink-muted">Nothing needs a look right now.</p>}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            {header("name", "Holding")}
            <th className="py-2 pr-3 font-semibold">Structure</th>
            <th className="py-2 pr-3 text-right font-semibold">Value</th>
            {header("weight", "Weight", "text-right")}
            {header("moat", "Moat")}
            {header("wall", "Walls")}
            {header("freshness", "Analysis")}
            <th className="py-2 font-semibold">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.holding_id} className="border-b border-border-subtle align-top">
              <td className="py-2 pr-3">
                <Link to={`/holdings/${t.holding_id}`} className="font-medium text-accent hover:underline">
                  {t.name}
                </Link>
                <p className="text-xs text-ink-faint">{t.ticker}</p>
              </td>
              <td className="py-2 pr-3 text-ink-muted">
                {STRUCTURE_LABEL[t.structure]}
                <p className="text-xs text-ink-faint">{SIZE_LABEL[t.size_class]}</p>
              </td>
              <td className="tabular py-2 pr-3 text-right">{formatNok(t.value_nok)}</td>
              <td className="tabular py-2 pr-3 text-right">{formatPct100(t.weight_pct)}</td>
              <td className="py-2 pr-3 text-ink-muted">{MOAT_LABEL[t.moat]}</td>
              <td className="py-2 pr-3 text-ink-muted">
                {WALL_LABEL[t.wall]}
                <p className="text-xs text-ink-faint">{t.wall_reason}</p>
              </td>
              <td className="py-2 pr-3 text-ink-muted">
                {FRESHNESS_LABEL[t.freshness]}
                {t.analysis_age_days !== null && (
                  <p className="text-xs text-ink-faint">{t.analysis_age_days} days old</p>
                )}
              </td>
              <td className="py-2">
                <VerdictBadge rating={t.verdict_rating} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
