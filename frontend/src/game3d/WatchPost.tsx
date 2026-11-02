import { useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import { INK, PAL, Part } from "./Inked";
import { WATCH_FACING, WATCH_POST, WATCH_SOLID, watchLook } from "./watchPlan";
import { WATCH_SIGN } from "./watchWordsV1";
import type { NightWatchStatus } from "../lib/types";

/** Warm lantern light, never red or green. */
const FLAME = "#ffd36b";

/** Dark ink on cream. The mark after the name ("!" needs a look, "?" not reporting) means colour is never the only signal. */
function paintPlate(mark: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = PAL.cream;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = PAL.timberDark;
  g.lineWidth = 8;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 40px "Segoe UI", system-ui, sans-serif`;
  g.fillText(mark ? `${WATCH_SIGN} ${mark}` : WATCH_SIGN, c.width / 2, c.height / 2, c.width - 28);
  return c;
}

/**
 * The Night Watch post (S16, PR 2): a timber post with a lantern and a name plate. Code-built shapes with the usual ink
 * outline. The lantern is lit when the watch reported in and dark when it did not; the plate adds "!" for a night that
 * needs a look and "?" for a watch that is not reporting (or cannot be read). It uses a bright material, not a real light,
 * so it costs nothing and flat neutral lighting stays. Nothing moves, so reduced motion needs nothing.
 */
export default function WatchPost({ status }: { status: NightWatchStatus | null }) {
  const look = watchLook(status);
  const tex = useMemo(() => {
    const t = new CanvasTexture(paintPlate(look.mark));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [look.mark]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <RigidBody type="fixed" colliders={false} position={[WATCH_POST.x, 0, WATCH_POST.z]} rotation={[0, WATCH_FACING, 0]}>
      <CuboidCollider args={[WATCH_SOLID, 1.8, WATCH_SOLID]} position={[0, 1.8, 0]} />
      <Part color={PAL.slateDark} position={[0, 0.15, 0]} grow={1.06}>
        <cylinderGeometry args={[0.6, 0.66, 0.3, 9]} />
      </Part>
      <Part color={PAL.timberDark} position={[0, 1.7, 0]} grow={1.12}>
        <boxGeometry args={[0.24, 3.0, 0.24]} />
      </Part>
      {/* Arm and hook, then the lantern: iron frame, glass that is bright only when the watch reported in. */}
      <Part color={PAL.timber} position={[0.4, 3.15, 0]} grow={1.12}>
        <boxGeometry args={[0.9, 0.14, 0.14]} />
      </Part>
      <Part color={PAL.iron} position={[0.8, 2.85, 0]} grow={1.12}>
        <boxGeometry args={[0.46, 0.08, 0.46]} />
      </Part>
      <Part color={look.lit ? FLAME : PAL.glass} position={[0.8, 2.6, 0]} grow={1.1} ink>
        <boxGeometry args={[0.34, 0.42, 0.34]} />
      </Part>
      <Part color={PAL.iron} position={[0.8, 2.34, 0]} grow={1.12}>
        <boxGeometry args={[0.46, 0.08, 0.46]} />
      </Part>
      {/* Name plate on the post. */}
      <Part color={PAL.timber} position={[0, 1.35, 0.16]} grow={1.04}>
        <boxGeometry args={[1.0, 0.42, 0.06]} />
      </Part>
      <mesh position={[0, 1.35, 0.2]}>
        <planeGeometry args={[0.92, 0.35]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}
