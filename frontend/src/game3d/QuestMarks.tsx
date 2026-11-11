import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { GuideMark } from "./guideQuests";
import { prefersReducedMotion } from "./motionPref";

/** Teal, like Sal's roof and the other teal-and-neutral marks. Never red or green, and the shape (not the colour) says "quest". */
const MARK_COLOUR = "#2bb3b8";

function QuestMark({ mark }: { mark: GuideMark }) {
  const g = useRef<Group>(null);
  const still = useRef(prefersReducedMotion());
  useFrame(({ clock }) => {
    const o = g.current;
    if (!o) return;
    // With reduced motion the mark just hangs there.
    o.position.y = mark.y + (still.current ? 0 : Math.sin(clock.elapsedTime * 2) * 0.12 * mark.size);
    if (!still.current) o.rotation.y = clock.elapsedTime * 1.2;
  });
  return (
    <group ref={g} position={[mark.x, mark.y, mark.z]} scale={mark.size}>
      <mesh scale={[0.55, 1, 0.55]}>
        <octahedronGeometry args={[0.4]} />
        <meshBasicMaterial color={MARK_COLOUR} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The Guide's quest marks: a small teal diamond over whoever hands the next step over, or over the place it leads to. */
export default function QuestMarks({ marks }: { marks: readonly GuideMark[] }) {
  return (
    <>
      {marks.map((m) => (
        <QuestMark key={m.key} mark={m} />
      ))}
    </>
  );
}
