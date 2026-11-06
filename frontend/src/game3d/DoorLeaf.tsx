import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { getOpenDoor, stepSwing, swingSign } from "./doorSwing";
import { prefersReducedMotion } from "./motionPref";

/**
 * A door leaf on a hinge (polish PR 3). The group sits on the hinge line; the leaf is drawn by `children`, reaching
 * `width` to the `extend` side. It opens while the hero stands at this holding's door and shuts when they leave.
 * Decoration only: E does the same thing whether or not the leaf has finished swinging.
 */
export default function DoorLeaf({
  holdingId,
  hingeX,
  extend,
  width,
  swing,
  y = 0,
  children,
}: {
  holdingId: string;
  hingeX: number;
  extend: 1 | -1;
  width: number;
  swing: "in" | "out";
  y?: number;
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const angle = useRef(0);
  const reduced = useRef(prefersReducedMotion());
  const sign = swingSign(extend, swing);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const next = stepSwing(angle.current, getOpenDoor() === holdingId, dt, reduced.current);
    if (next === angle.current) return;
    angle.current = next;
    g.rotation.y = next * sign;
  });
  return (
    <group ref={ref} position={[hingeX, y, 0]}>
      <group position={[(extend * width) / 2, 0, 0]}>{children}</group>
    </group>
  );
}
