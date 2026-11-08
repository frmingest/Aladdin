import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group, PerspectiveCamera } from "three";
import type { V3 } from "./Inked";
import { labelFor, labelOpacity, labelPx } from "./labelPlan";

interface WorldLabelProps {
  position: V3;
  /** drei's size-by-distance factor; the same numbers the old labels used. */
  distanceFactor?: number;
  children: ReactNode;
  /** Unknown value: grey parchment with a dashed rim. */
  fog?: boolean;
  /** The thing you face: gold tag, and it shows at any distance. */
  now?: boolean;
  /** Let long text wrap inside `maxWidth` px instead of one line. */
  wrap?: boolean;
  maxWidth?: number;
  title?: string;
  /** Decorative duplicate of something announced elsewhere (a name on a wall). */
  ariaHidden?: boolean;
  /**
   * "near" (the default): shows only when you are close and the text would be at least 12 px, fading out between
   * 12 and 18 m. "always": a label you must be able to read from anywhere. Never used for a sentence.
   */
  reveal?: "near" | "always";
}

/**
 * The one world label: a parchment tag (dark ink on cream, timber rim, soft shadow) that holds on
 * the light sky and on the dark halls. Replaces the undefined `g3d-nameplate` and the black boxes.
 *
 * Names live on things, so a tag only shows when you are near it (see `labelPlan.ts`). The check runs about ten times a
 * second and writes straight to the element, so there is no React render per frame.
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
  reveal = "near",
}: WorldLabelProps) {
  const cls = ["g3d-worldtag", fog ? "fog" : "", now ? "now" : "", wrap ? "wrap" : ""].filter(Boolean).join(" ");
  const group = useRef<Group>(null);
  const el = useRef<HTMLDivElement>(null);
  const world = useRef(new Vector3());
  const frame = useRef(0);
  const shown = useRef(-1);
  const reduced = useRef(false);
  const near = reveal === "near";

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = q.matches;
    const on = (e: MediaQueryListEvent) => {
      reduced.current = e.matches;
    };
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  useFrame(({ camera }) => {
    if (!near) return;
    if (frame.current++ % 6 !== 0) return;
    const node = el.current;
    const g = group.current;
    if (!node || !g) return;
    g.getWorldPosition(world.current);
    const distance = camera.position.distanceTo(world.current);
    const fov = (camera as PerspectiveCamera).fov ?? 60;
    const look = labelFor({ kind: "name", distance, focused: now, fog });
    const opacity = labelOpacity(look, labelPx(distanceFactor, fov, distance), now, reduced.current);
    if (opacity === shown.current) return;
    shown.current = opacity;
    node.style.opacity = String(opacity);
    node.style.visibility = opacity === 0 ? "hidden" : "visible";
  });

  // A near-only tag starts hidden and is revealed by the first check, so it never flashes on at the wrong distance.
  const style = {
    ...(maxWidth ? { maxWidth } : {}),
    ...(near ? { opacity: 0, visibility: "hidden" as const } : {}),
  };

  return (
    <group ref={group} position={position}>
      <Html center distanceFactor={distanceFactor} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div ref={el} className={cls} style={style} title={title} aria-hidden={ariaHidden ? true : undefined}>
          {children}
        </div>
      </Html>
    </group>
  );
}
