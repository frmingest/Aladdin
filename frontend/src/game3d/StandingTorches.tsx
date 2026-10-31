import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import type { Mesh } from "three";
import { Part, PAL } from "./Inked";
import { prefersReducedMotion } from "./motionPref";
import { STANDING_TORCHES, STANDING_TORCH_SOLID, litTorches } from "./standingTorches";

const FLAME = "#f2b84b"; // one warm gold for every level: nothing here can read as a status colour
const EMBER = "#2a2826";

function Flame({ still }: { still: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m || still) return;
    const t = clock.elapsedTime;
    m.scale.set(1, 1 + 0.12 * Math.sin(t * 9 + m.position.x), 1);
  });
  return (
    <mesh ref={ref} position={[0, 1.78, 0]}>
      <coneGeometry args={[0.2, 0.5, 6]} />
      <meshBasicMaterial color={FLAME} toneMapped={false} />
    </mesh>
  );
}

/**
 * Standing torches by the gate road: one burns per level you hold. Level 0, or a Standing that
 * could not be read, burns none. Code-built posts with the same ink outline as the other props;
 * no light source is added (the flame is a flat glowing cone), so draw calls stay low.
 * Reduced motion: the flames hold still.
 */
export default function StandingTorches({ level }: { level: number | null }) {
  const lit = litTorches(level);
  const still = prefersReducedMotion();
  return (
    <>
      {STANDING_TORCHES.map((t, i) => (
        <RigidBody key={t.id} type="fixed" colliders={false} position={[t.x, 0, t.z]}>
          <CylinderCollider args={[0.9, STANDING_TORCH_SOLID]} position={[0, 0.9, 0]} />
          <Part color={PAL.timberDark} position={[0, 0.8, 0]} grow={1.18}>
            <cylinderGeometry args={[0.1, 0.14, 1.6, 8]} />
          </Part>
          <Part color={PAL.iron} position={[0, 1.65, 0]} grow={1.12}>
            <cylinderGeometry args={[0.28, 0.16, 0.2, 10]} />
          </Part>
          {i < lit ? (
            <Flame still={still} />
          ) : (
            <mesh position={[0, 1.76, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.04, 10]} />
              <meshStandardMaterial color={EMBER} flatShading />
            </mesh>
          )}
        </RigidBody>
      ))}
    </>
  );
}
