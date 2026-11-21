import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import StaticBatch from "./StaticBatch";
import { FIELD_ENTRANCE } from "./siegeFieldLogic";

/**
 * The entrance to the Siege Field (issue #466): two timber posts, a lintel and a teal pennant across the open south end of the field. The name
 * plank was dropped on 2026-11-21 at Faiz's ask; the gate is bare. It stands in the field's own frame, so it turns with the plot. Plain code-built shapes
 * with the usual ink outline. Furniture only: it carries no fact, has no prompt and does not move. The gap between the posts is open ground, so it
 * never blocks a path. It is always drawn (the camp behind it wakes when you come near), so the field can be seen from the road.
 */
export default function SiegeEntrance() {
  return (
    <RigidBody type="fixed" colliders={false} position={[FIELD_ENTRANCE.x, 0, FIELD_ENTRANCE.z]}>
      {([-1.6, 1.6] as const).map((x) => (
        <CuboidCollider key={x} args={[0.2, 1.8, 0.2]} position={[x, 1.8, 0]} />
      ))}
      <CuboidCollider args={[0.14, 5, 0.14]} position={[3.4, 5, 0]} />
      <StaticBatch>
        {([-1.6, 1.6] as const).map((x) => (
          <Part key={x} color={PAL.timberDark} position={[x, 1.8, 0]} grow={1.12}>
            <boxGeometry args={[0.36, 3.6, 0.36]} />
          </Part>
        ))}
        <Part color={PAL.timberLight} position={[0, 3.5, 0]} grow={1.06}>
          <boxGeometry args={[3.9, 0.4, 0.3]} />
        </Part>
        <Part color={PAL.teal} position={[0, 2.7, 0.05]} grow={1.12}>
          <boxGeometry args={[0.8, 1.2, 0.05]} />
        </Part>
      </StaticBatch>
    </RigidBody>
  );
}
