import { useEffect, useRef, useState } from "react";
import type { AreaRef } from "./areas";
import { LOADING_SLOW, loadingLine } from "./loadingWordsV2";
import { showLoading, useSceneLoad } from "./sceneLoadStore";

/** After this long the line adds that it is still working, so a slow line never looks frozen. */
export const SLOW_AFTER_MS = 20_000;

/**
 * The loading line (#479): a small parchment card in the middle of the scene while the world or a place is still being
 * drawn, so an empty sky or a dark room never looks like a broken page. Kit panel only (`g3d-panel`), no bar and no
 * number. Nothing moves, so reduced motion needs nothing. It never takes a click.
 *
 * The status region is always mounted and only its text changes, so screen readers announce it on the first load too.
 * It reads the scene's own store, so a load re-renders this card and nothing else. Hidden during a door's fade, where the
 * fade's name plate already says where you are going.
 */
export default function LoadingLine({ area, holdingName, hidden = false }: { area: AreaRef; holdingName?: string | null; hidden?: boolean }) {
  const load = useSceneLoad();
  const placeKey = `${area.id}:${"holdingId" in area ? area.holdingId : ""}`;
  // The place whose first full draw has happened. A later loader blip in the same place stays silent.
  const drawnFor = useRef<string | null>(null);
  if (load.ready && !load.busy) drawnFor.current = placeKey;
  const loading = !hidden && showLoading(load, drawnFor.current === placeKey);

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [loading, placeKey]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <p role="status" aria-live="polite" className={loading ? "g3d-panel g3d-loading px-4 py-3 text-sm" : "sr-only"}>
        {loading && (
          <>
            <span aria-hidden>🏰 </span>
            {loadingLine(area, holdingName)}
            {slow && <span className="g3d-muted block">{LOADING_SLOW}</span>}
          </>
        )}
      </p>
    </div>
  );
}
