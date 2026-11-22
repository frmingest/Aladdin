/**
 * Telling the page when the 3D world is drawn (#479). Two small pieces that live inside the canvas:
 *
 *  - `SceneReady` sits inside the same Suspense boundary as the world. React mounts it only once everything in that
 *    boundary has loaded, and when a later load (a place's models) suspends the boundary again, React hides the content
 *    and runs this layout effect's cleanup, so the page hears "not drawn" again. No timers, no guessing.
 *  - `LoadProgress` sits outside that boundary, so it keeps running while the world is suspended, and passes on the
 *    three.js loader's own percentage (drei's `useProgress`), whole percents only, so the page re-renders a few dozen
 *    times at most per load.
 *
 * Most models load inside their own small Suspense boundaries (Avatar, KeepModels, Horizon...), so the world's boundary
 * can resolve while they are still arriving. The page therefore shows the line until both say done: the world is up AND
 * the loader has nothing in flight (percent null).
 *
 * Neither draws anything. The page shows the line (`LoadingLine.tsx`).
 */
import { useProgress } from "@react-three/drei";
import { useEffect, useLayoutEffect, useRef } from "react";

export function SceneReady({ onReady }: { onReady: (ready: boolean) => void }) {
  useLayoutEffect(() => {
    onReady(true);
    return () => onReady(false);
  }, [onReady]);
  return null;
}

export function LoadProgress({ onProgress }: { onProgress: (percent: number | null) => void }) {
  const active = useProgress((s) => s.active);
  const progress = useProgress((s) => s.progress);
  const last = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const next = active ? Math.max(0, Math.min(100, Math.floor(progress))) : null;
    if (next === last.current) return;
    last.current = next;
    onProgress(next);
  }, [active, progress, onProgress]);
  return null;
}
