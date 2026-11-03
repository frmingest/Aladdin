import { DoubleSide } from "three";
import { INK, PAL, Part } from "./Inked";
import type { LandCondition } from "./landCondition";

const BODY = "#d8c6a4";
const ROOF = PAL.timberDark;
const GHOST_COLOR = "#dfe5ea";
const RUBBLE_SPOTS: readonly [number, number][] = [
  [-1.2, 1.7], [0.2, 2.0], [1.3, 1.6], [-0.4, 2.4], [0.9, 2.5],
];

/**
 * One plain placeholder block that wears the condition ladder (S26 PR 1). It is how the ladder is drawn once, before any
 * dressing exists, and how the ghost and the neutral are drawn for every theme. Everything is still: nothing here moves,
 * so reduced motion changes nothing. Condition is shape, lean and rubble; the only colours are stone, timber and plaster
 * (no red, no green).
 *
 *   Sound    upright, stone footing, trimmed ridge, no props
 *   Failing  strong lean, a crack across the front, broken props, fallen pieces
 *   Ghost    the whole block pale and see-through, in a mist disc, no detail
 *   Neutral  plain and upright, with no footing and no trim, so it never reads as Sound
 */
export default function LandBlock({ condition, position = [0, 0, 0] }: { condition: LandCondition; position?: [number, number, number] }) {
  const c = condition;
  if (c.pale) {
    return (
      <group position={position}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.6, 24]} />
          <meshBasicMaterial color={GHOST_COLOR} transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[2.4, 2.4, 2]} />
          <meshStandardMaterial color={GHOST_COLOR} transparent opacity={0.5} flatShading side={DoubleSide} />
        </mesh>
      </group>
    );
  }
  const lean = (c.lean * Math.PI) / 180;
  const slots = Array.from({ length: c.gaps }, (_, i) => i);
  return (
    <group position={position}>
      {/* The footing is the proud part: full on Sound, half on Solid, none on the rest and on the neutral. */}
      {c.trim > 0 && (
        <Part color={PAL.slate} position={[0, 0.1 * c.trim + 0.05, 0]} grow={1.05}>
          <boxGeometry args={[2.7, 0.2 * c.trim + 0.1, 2.3]} />
        </Part>
      )}
      <group rotation={[0, 0, -lean]}>
        <Part color={BODY} position={[0, 1.2, 0]} grow={1.03}>
          <boxGeometry args={[2.4, 2.2, 2]} />
        </Part>
        <Part color={ROOF} position={[0, 2.5, 0]} grow={1.04}>
          <boxGeometry args={[2.8, 0.4, 2.4]} />
        </Part>
        {c.trim >= 1 && (
          <Part color={PAL.slate} position={[0, 2.8, 0]} grow={1.08}>
            <boxGeometry args={[2.9, 0.18, 0.3]} />
          </Part>
        )}
        {/* Gaps: dark slits in the front where slats are missing. */}
        {slots.map((i) => (
          <mesh key={i} position={[-1.0 + (i % 4) * 0.66, 0.55 + Math.floor(i / 4) * 0.9, 1.02]}>
            <boxGeometry args={[0.32, 0.5, 0.05]} />
            <meshBasicMaterial color={PAL.void} />
          </mesh>
        ))}
        {/* Patches: plain lighter squares. */}
        {Array.from({ length: c.patches }, (_, i) => (
          <mesh key={i} position={[0.7 - i * 1.3, 1.6, 1.03]}>
            <boxGeometry args={[0.55, 0.45, 0.04]} />
            <meshStandardMaterial color={PAL.timberLight} flatShading />
          </mesh>
        ))}
        {/* The crack: three thin dark bars across the front. */}
        {c.crack > 0 &&
          [0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.3 + i * 0.35, 1.0 + (i % 2) * 0.7, 1.04]} rotation={[0, 0, i % 2 ? 0.7 : -0.7]}>
              <boxGeometry args={[0.1, 0.9, 0.04]} />
              <meshBasicMaterial color={INK} />
            </mesh>
          ))}
        {/* Loose boards hanging off the roof edge. */}
        {Array.from({ length: c.looseBoards }, (_, i) => (
          <mesh key={i} position={[1.35 - i * 0.6, 2.1, 1.25]} rotation={[0.6 + i * 0.2, 0, 0.3 * (i % 2 ? 1 : -1)]}>
            <boxGeometry args={[0.12, 0.8, 0.3]} />
            <meshStandardMaterial color={PAL.timber} flatShading />
          </mesh>
        ))}
      </group>
      {/* Props lean against the low side; broken ones are short and cracked off at an angle. */}
      {Array.from({ length: c.props }, (_, i) => {
        const broken = i < c.brokenProps;
        return (
          <mesh key={i} position={[1.6 + (i % 2) * 0.3, broken ? 0.45 : 0.85, -0.7 + i * 0.7]} rotation={[0, 0, broken ? 0.9 : 0.5]}>
            <boxGeometry args={[0.16, broken ? 0.9 : 1.7, 0.16]} />
            <meshStandardMaterial color={PAL.timberDark} flatShading />
          </mesh>
        );
      })}
      {/* Fallen pieces on the ground in front. */}
      {RUBBLE_SPOTS.slice(0, c.rubble).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.15, z]} rotation={[0.3 * i, 0.7 * i, 0.2]}>
          <boxGeometry args={[0.45, 0.3, 0.4]} />
          <meshStandardMaterial color={PAL.slateDark} flatShading />
        </mesh>
      ))}
    </group>
  );
}
