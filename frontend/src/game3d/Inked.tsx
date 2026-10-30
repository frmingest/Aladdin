import type { ReactNode } from "react";
import { BackSide } from "three";

export type V3 = [number, number, number];

/** The dark-indigo outline of the Stitch pictures, drawn as a slightly larger back-facing copy. */
export const INK = "#26253B";

/** The Stitch Master palette, so the solid models match the pictures. */
export const PAL = {
  slate: "#a3a6c0",
  slateDark: "#6b6e8a",
  moss: "#76b82a",
  timber: "#8a5432",
  timberLight: "#b07a45",
  timberDark: "#58321c",
  teal: "#0ca5b0",
  tealDark: "#075960",
  cream: "#eee4d3",
  iron: "#3b3a45",
  glass: "#46566f",
  skin: "#d9a98a",
  void: "#14131c",
} as const;

interface PartProps {
  color: string;
  position?: V3;
  rotation?: V3;
  scale?: V3;
  /** Outline size as a scale on the part; small parts need a bigger number. */
  grow?: number;
  ink?: boolean;
  children: ReactNode;
}

/** One solid piece: lit flat colour plus an ink outline. Children is the geometry element. */
export function Part({ color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], grow = 1.07, ink = true, children }: PartProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow receiveShadow>
        {children}
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {ink && (
        <mesh scale={grow}>
          {children}
          <meshBasicMaterial color={INK} side={BackSide} />
        </mesh>
      )}
    </group>
  );
}
