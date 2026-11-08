import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import StaticBatch from "./StaticBatch";
import { QUARTER_GATE, QUARTER_GATE_FACING } from "./quarterPlan";
import { QUARTER_WORDS, archLine } from "./quarterWordsV1";
import WorldLabel from "./WorldLabel";

/**
 * The arch to the Market Quarter: two stout timber posts, a wide lintel and a cream and teal awning strip, east of the market
 * corner. Plain code-built shapes with the usual ink outline. The sign over it says how many stalls stand in the quarter and how
 * many are in range, in the flat page's own word; it says nothing while the watchlist is unread. The arch itself carries no fact
 * and does not move. The gap between the posts is open ground, so it never blocks a path.
 */
export default function QuarterArch({ counts }: { counts: { total: number; inRange: number } | null }) {
  const line = archLine(counts);
  return (
    <RigidBody type="fixed" colliders={false} position={[QUARTER_GATE.x, 0, QUARTER_GATE.z]} rotation={[0, QUARTER_GATE_FACING, 0]}>
      {([-2, 2] as const).map((x) => (
        <CuboidCollider key={x} args={[0.25, 2, 0.25]} position={[x, 2, 0]} />
      ))}
      <StaticBatch>
        {([-2, 2] as const).map((x) => (
          <Part key={x} color={PAL.timberDark} position={[x, 2, 0]} grow={1.1}>
            <boxGeometry args={[0.5, 4, 0.5]} />
          </Part>
        ))}
        <Part color={PAL.timberLight} position={[0, 4.1, 0]} grow={1.05}>
          <boxGeometry args={[5, 0.5, 0.45]} />
        </Part>
        <Part color={PAL.cream} position={[0, 3.55, 0.05]} grow={1.04}>
          <boxGeometry args={[3.6, 0.45, 0.08]} />
        </Part>
        <Part color={PAL.teal} position={[0, 3.55, 0.1]} grow={1.04}>
          <boxGeometry args={[0.8, 0.46, 0.08]} />
        </Part>
      </StaticBatch>
      <WorldLabel position={[0, 5.2, 0]} distanceFactor={14} ariaHidden>
          {QUARTER_WORDS.gateLabel}
          {line && (
            <>
              <br />
              {line}
            </>
          )}
        </WorldLabel>
    </RigidBody>
  );
}
