import { Link } from "react-router-dom";
import { PATCH_LOOK, fogSlots } from "../../../lib/realmMap";
import { weightText } from "../../../lib/rituals";
import type { TowerFog } from "../../../lib/survey";
import { PatchMark } from "./FogPatch";
import "./realmMap.css";

/** The survey slate (Cartographer's table, win 3): the five checks of the tower you pressed, each with
 * its patch, the printed word and the reason. It replaces the hover-only tooltips, so touch devices get
 * the reasons too. Facts only: no count of how many are clear, no percentage. */
export default function TowerSlate({ tower, hatchId, onClose }: { tower: TowerFog; hatchId: string; onClose: () => void }) {
  const slots = fogSlots(tower);
  return (
    <section className="map-slate p-3" aria-label={`Survey of ${tower.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            <Link to={`/holdings/${tower.holdingId}`} className="inline-block py-2 text-accent hover:underline">
              {tower.name}
            </Link>
          </h3>
          <p className="text-xs text-ink-muted">Weight {weightText(tower.weightPct === null ? null : String(tower.weightPct))}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] shrink-0 rounded-md border border-border px-3 text-sm text-ink hover:bg-raised"
        >
          Close
        </button>
      </div>
      <ul className="mt-1 divide-y divide-border-subtle">
        {slots.map((s) => (
          <li key={s.id} className="flex items-start gap-3 py-2">
            <PatchMark state={s.state} hatchId={hatchId} />
            <p className="min-w-0 text-sm">
              <span className="font-semibold">{PATCH_LOOK[s.state].word}</span>
              <span className="text-ink-muted"> · {s.label}</span>
              <span className="block text-xs text-ink-muted">{s.reason}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
