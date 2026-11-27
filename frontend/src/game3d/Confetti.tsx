import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D } from "three";
import type { InstancedMesh } from "three";
import { CONFETTI_COLOURS, CONFETTI_COUNT, burstActive, heightAt, makePieces } from "./confettiLogic";
import { prefersReducedMotion } from "./motionPref";

/** Where the burst goes up by default: over the courtyard fountain. */
const FOUNTAIN = { x: 0, y: 3.2, z: 2 } as const;

/**
 * One instanced burst (about 150 flat pieces, one draw call) when `burstKey` changes to a number.
 * Nothing is allocated per frame, and nothing is drawn with reduced motion or between bursts.
 */
export default function Confetti({ burstKey, origin = FOUNTAIN }: { burstKey: number | null; origin?: { x: number; y: number; z: number } }) {
  const mesh = useRef<InstancedMesh>(null);
  const started = useRef<number | null>(null);
  const seen = useRef<number | null>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const pieces = useMemo(() => makePieces(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    pieces.forEach((p, i) => m.setColorAt(i, c.set(CONFETTI_COLOURS[p.colour])));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pieces]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    if (burstKey != null && burstKey !== seen.current) {
      seen.current = burstKey;
      started.current = prefersReducedMotion() ? null : state.clock.elapsedTime;
    }
    const t0 = started.current;
    const age = t0 == null ? -1 : state.clock.elapsedTime - t0;
    if (!burstActive(age)) {
      m.visible = false;
      return;
    }
    m.visible = true;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      dummy.position.set(origin.x + p.vx * age, origin.y + heightAt(p, age), origin.z + p.vz * age);
      dummy.rotation.set(p.spin * age, p.spin * age * 0.7, 0);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI_COUNT]} visible={false} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial side={2} toneMapped={false} />
    </instancedMesh>
  );
}
