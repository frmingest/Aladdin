import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, NormalBlending, Object3D } from "three";
import type { InstancedMesh } from "three";
import { SMOKE, SPARKS, fxState } from "./fxPlan";
import type { FxSpec } from "./fxPlan";
import { prefersReducedMotion } from "./motionPref";

/**
 * One column of rising sprites (smoke or sparks), one instanced draw call. The sprite is loaded when the column first
 * mounts, never preloaded; with reduced motion nothing is mounted at all. Decoration only.
 */
function Column({ spec, url, color, additive }: { spec: FxSpec; url: string; color: string; additive: boolean }) {
  const map = useTexture(url);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < spec.count; i++) {
      const s = fxState(spec, i, t);
      dummy.position.set(s.x, s.y, s.z);
      dummy.quaternion.copy(state.camera.quaternion);
      // Opacity is carried by size: a faded sprite shrinks to nothing, so one shared material serves all of them.
      dummy.scale.setScalar(Math.max(0.0001, s.size * (0.4 + 0.6 * (spec.alpha ? s.alpha / spec.alpha : 0))));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, spec.count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={additive ? 1 : spec.alpha}
        depthWrite={false}
        toneMapped={false}
        blending={additive ? AdditiveBlending : NormalBlending}
      />
    </instancedMesh>
  );
}

/** A soft grey plume. `position` is the chimney top. */
export function Smoke({ position }: { position: [number, number, number] }) {
  if (prefersReducedMotion()) return null;
  return (
    <group position={position}>
      <Suspense fallback={null}>
        <Column spec={SMOKE} url="/fx/smoke_soft.png" color="#c9c4bb" additive={false} />
      </Suspense>
    </group>
  );
}

/** A few warm sparks over a fire. `position` is the fire. */
export function Sparks({ position }: { position: [number, number, number] }) {
  if (prefersReducedMotion()) return null;
  return (
    <group position={position}>
      <Suspense fallback={null}>
        <Column spec={SPARKS} url="/fx/spark.png" color="#ffb347" additive />
      </Suspense>
    </group>
  );
}
