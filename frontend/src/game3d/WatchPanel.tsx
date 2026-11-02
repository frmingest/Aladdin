import { Link } from "react-router-dom";
import NightWatchCard from "../components/fortress/NightWatchCard";
import { PANEL_CLOSE, PANEL_PLAIN, WATCH_PANEL_TITLE } from "./watchWordsV1";

/**
 * The Night Watch panel (S16, PR 2): the flat Fortress's own Night Watch card in the world. It reads the dispatch the
 * worker stored overnight, exactly as the flat page does; every word and line is the card's own, so the two cannot disagree.
 */
export default function WatchPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-label={WATCH_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[20%]"
    >
      <header className="g3d-head">
        <h2>{WATCH_PANEL_TITLE}</h2>
        <span className="flex items-center gap-2">
          <Link to="/fortress" className="g3d-btn">{PANEL_PLAIN}</Link>
          <button type="button" className="g3d-x" aria-label={PANEL_CLOSE} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded bg-surface p-2">
        <NightWatchCard />
      </div>
    </aside>
  );
}
