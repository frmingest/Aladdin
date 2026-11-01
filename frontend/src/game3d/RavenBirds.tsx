import { PAL, Part } from "./Inked";
import { PERCH, birdSlots } from "./watchPlan";

/** Near-black with a blue cast; never red or green. */
const FEATHER = "#2b2d3f";

/** The arm of the perch prop is at this height (PropModels.tsx), so a bird sits just above it. */
const ARM_Y = 2.6 + 0.14;

function Bird({ x, yaw }: { x: number; yaw: number }) {
  return (
    <group position={[x, ARM_Y, 0]} rotation={[0, yaw, 0]}>
      <Part color={FEATHER} position={[0, 0.2, 0]} scale={[1, 0.85, 1.5]} grow={1.15}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </Part>
      <Part color={FEATHER} position={[0, 0.4, 0.2]} grow={1.18}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </Part>
      <Part color={PAL.timberLight} position={[0, 0.39, 0.36]} rotation={[Math.PI / 2, 0, 0]} grow={1.2}>
        <coneGeometry args={[0.045, 0.16, 5]} />
      </Part>
      <Part color={FEATHER} position={[0, 0.16, -0.3]} rotation={[0.3, 0, 0]} grow={1.12}>
        <boxGeometry args={[0.16, 0.04, 0.28]} />
      </Part>
    </group>
  );
}

/**
 * Ravens on the perch (S16, PR 2). One bird per unseen raven the backend knows of, up to three; none when every raven
 * has been marked seen or none landed. Code-built, so a failed model load cannot hide them. No animation.
 */
export default function RavenBirds({ count }: { count: number }) {
  const slots = birdSlots(count);
  if (slots.length === 0) return null;
  return (
    <group position={[PERCH.x, 0, PERCH.z]}>
      {slots.map((s, i) => (
        <Bird key={i} x={s.x} yaw={s.yaw} />
      ))}
    </group>
  );
}
