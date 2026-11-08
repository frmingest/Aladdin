import type { ReactNode } from "react";
import { Html } from "@react-three/drei";
import type { V3 } from "./Inked";

interface WorldLabelProps {
  position: V3;
  /** drei's size-by-distance factor; the same numbers the old labels used. */
  distanceFactor?: number;
  children: ReactNode;
  /** Unknown value: grey parchment with a dashed rim. */
  fog?: boolean;
  /** The thing you face: gold plate. */
  now?: boolean;
  /** Let long text wrap inside `maxWidth` px instead of one line. */
  wrap?: boolean;
  maxWidth?: number;
  title?: string;
  /** Decorative duplicate of something announced elsewhere (a name on a wall). */
  ariaHidden?: boolean;
}

/**
 * The one world label: a parchment tag (dark ink on cream, timber rim, soft shadow) that holds on
 * the light sky and on the dark halls. Replaces the undefined `g3d-nameplate` and the black boxes.
 */
export default function WorldLabel({
  position,
  distanceFactor = 14,
  children,
  fog = false,
  now = false,
  wrap = false,
  maxWidth,
  title,
  ariaHidden = false,
}: WorldLabelProps) {
  const cls = ["g3d-plate", fog ? "fog" : "", now ? "now" : "", wrap ? "wrap" : ""].filter(Boolean).join(" ");
  return (
    <Html position={position} center distanceFactor={distanceFactor} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className={cls} style={maxWidth ? { maxWidth } : undefined} title={title} aria-hidden={ariaHidden ? true : undefined}>
        {children}
      </div>
    </Html>
  );
}
