import { TOUCH_WORDS as V1 } from "./touchWordsV1";

/**
 * Words for a touch screen (#536), version 2. V1 (#485) is shown and stays untouched; this adds the words that replace a key
 * name on a phone. Once shown to Faiz or a player, a change is a new `touchWordsV3.ts` (CLAUDE.md rule 3).
 *
 * A phone has no E, H, T, Q or G key, so a line that names one says the tap instead: the toolbar chip by its name, or the wax
 * seal by the word it shows ("Talk"). The words of the line itself stay the game's own; only the key part is swapped.
 */
export const TOUCH_WORDS = {
  ...V1,
  /** The 3D view's name for a screen reader on a touch screen (the desktop one names W A S D and the mouse). */
  canvas: "3D courtyard. Push the rose to walk, drag to look.",
} as const;

/**
 * Each key phrase and what a touch screen says instead, in order. A trailing key in brackets ("Got it (E)", "Back to today
 * (H)") is simply dropped: the button itself is the tap.
 */
export const TOUCH_SWAPS: readonly (readonly [RegExp, string])[] = [
  [/\s*\([A-Z]\)$/, ""],
  [/^Press E next to (.+) to talk\.$/, "Walk up to $1 and tap Talk."],
  [/Press H for today/, "Tap Back to today"],
  [/^Press T:/, "Tap Towers:"],
  [/^Press Q:/, "Tap Quests:"],
  [/^Press G:/, "Tap Where to?:"],
];

/** The line as a touch screen says it: no key names. A line with no key in it comes back unchanged. */
export function forTouch(text: string): string {
  return TOUCH_SWAPS.reduce((s, [from, to]) => s.replace(from, to), text);
}

/** `forTouch` on a touch screen, the line as written on a desktop. */
export function keyWords(text: string, touch: boolean): string {
  return touch ? forTouch(text) : text;
}
