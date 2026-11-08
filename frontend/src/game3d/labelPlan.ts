/**
 * Which look a world label gets, from what it is and how far away it is. Pure, so it is tested.
 *
 * Kinds: a `sign` is painted on a thing in the world and always shows; a `name` is a plate over
 * something that moves or that you walk up to, so it shows only when near (or faced); a `prompt` is an
 * action ("[E] Talk") and shows only for the one thing you can act on now.
 *
 * Unknown stays fog: `fog` is passed through untouched, so distance can fade a fog label but never
 * turns it into a number.
 */
export type LabelKind = "sign" | "name" | "prompt";
export type LabelTier = "sign" | "plate" | "prompt" | "hidden";

export interface LabelInput {
  kind: LabelKind;
  /** Metres from the camera or the player to the label. */
  distance: number;
  /** The thing you face or have targeted. */
  focused: boolean;
  /** Unknown value: draw the fog look. */
  fog: boolean;
}

export interface LabelLook {
  tier: LabelTier;
  opacity: number;
  fog: boolean;
}

/** Full size within this many metres. */
export const NEAR_FULL = 12;
/** Fully hidden from here on; between the two it fades. */
export const NEAR_GONE = 18;

export function labelFor({ kind, distance, focused, fog }: LabelInput): LabelLook {
  if (kind === "sign") return { tier: "sign", opacity: 1, fog };
  if (kind === "prompt") return { tier: focused ? "prompt" : "hidden", opacity: focused ? 1 : 0, fog };
  if (focused || distance <= NEAR_FULL) return { tier: "plate", opacity: 1, fog };
  if (distance >= NEAR_GONE) return { tier: "hidden", opacity: 0, fog };
  const opacity = (NEAR_GONE - distance) / (NEAR_GONE - NEAR_FULL);
  return { tier: "plate", opacity, fog };
}

/** The tag's font size in CSS px (`.g3d-worldtag` is 0.75rem on a 16 px root). */
export const LABEL_FONT_PX = 12;
/** A label that would be drawn smaller than this hides instead of shrinking. */
export const MIN_LABEL_PX = 12;

/**
 * How big a label is on screen. drei scales an `Html` label by `distanceFactor / (2 tan(fov/2) * distance)`, so the size
 * follows from the camera alone and no DOM measuring is needed. Closer than the floor it is bigger, farther it is smaller.
 */
export function labelPx(distanceFactor: number, fovDeg: number, distance: number, fontPx: number = LABEL_FONT_PX): number {
  if (distance <= 0) return Infinity;
  const scale = distanceFactor / (2 * Math.tan((fovDeg * Math.PI) / 360) * distance);
  return fontPx * scale;
}

/**
 * The opacity a label is drawn at: the plan's look, then the size floor. The thing you face skips the floor.
 * Reduced motion: no fade, a label is fully there or not there.
 */
export function labelOpacity(look: LabelLook, px: number, focused: boolean, reducedMotion: boolean): number {
  if (look.tier === "hidden") return 0;
  if (!focused && px < MIN_LABEL_PX) return 0;
  if (reducedMotion) return look.opacity >= 0.5 ? 1 : 0;
  return look.opacity;
}
