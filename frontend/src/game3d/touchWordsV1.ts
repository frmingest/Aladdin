/**
 * Words for the touch controls (#485), version 1. Shown only on a touch screen. Once shown to Faiz or a player, a change is
 * a new `touchWordsV2.ts`, never an edit here (CLAUDE.md rule 3).
 */
export const TOUCH_WORDS = {
  /** Replaces the keyboard hint line on a touch screen (the toolbar's own chips say the rest). */
  hint: "Push the rose to walk · Push far to run · Tap the seal to act · Drag to look",
  /** The stick's name for a screen reader. */
  stick: "Walk",
  /** The toolbar chip that swaps the stick and the seal, and its screen-reader name for each side. */
  swapChip: "Swap hands",
  swapLabel: (stickOn: "left" | "right") => (stickOn === "left" ? "Swap hands: stick to the right" : "Swap hands: stick to the left"),
} as const;
