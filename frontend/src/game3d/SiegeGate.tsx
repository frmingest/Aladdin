import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import StaticBatch from "./StaticBatch";
import { SIEGE_GATE, SIEGE_GATE_FACING } from "./siegeField";
import { FIELD_WORDS } from "./siegeFieldWordsV1";
import WorldSign from "./WorldSign";

/**
 * The gate to the Siege Field: two timber posts, a lintel and a teal pennant beside the drill camp. Plain code-built
 * shapes with the usual ink outline. Furniture only: it carries no fact and does not move. The gap between the
 * posts is open ground, so the gate never blocks a path.
 */
export default function SiegeGate() {
  return (
    <RigidBody type="fixed" colliders={false} position={[SIEGE_GATE.x, 0, SIEGE_GATE.z]} rotation={[0, SIEGE_GATE_FACING, 0]}>
      {([-1.6, 1.6] as const).map((x) => (
        <CuboidCollider key={x} args={[0.2, 1.8, 0.2]} position={[x, 1.8, 0]} />
      ))}
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
      <WorldSign spec={{ kind: "plank", lines: [FIELD_WORDS.gateLabel] }} position={[0, 4.15, 0.2]} width={3.4} />
    </RigidBody>
  );
}
