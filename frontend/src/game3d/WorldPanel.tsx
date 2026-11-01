import { useState } from "react";
import { Link } from "react-router-dom";
import { embedUrl, flatUrl } from "./parity3d";
import type { Door } from "./parity3d";
import { BACK_TO_MENU, CLOSE_PAGE, LOADING_PAGE, OPEN_FLAT } from "./worldWordsV1";

interface Props {
  door: Door;
  onBack: () => void;
  onClose: () => void;
}

/**
 * A flat page shown inside the world. It is the page itself, loaded in a frame with `?embed=world` (no
 * sidebar), so every number comes from the same code as the flat route and nothing is copied. Links inside
 * stay inside the frame; "Open the flat page" leaves the world for the full page.
 */
export default function WorldPanel({ door, onBack, onClose }: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <aside
      aria-label={door.title}
      className="g3d-panel absolute inset-x-3 bottom-3 top-14 z-40 flex flex-col overflow-hidden p-2 text-sm md:inset-x-[8%]"
    >
      <header className="g3d-head">
        <h2>{door.title}</h2>
        <span className="flex items-center gap-2">
          <button type="button" className="g3d-btn" onClick={onBack}>{BACK_TO_MENU}</button>
          <Link to={flatUrl(door)} className="g3d-btn">{OPEN_FLAT}</Link>
          <button type="button" className="g3d-x" aria-label={CLOSE_PAGE} onClick={onClose}>×</button>
        </span>
      </header>
      {!loaded && <p className="g3d-muted mt-2">{LOADING_PAGE}</p>}
      <iframe
        key={door.route}
        title={door.title}
        src={embedUrl(door)}
        onLoad={() => setLoaded(true)}
        className="mt-2 min-h-0 w-full flex-1 rounded border-0 bg-surface"
      />
    </aside>
  );
}
