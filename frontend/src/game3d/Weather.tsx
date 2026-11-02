import { cloudSlots, weatherLook } from "./weatherPlan";
import type { FortressSiegeLevel } from "../lib/types";

/**
 * Painted clouds over the walls (S16, PR 3): how many follows the backend's siege level (weatherPlan.ts). Flat colour,
 * no light, no animation, so flat neutral lighting stays and reduced motion needs nothing. Calm weather draws none.
 */
export default function Weather({ level }: { level: FortressSiegeLevel | null }) {
  const look = weatherLook(level);
  const color = look.cloudColor;
  const slots = cloudSlots(look.clouds);
  if (slots.length === 0) return null;
  return (
    <group>
      {slots.map((s, i) => (
        <group key={i} position={[s.x, s.y, s.z]} scale={s.s}>
          {(
            [
              [0, 0, 0, 7],
              [6.5, -1, 1, 5.2],
              [-6, -1.2, -1, 5.6],
              [2.5, 2.2, 0, 4.4],
            ] as const
          ).map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]} scale={[1.5, 0.62, 1]}>
              <sphereGeometry args={[r, 14, 10]} />
              <meshBasicMaterial color={color} fog={false} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
