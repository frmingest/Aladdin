import { WHERE_HINT, WHERE_TITLE } from "./signpostSpot";
import { doorsAt, placesWithDoors } from "./parity3d";
import type { Door } from "./parity3d";

/**
 * "Where to?": every built page of the app, sorted into the places of the world. Picking one opens
 * it in the world panel. Two taps from anywhere: the button (or G, or E at the signpost), then the pick.
 */
export default function WorldMenu({ onPick, onClose }: { onPick: (door: Door) => void; onClose: () => void }) {
  return (
    <aside aria-label={WHERE_TITLE} className="g3d-panel g3d-slide absolute right-3 top-16 z-30 max-h-[calc(100%-6rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto p-3">
      <div className="g3d-head">
        <h2>{WHERE_TITLE}</h2>
        <button type="button" className="g3d-x" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <p className="g3d-muted mt-1">{WHERE_HINT}</p>
      {placesWithDoors().map((p) => (
        <section key={p.id} className="g3d-card" aria-label={p.title}>
          <p className="g3d-tag">{p.title}</p>
          <ul className="mt-1 space-y-1">
            {doorsAt(p.id).map((d) => (
              <li key={d.route}>
                <button type="button" className="g3d-btn w-full text-left" title={d.blurb} onClick={() => onPick(d)}>
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
