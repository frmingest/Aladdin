import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Texture } from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { MarkRig, LampRig, yawOfQuaternion } from "./markRig";
import type { LampAt } from "./markRig";
import type { PlacedMarks } from "./marks";
import { prefersReducedMotion, subscribeReducedMotion } from "./motionPref";

/** The reduced-motion setting, followed live. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
}

/** In reduced motion the smoke is posed again when the camera has turned this far (radians), so it never goes edge-on. */
const RE_POSE_YAW = 0.2;

/** The smoke sprite the chimneys already use. */
const SMOKE_SPRITE = "/fx/smoke_soft.png";

/**
 * The yard's marks (#412 step 2): ravens over roofs, a tall thin smoke behind a roof, a bell at a door. All from `placed`,
 * which `marks.ts` worked out from stored facts; this component only draws. One instanced mesh per kind, no light, no
 * collider, ONE frame loop. With reduced motion the loop poses everything once and then does nothing, so every mark still
 * stands. Mount it inside Suspense: the smoke sprite loads on first use.
 */
export default function MarkLayer({ placed }: { placed: PlacedMarks }) {
  const wantSmoke = placed.smoke.length > 0;
  return wantSmoke ? <WithSmoke placed={placed} /> : <Layer placed={placed} map={null} />;
}

function WithSmoke({ placed }: { placed: PlacedMarks }) {
  const map = useTexture(SMOKE_SPRITE);
  return <Layer placed={placed} map={map} />;
}

function Layer({ placed, map }: { placed: PlacedMarks; map: Texture | null }) {
  const rig = useMemo(() => new MarkRig(placed, map), [placed, map]);
  const reduced = useReducedMotion();
  useEffect(() => () => rig.dispose(), [rig]);
  const posed = useRef<{ rig: MarkRig; yaw: number; reduced: boolean } | null>(null);
  useFrame((state) => {
    const yaw = yawOfQuaternion(state.camera.quaternion);
    if (reduced) {
      // Posed again only when the rig, the setting or the camera's turn changed: still no per-frame write otherwise.
      const p = posed.current;
      if (p && p.rig === rig && p.reduced && Math.abs(Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw))) < RE_POSE_YAW) return;
      posed.current = { rig, yaw, reduced: true };
      rig.update(0, true, yaw);
      return;
    }
    posed.current = null;
    rig.update(state.clock.elapsedTime, false, yaw);
  });
  return <primitive object={rig.group} />;
}

/**
 * Hanging lamps for lit stalls, or the one under the arch. `lamps` are points in the parent's frame. Steady when reduced.
 * Two instanced meshes, no light.
 */
export function HangingLamps({ lamps, perfGroup }: { lamps: readonly LampAt[]; perfGroup?: string }) {
  const rig = useMemo(() => new LampRig(lamps, perfGroup), [lamps, perfGroup]);
  const reduced = useReducedMotion();
  useEffect(() => () => rig.dispose(), [rig]);
  // A switch to reduced motion settles the glass at once.
  useEffect(() => {
    if (reduced) rig.update(0, true);
  }, [rig, reduced]);
  useFrame((state) => {
    if (!reduced) rig.update(state.clock.elapsedTime, false);
  });
  return lamps.length > 0 ? <primitive object={rig.group} /> : null;
}
