import { useMemo } from "react";
import type { Object3D } from "three";

/** One clone of a named node from an already-loaded model, placed, shadows on. Returns nothing if the node is missing. */
export default function NodeClone({
  source,
  name,
  scale,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  source: Object3D;
  name: string;
  scale: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const obj = useMemo(() => {
    const n = source.getObjectByName(name);
    if (!n) return null;
    const c = n.clone(true);
    c.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return c;
  }, [source, name]);
  return obj ? <primitive object={obj} scale={scale} position={position} rotation={rotation} /> : null;
}
