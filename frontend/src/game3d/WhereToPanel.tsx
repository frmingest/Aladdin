import { doorsAt, placesWithDoors } from "./parity3d";
import type { Door } from "./parity3d";
import { MENU_HINT, MENU_INTRO, MENU_TITLE } from "./worldWordsV1";

interface Props {
  onPick: (door: Door) => void;
  onClose: () => void;
}

/**
 * The signpost menu: every built page of the flat app, sorted into the places of the world. Picking one
 * opens it in the world panel (two taps from anywhere: G or the button, then the page). The list comes
 * from the parity register, so a page added to the app shows up here once it has a row.
 */
export default function WhereToPanel({ onPick, onClose }: Props) {
  return (
    <aside
      aria-label={MENU_TITLE}
      className="g3d-panel g3d-slide absolute bottom-3 left-3 top-14 z-30 w-96 max-w-[94%] overflow-y-auto p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>🪧 {MENU_TITLE}</h2>
        <button type="button" className="g3d-x" aria-label="Close the signpost" onClick={onClose}>×</button>
      </header>
      <p className="g3d-muted mt-1">{MENU_INTRO}</p>
      {placesWithDoors().map((place) => (
        <section key={place.id} className="g3d-card" aria-label={place.title}>
          <h3>{place.title}</h3>
          <p className="g3d-tag">{place.will}</p>
          <ul className="mt-1 space-y-1">
            {doorsAt(place.id).map((d) => (
              <li key={d.route}>
                <button type="button" className="g3d-btn w-full text-left" onClick={() => onPick(d)}>
                  <strong>{d.title}</strong>
                  <span className="g3d-muted block">{d.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="g3d-muted mt-3">{MENU_HINT}</p>
    </aside>
  );
}
