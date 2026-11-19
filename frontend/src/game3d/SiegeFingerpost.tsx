import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import StaticBatch from "./StaticBatch";
import { SIEGE_FINGERPOST, SIEGE_FINGERPOST_ARM_YAW, SIEGE_FINGERPOST_FACING } from "./siegeFieldLogic";
import { FIELD_WORDS } from "./siegeFieldWordsV2";
import WorldSign from "./WorldSign";

/**
 * The fingerpost on the gate road (issue #462): a timber post, a name plank facing the player coming out of the fortress, and an
 * arm with a pointed tip that turns toward the Siege Field gate on the west lawn. The arm points the way in both directions, so it
 * is told by shape and not by an arrow glyph that would flip on the plank's back face. Plain code-built shapes with the usual ink
 * outline. Furniture: it carries no fact, has no prompt and does not move.
 */
export default function SiegeFingerpost() {
  return (
    <RigidBody type="fixed" colliders={false} position={[SIEGE_FINGERPOST.x, 0, SIEGE_FINGERPOST.z]}>
      <CuboidCollider args={[0.16, 1.7, 0.16]} position={[0, 1.7, 0]} />
      <StaticBatch>
        <Part color={PAL.timberDark} position={[0, 1.7, 0]} grow={1.12}>
          <boxGeometry args={[0.28, 3.4, 0.28]} />
        </Part>
        {/* The arm and its tip, turned toward the gate. */}
        <group position={[0, 3.05, 0]} rotation={[0, SIEGE_FINGERPOST_ARM_YAW, 0]}>
          <Part color={PAL.timberLight} position={[0, 0, 0.95]} grow={1.08}>
            <boxGeometry args={[0.3, 0.3, 1.9]} />
          </Part>
          <Part color={PAL.teal} position={[0, 0, 2.25]} rotation={[Math.PI / 2, Math.PI / 4, 0]} grow={1.1}>
            <coneGeometry args={[0.36, 0.7, 4]} />
          </Part>
        </group>
      </StaticBatch>
      <WorldSign
        spec={{ kind: "plank", lines: [FIELD_WORDS.fingerpostLabel, FIELD_WORDS.fingerpostWhere] }}
        position={[0, 2.2, 0]}
        width={2.6}
        yaw={SIEGE_FINGERPOST_FACING}
      />
    </RigidBody>
  );
}
