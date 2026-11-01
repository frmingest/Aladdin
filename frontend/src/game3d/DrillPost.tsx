import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import { DRILL_POST, DRILL_POST_FACING } from "./stormDrill";

/**
 * The drill post: a timber stake with a board and a blue pennant, where you start a Storm Drill.
 * Plain code-built shapes with the usual ink outline. Furniture only: it carries no fact and
 * does not move (so reduced motion needs nothing).
 */
export default function DrillPost() {
  return (
    <RigidBody type="fixed" colliders={false} position={[DRILL_POST.x, 0, DRILL_POST.z]} rotation={[0, DRILL_POST_FACING, 0]}>
      <CuboidCollider args={[0.9, 1.2, 0.2]} position={[0, 1.2, 0]} />
      {([-0.8, 0.8] as const).map((x) => (
        <Part key={x} color={PAL.timberDark} position={[x, 1.2, 0]} grow={1.2}>
          <boxGeometry args={[0.16, 2.4, 0.16]} />
        </Part>
      ))}
      <Part color={PAL.timberLight} position={[0, 1.9, 0.02]} grow={1.08}>
        <boxGeometry args={[1.9, 0.9, 0.1]} />
      </Part>
      {/* Two crossed strokes on the board: a target mark, no words to read. */}
      <Part color={PAL.iron} position={[0, 1.9, 0.09]} grow={1.1} ink={false}>
        <boxGeometry args={[0.9, 0.12, 0.04]} />
      </Part>
      <Part color={PAL.iron} position={[0, 1.9, 0.09]} grow={1.1} ink={false}>
        <boxGeometry args={[0.12, 0.6, 0.04]} />
      </Part>
      <Part color={PAL.teal} position={[0, 2.65, 0]} grow={1.15}>
        <boxGeometry args={[0.9, 0.35, 0.05]} />
      </Part>
    </RigidBody>
  );
}
