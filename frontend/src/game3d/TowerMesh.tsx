import { useLayoutEffect, useRef } from "react";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { Object3D, type InstancedMesh } from "three";
import type { Flag, TowerView } from "./stateToWorld";

/** Pad top, so towers stand on it. */
const PAD_TOP = 0.5;
const MAX_CRENELS = 8;
const FOG_COLOR = "#dfe5ea";
const FLAG_COLOR: Record<Exclude<Flag, "none">, string> = {
  intact: "#4f8a4f",
  review: "#d6a53a",
  breached: "#b04a3f",
};
const IVY_COLOR = "#5d7f45";
const WATER_COLOR = "#4f7a95";
const CRACK_COLOR = "#1f1b19";

const dummy = new Object3D();

/** Teeth around the crown. Teeth missing from one side read as a broken crown. */
function Crown({ t }: { t: TowerView }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < MAX_CRENELS; i++) {
      const a = (i / MAX_CRENELS) * Math.PI * 2;
      dummy.position.set(Math.sin(a) * t.radius, PAD_TOP + t.height + 0.3, Math.cos(a) * t.radius);
      dummy.rotation.set(0, a, 0);
      dummy.scale.setScalar(i < t.crenels ? 1 : 0); // scale 0 hides the missing teeth
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [t.crenels, t.radius, t.height]);
  if (t.crenels === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_CRENELS]} castShadow>
      <boxGeometry args={[0.8, 0.6, 0.8]} />
      <meshStandardMaterial color={t.wallColor} flatShading />
    </instancedMesh>
  );
}

/** Dark cracks down the wall: more cracks, weaker wall. */
function Cracks({ t }: { t: TowerView }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < t.cracks; i++) {
      const a = 0.6 + i * 1.4;
      dummy.position.set(Math.sin(a) * (t.radius + 0.02), PAD_TOP + t.height * (0.35 + 0.12 * i), Math.cos(a) * (t.radius + 0.02));
      dummy.rotation.set(0, a, (i % 2 ? 1 : -1) * 0.25);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [t.cracks, t.radius, t.height]);
  if (t.cracks === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, t.cracks]}>
      <boxGeometry args={[0.18, t.height * 0.4, 0.08]} />
      <meshStandardMaterial color={CRACK_COLOR} flatShading />
    </instancedMesh>
  );
}

/** One holding as a tower. Everything here comes from the TowerView, nothing else. */
export default function TowerMesh({ t }: { t: TowerView }) {
  const bodyColor = t.fog ? FOG_COLOR : t.wallColor;
  const sides = t.shape === "keep" ? 14 : t.shape === "outpost" ? 4 : 8;
  const ivy = t.freshness === "weathered" ? 0.25 : t.freshness === "overgrown" ? 0.55 : 0;
  const flag = t.flag === "none" || t.fog ? null : t.flag;
  return (
    <group position={[t.spot.x, 0, t.spot.z]}>
      {/* Moat: water ring when surveyed, pale mist when not. Visual only. */}
      {(t.moatWidth > 0 || t.moatFog) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[t.radius + 2.2, t.radius + 2.2 + (t.moatFog ? 1 : t.moatWidth), 32]} />
          <meshStandardMaterial
            color={t.moatFog ? FOG_COLOR : WATER_COLOR}
            transparent={t.moatFog}
            opacity={t.moatFog ? 0.45 : 1}
            flatShading
          />
        </mesh>
      )}

      <RigidBody type="fixed" colliders={false} position={[0, PAD_TOP + t.height / 2, 0]}>
        <CylinderCollider args={[t.height / 2, t.radius]} />
        <mesh castShadow receiveShadow rotation={[0, sides === 4 ? Math.PI / 4 : 0, 0]}>
          <cylinderGeometry args={[t.radius, t.radius + 0.25, t.height, sides]} />
          <meshStandardMaterial color={bodyColor} flatShading transparent={t.fog} opacity={t.fog ? 0.55 : 1} />
        </mesh>
      </RigidBody>

      {!t.fog && <Crown t={t} />}
      {!t.fog && <Cracks t={t} />}

      {/* Ivy band: ageing or stale analysis. */}
      {ivy > 0 && !t.fog && (
        <mesh position={[0, PAD_TOP + (t.height * ivy) / 2, 0]}>
          <cylinderGeometry args={[t.radius + 0.28, t.radius + 0.33, t.height * ivy, sides]} />
          <meshStandardMaterial color={IVY_COLOR} flatShading />
        </mesh>
      )}

      {/* Thesis flag on a pole. Breached hangs low and askew. */}
      {flag && (
        <group position={[0, PAD_TOP + t.height + 0.6, 0]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.4, 6]} />
            <meshStandardMaterial color="#3a3028" flatShading />
          </mesh>
          <mesh position={[0.55, flag === "breached" ? 1.1 : 2, 0]} rotation={[0, 0, flag === "breached" ? -0.5 : 0]}>
            <boxGeometry args={[1.1, 0.7, 0.05]} />
            <meshStandardMaterial color={FLAG_COLOR[flag]} flatShading />
          </mesh>
        </group>
      )}

      {/* Name only. The facts are in the panel (3D carries mood and navigation). */}
      <Html position={[0, PAD_TOP + t.height + 4.2, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-xs text-white">
          {t.fog ? `${t.name} (not surveyed)` : t.name}
        </div>
      </Html>
    </group>
  );
}
