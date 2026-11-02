import { Link, useNavigate } from "react-router-dom";
import RealmVerdict from "../components/fortress/RealmVerdict";
import { SIEGE_LABEL } from "../lib/fortress";
import type { RealmVerdict as Verdict } from "../lib/realmVerdict";
import type { FortressSiegeLevel } from "../lib/types";
import { PANEL_CLOSE, PANEL_PLAIN, REALM_PANEL_TITLE } from "./realmWordsV1";

/**
 * The realm verdict panel (S16, PR 3): the flat Fortress's own RealmVerdict card in the world, so the words, the rules
 * and the "open these towers first" list are the flat page's own. The weather is named here in words, so the sky is
 * never the only way to know it. Opening a holding goes to its flat page.
 */
export default function RealmPanel({
  verdict,
  count,
  weather,
  onClose,
}: {
  verdict: Verdict;
  count: number;
  weather: FortressSiegeLevel | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <aside
      aria-label={REALM_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[20%]"
    >
      <header className="g3d-head">
        <h2>{REALM_PANEL_TITLE}</h2>
        <span className="flex items-center gap-2">
          <Link to="/fortress" className="g3d-btn">{PANEL_PLAIN}</Link>
          <button type="button" className="g3d-x" aria-label={PANEL_CLOSE} onClick={onClose}>×</button>
        </span>
      </header>
      <p className="g3d-muted mt-1" role="status">Weather: {SIEGE_LABEL[weather ?? "unsurveyed"]}</p>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded bg-surface p-2">
        <RealmVerdict verdict={verdict} count={count} onOpenHolding={(id) => navigate(`/holdings/${id}`)} />
      </div>
    </aside>
  );
}
