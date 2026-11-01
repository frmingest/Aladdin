import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import { SIGNPOST, SIGNPOST_FACING } from "./signpostSpot";

/**
 * The signpost: a timber post with three arrow boards and a blue pennant, just inside the gate.
 * Plain code-built shapes with the usual ink outline. Furniture only: it carries no fact and
 * does not move (so reduced motion needs nothing).
 */
export default function SignPost() {
  return (
    <RigidBody type="fixed" colliders={false} position={[SIGNPOST.x, 0, SIGNPOST.z]} rotation={[0, SIGNPOST_FACING, 0]}>
      <CuboidCollider args={[0.3, 1.6, 0.3]} position={[0, 1.6, 0]} />
      <Part color={PAL.timberDark} position={[0, 1.6, 0]} grow={1.2}>
        <boxGeometry args={[0.24, 3.2, 0.24]} />
      </Part>
      {([-0.6, 0.15, 0.9] as const).map((dy, i) => (
        <Part key={dy} color={i === 1 ? PAL.timberLight : PAL.timber} position={[i === 1 ? -0.35 : 0.35, 2.55 + dy * 0.45, 0.16]} grow={1.08}>
          <boxGeometry args={[1.5, 0.38, 0.08]} />
        </Part>
      ))}
      <Part color={PAL.teal} position={[0, 3.45, 0]} grow={1.15}>
        <boxGeometry args={[0.7, 0.3, 0.05]} />
      </Part>
    </RigidBody>
  );
}
