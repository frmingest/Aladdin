import { Link, useNavigate } from "react-router-dom";
import RealmVerdict from "../components/fortress/RealmVerdict";
import { summarizeRealm } from "../lib/realmVerdict";
import type { GameState } from "../lib/types";
import { REALM_CLOSE, REALM_PANEL_TITLE } from "./realmWordsV1";
import { PLAIN_VIEW_LINK } from "./glossaryWordsV1";

/**
 * The Realm panel (S16, PR 3): the flat Fortress's own verdict card on the whole fortress, in the world. The level, the
 * headline and every line come from `summarizeRealm`, the same function the flat page calls, so the pennant on the post
 * and this card cannot disagree. Nothing is recomputed and nothing is written.
 */
export default function RealmPanel({ state, onClose }: { state: GameState; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <aside
      aria-label={REALM_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[20%]"
    >
      <header className="g3d-head">
        <h2>{REALM_PANEL_TITLE}</h2>
        <span className="flex items-center gap-2">
          <Link to="/fortress" className="g3d-btn">{PLAIN_VIEW_LINK}</Link>
          <button type="button" className="g3d-x" aria-label={REALM_CLOSE} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded bg-surface p-2">
        <RealmVerdict game verdict={summarizeRealm(state)} count={state.towers.length} onOpenHolding={(id) => navigate(`/holdings/${id}`)} />
      </div>
    </aside>
  );
}
