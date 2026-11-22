/**
 * Telling the page when the 3D world is drawn (#479). Two small pieces inside the canvas write to one tiny store
 * (`sceneLoadStore.ts`); only the loading line reads it, so a load never re-renders the page or the scene.
 *
 *  - `SceneReady` sits inside the same Suspense boundary as the world. React mounts it only once everything in that
 *    boundary has loaded, and when a later load (a place's models) suspends the boundary again, React hides the content
 *    and runs this layout effect's cleanup (React 18.3 with the R3F reconciler), so the store hears "not drawn" again.
 *  - `LoadProgress` sits outside that boundary, so it keeps running while the world is suspended, and passes on whether
 *    the three.js loader has anything in flight (drei's `useProgress`). Only the yes/no: the loader's percent counts
 *    files known so far, so it can run backwards, and a bar would read like quest progress (#479 design review).
 *
 * Most models load inside their own small Suspense boundaries (Avatar, KeepModels, Horizon...), so the world's boundary
 * can resolve while they are still arriving; the line uses both signals (`LoadingLine.tsx`).
 */
import { useProgress } from "@react-three/drei";
import { useEffect, useLayoutEffect } from "react";
import { setSceneBusy, setSceneReady } from "./sceneLoadStore";

export function SceneReady() {
  useLayoutEffect(() => {
    setSceneReady(true);
    return () => setSceneReady(false);
  }, []);
  return null;
}

export function LoadProgress() {
  useEffect(() => {
    // three.js starts a load inside another component's render, and drei's store updates right then. Reading it with
    // the hook would re-render this component mid-render (React's "Cannot update a component while rendering a
    // different component" warning, a console error on the dev server the E2E job runs). So: subscribe to the store
    // directly, and pass the change on after the current render.
    let alive = true;
    const push = (busy: boolean) =>
      queueMicrotask(() => {
        if (alive) setSceneBusy(busy);
      });
    push(useProgress.getState().active);
    const off = useProgress.subscribe((s, prev) => {
      if (s.active !== prev.active) push(s.active);
    });
    return () => {
      alive = false;
      off();
      setSceneBusy(false);
    };
  }, []);
  return null;
}
