import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";
import { HOLDING_URL } from "./holdingPieces";
import type { HoldingTheme } from "./holdingPieces";

/** One clone of a named node from holding-<theme>.glb, placed. The pieces are still and carry no fact, so they ride the static batch. */
export default function HoldingPiece({ theme, node, scale, position, rotation = [0, 0, 0] }: { theme: HoldingTheme; node: string; scale: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const gltf = useGLTF(HOLDING_URL(theme));
  const object = useMemo<Object3D | null>(() => {
    const found = gltf.scene.getObjectByName(node);
    if (!found) return null;
    const copy = found.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [gltf, node]);
  if (!object) return null;
  return <primitive object={object} scale={scale} position={position} rotation={rotation} />;
}
