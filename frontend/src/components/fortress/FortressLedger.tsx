import { Link } from "react-router-dom";
import {
  FRESHNESS_LABEL,
  MOAT_LABEL,
  SIZE_LABEL,
  STRUCTURE_LABEL,
  WALL_LABEL,
  sortTowers,
} from "../../lib/fortress";
import { formatNok, formatPct100 } from "../../lib/format";
import type { GameTower } from "../../lib/types";
import { VerdictBadge } from "../ui";

/** The same state as the picture, as a plain table. It exists so no fact is
 * available only as a drawing (accessibility, screen readers, exactness). */
export default function FortressLedger({ towers }: { towers: GameTower[] }) {
  const rows = sortTowers(towers);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-3 font-semibold">Holding</th>
            <th className="py-2 pr-3 font-semibold">Structure</th>
            <th className="py-2 pr-3 text-right font-semibold">Value</th>
            <th className="py-2 pr-3 text-right font-semibold">Weight</th>
            <th className="py-2 pr-3 font-semibold">Moat</th>
            <th className="py-2 pr-3 font-semibold">Walls</th>
            <th className="py-2 pr-3 font-semibold">Analysis</th>
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
  );
}
