import { Link } from "react-router-dom";
import RavensCard from "../components/fortress/RavensCard";
import type { Ravens } from "../lib/types";
import { PANEL_CLOSE, PANEL_PLAIN, RAVENS_PANEL_TITLE } from "./watchWordsV1";

/**
 * The ravens panel (S16, PR 2): the flat Fortress's own Ravens card in the world, with its own "Read the report" button
 * and "Mark as seen". "Seen" is the same per-browser list the flat page keeps, so a raven marked here is gone there too and
 * the birds on the perch follow. Nothing is copied; no line says what to do.
 */
export default function RavensPanel({
  ravens,
  seen,
  onSeen,
  onClose,
}: {
  ravens: Ravens;
  seen: Set<string>;
  onSeen: (ids: string[]) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label={RAVENS_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[20%]"
    >
      <header className="g3d-head">
        <h2>{RAVENS_PANEL_TITLE}</h2>
        <span className="flex items-center gap-2">
          <Link to="/fortress" className="g3d-btn">{PANEL_PLAIN}</Link>
          <button type="button" className="g3d-x" aria-label={PANEL_CLOSE} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded bg-surface p-2">
        <RavensCard ravens={ravens} seen={seen} onSeen={onSeen} />
      </div>
    </aside>
  );
}
