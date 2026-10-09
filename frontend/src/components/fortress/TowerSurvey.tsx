import { Link } from "react-router-dom";
import {
  FRESHNESS_LABEL,
  LAND_LABEL,
  MOAT_LABEL,
  SIZE_LABEL,
  STRUCTURE_LABEL,
  THESIS_LABEL,
  WALL_LABEL,
  describeSiegeExposure,
  formatWallInput,
} from "../../lib/fortress";
import { formatNok, formatPct100 } from "../../lib/format";
import type { GameTower } from "../../lib/types";
import { Card, VerdictBadge } from "../ui";

/** The survey of one tower: the numbers behind its wall, moat, size and
 * analysis age. Shared by the Fortress page and, in game mode, the holding
 * page. Read-only: it shows what GET /game/state already decided. */
export default function TowerSurvey({ tower, compact = false }: { tower: GameTower; compact?: boolean }) {
  const inputs = Object.entries(tower.wall_inputs);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{tower.name}</h2>
          <p className="text-xs text-ink-faint">
            {tower.ticker}
            {tower.sector ? ` · ${tower.sector}` : ""}
          </p>
        </div>
        <VerdictBadge rating={tower.verdict_rating} />
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Structure</dt>
          <dd className="text-ink">
            {STRUCTURE_LABEL[tower.structure]} · {SIZE_LABEL[tower.size_class]}
          </dd>
          <dd className="tabular text-ink-muted">
            {formatNok(tower.value_nok)} · {formatPct100(tower.weight_pct)} of the portfolio
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Moat</dt>
          <dd className="text-ink">{MOAT_LABEL[tower.moat]}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Walls</dt>
          <dd className="text-ink">{WALL_LABEL[tower.wall]}</dd>
          <dd className="text-ink-muted">{tower.wall_reason}</dd>
          {inputs.length > 0 && (
            <dd className="tabular mt-1 text-xs text-ink-faint">
              {inputs.map(([k, v]) => formatWallInput(k, v)).join(" · ")}
            </dd>
          )}
          {(tower.wall_margins ?? []).length > 0 && (
            <dd className="mt-2">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Distance to the next tier</p>
              <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
                {(tower.wall_margins ?? []).map((m) => (
                  <li key={`${m.metric}-${m.direction}`}>
                    {m.near && <span className="font-semibold text-ink">Close to the line: </span>}
                    {m.text}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-faint">
                From the last stored statements; a new report can move it either way. A distance, not a goal.
              </p>
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Analysis</dt>
          <dd className="text-ink">{FRESHNESS_LABEL[tower.freshness]}</dd>
          {tower.analysis_age_days !== null && (
            <dd className="text-ink-muted">Last analysed {tower.analysis_age_days} days ago</dd>
          )}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Land</dt>
          <dd className="text-ink">{LAND_LABEL[tower.land]}</dd>
          <dd className="text-ink-muted">{tower.land_reason}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Thesis</dt>
          <dd className="text-ink">{THESIS_LABEL[tower.thesis]}</dd>
          {tower.thesis === "breached" && (
            <dd className="text-ink-muted">
              {tower.tripwires_fired} {tower.tripwires_fired === 1 ? "tripwire has" : "tripwires have"} fired:
              re-read the thesis before doing anything.
            </dd>
          )}
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Under siege</dt>
          <dd className="text-ink">{describeSiegeExposure(tower)}</dd>
          {tower.shared_wall_with.length > 0 && (
            <dd className="text-ink-muted">
              Shares a weak wall with {tower.shared_wall_with.join(", ")}: they have moved together, so a
              blow to one is likely to reach the other.
            </dd>
          )}
          <dd className="mt-1 text-xs text-ink-faint">
            A stored what-if, not a forecast, and not advice to buy or sell.
          </dd>
        </div>
      </dl>
      {!compact && (
        <p className="mt-4 text-sm">
          <Link to={`/holdings/${tower.holding_id}`} className="font-medium text-accent hover:underline">
            Open the holding page →
          </Link>
        </p>
      )}
    </Card>
  );
}
