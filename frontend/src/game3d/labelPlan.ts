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
