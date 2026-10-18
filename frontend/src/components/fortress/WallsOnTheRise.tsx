import { useMemo } from "react";
import type { GameTower } from "../../lib/types";
import { riseRows, rungWord } from "../../lib/wallRise";
import { Card } from "../ui";
import WallRiseGauge from "./kit/WallRiseGauge";

/** Fortress home: every keep's wall and how far it stands from the next rung up, closest first.
 * Read from the stored statements; the rungs are decided by the backend and only measured here.
 * Press a row to open that tower's survey (the same as pressing the tower). */
export default function WallsOnTheRise({
  towers,
  selectedId,
  onSelect,
}: {
  towers: GameTower[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => riseRows(towers), [towers]);
  if (rows.length === 0) return null;
  const climbing = rows.filter((r) => r.rise.kind === "climbing").length;
  return (
    <Card className="print:hidden">
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 40 32" width="40" height="32" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-ink-muted">
          <path d="M2 30h36M4 30V22h8v8M12 30V14h8v16M20 30V6h8v24M28 30V16h8v14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M24 6V1l6 2-6 2" fill="currentColor" opacity="0.7" />
        </svg>
        <div className="min-w-0">
          <h2 className="section-title">Walls on the rise</h2>
          <p className="text-sm text-ink-muted">
            How far each wall stands from the next rung. {climbing > 0 ? "Nearest rung first." : "Nothing to climb right now."}
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-border-subtle">
        {rows.map(({ tower, rise }) => {
          const on = tower.holding_id === selectedId;
          return (
            <li key={tower.holding_id}>
              <button
                type="button"
                onClick={() => onSelect(tower.holding_id)}
                aria-pressed={on}
                className={`grid w-full min-h-[44px] grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 rounded-md px-2 py-2 text-left transition-colors hover:bg-raised sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,9rem)] ${on ? "bg-accent-subtle" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{tower.name}</span>
                  <span className="block text-xs text-ink-faint">{rungWord(rise.rung)} walls</span>
                </span>
                <WallRiseGauge rise={rise} compact />
                <span className="col-span-2 text-xs text-ink-muted sm:col-span-1">
                  {rise.kind === "top"
                    ? "Top rung"
                    : rise.kind === "unmeasured"
                      ? "Not measured: no ratio stored"
                      : `${rise.next ? rungWord(rise.next) : "Next rung"} is next`}
                  {rise.slipping && <span className="block text-caution">Close to a weaker rung too</span>}
                  {rise.heldBack && <span className="block text-ink-faint">Thin interest cover holds it down</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">
        From the last stored statements; a new report can move a wall either way. Press a row for the numbers.
      </p>
    </Card>
  );
}
