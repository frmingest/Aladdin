import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import { SIGN, SIGN_FACING } from "./signpost";

/** Three arrow boards, turned a little apart, at fixed heights. Shape only: no words, no data. */
const BOARDS = [
  { y: 2.7, yaw: -0.5, color: PAL.timberLight },
  { y: 2.2, yaw: 0.35, color: PAL.cream },
  { y: 1.7, yaw: -0.15, color: PAL.timberLight },
] as const;

/**
 * The signpost: a timber post with three arrow boards and a teal pennant. Code-built shapes with the
 * usual ink outline. Furniture only: it carries no fact and does not move (reduced motion needs nothing).
 */
export default function Signpost() {
  return (
    <RigidBody type="fixed" colliders={false} position={[SIGN.x, 0, SIGN.z]} rotation={[0, SIGN_FACING, 0]}>
      <CuboidCollider args={[0.3, 1.8, 0.3]} position={[0, 1.8, 0]} />
      <Part color={PAL.timberDark} position={[0, 1.75, 0]} grow={1.12}>
        <boxGeometry args={[0.24, 3.5, 0.24]} />
      </Part>
      {BOARDS.map((b) => (
        <group key={b.y} position={[0, b.y, 0.16]} rotation={[0, b.yaw, 0]}>
          <Part color={b.color} position={[0.45, 0, 0]} grow={1.1}>
            <boxGeometry args={[1.3, 0.34, 0.08]} />
          </Part>
          <Part color={b.color} position={[1.18, 0, 0]} grow={1.1}>
            <boxGeometry args={[0.3, 0.34, 0.08]} />
          </Part>
        </group>
      ))}
      <Part color={PAL.teal} position={[0, 3.7, 0]} grow={1.15}>
        <boxGeometry args={[0.7, 0.3, 0.05]} />
      </Part>
    </RigidBody>
  );
}
