import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Group } from "three";
import { batchStatic, undoBatch } from "./staticBatch";

/** `/game3d?nobatch` turns batching off, to compare the same scene drawn the old way (a look-over aid). */
function batchingOff(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("nobatch")
    );
  } catch {
    return false;
  }
}

/**
 * Wrap pieces that are still and carry no fact (furniture, walls, scenery) and they are drawn in
 * one go: same look, far fewer draw calls. The batch is built once, after the pieces have mounted,
 * so wrap pieces that are already loaded (put this inside the Suspense, not around it).
 * A piece that shows a fact may be wrapped only with a `rebuildKey` that changes whenever that fact does: the
 * batch is then built again at once, so it always shows exactly what the pieces show. A mesh that animates
 * must carry `userData={{ noBatch: true }}` and stays out. Anything else that moves stays out of a batch.
 */
export default function StaticBatch({
  children,
  rebuildKey,
}: {
  children: ReactNode;
  rebuildKey?: string | number;
}) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || batchingOff()) return;
    const batch = batchStatic(root);
    return () => undoBatch(batch);
  }, [rebuildKey]);
  return <group ref={ref}>{children}</group>;
}
