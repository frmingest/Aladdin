import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import StaticBatch from "./StaticBatch";
import { HOURGLASS, HOURGLASS_FACING, HOURGLASS_SOLID } from "./hourglassPlan";

/**
 * The Hourglass (#414): a timber stand with two glass bulbs and a little sand. Code-built shapes with the usual ink
 * outline; nothing moves and nothing here is data, so reduced motion needs nothing. It is furniture: the day you are
 * looking at is on the panel and the banner, not on the model.
 */
export default function HourglassPost() {
  return (
    <RigidBody type="fixed" colliders={false} position={[HOURGLASS.x, 0, HOURGLASS.z]} rotation={[0, HOURGLASS_FACING, 0]}>
      <CuboidCollider args={[HOURGLASS_SOLID, 1.5, HOURGLASS_SOLID]} position={[0, 1.5, 0]} />
      <StaticBatch rebuildKey="hourglass">
        <Part color={PAL.slateDark} position={[0, 0.15, 0]} grow={1.06}>
          <cylinderGeometry args={[0.7, 0.76, 0.3, 9]} />
        </Part>
        {/* Base and cap plates, and the three posts between them. */}
        <Part color={PAL.timberDark} position={[0, 0.42, 0]} grow={1.08}>
          <cylinderGeometry args={[0.55, 0.55, 0.24, 9]} />
        </Part>
        <Part color={PAL.timberDark} position={[0, 2.78, 0]} grow={1.08}>
          <cylinderGeometry args={[0.55, 0.55, 0.24, 9]} />
        </Part>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <Part key={i} color={PAL.timber} position={[Math.cos(a) * 0.46, 1.6, Math.sin(a) * 0.46]} grow={1.12}>
              <cylinderGeometry args={[0.06, 0.06, 2.2, 6]} />
            </Part>
          );
        })}
        {/* Sand below (the lower bulb is the sand), a brass neck, glass above with a little sand left in it. */}
        <Part color={PAL.sand} position={[0, 0.95, 0]} grow={1.04} ink>
          <sphereGeometry args={[0.42, 10, 8]} />
        </Part>
        <Part color={PAL.brass} position={[0, 1.6, 0]} grow={1.1}>
          <cylinderGeometry args={[0.07, 0.07, 0.3, 6]} />
        </Part>
        <Part color={PAL.glass} position={[0, 2.25, 0]} grow={1.04} ink>
          <sphereGeometry args={[0.42, 10, 8]} />
        </Part>
      </StaticBatch>
    </RigidBody>
  );
}
