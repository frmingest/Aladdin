import { HOURGLASS_SHUT } from "./hourglassWordsV1";
import { STREET_EMPTY_AT_SAL } from "./streetPlan";
import { STARTER_WORDS as STARTER_V1 } from "./starterWordsV1";
import { TOUCH_WORDS as V1 } from "./touchWordsV1";

/**
 * Words for a touch screen (#536), version 2. V1 (#485) is shown and stays untouched; this adds the lines a phone shows in
 * place of a line that names a key. Once shown to Faiz or a player, a change is a new `touchWordsV3.ts` (CLAUDE.md rule 3).
 *
 * A phone has no E, H or T key, so a line that names one says the tap instead: the toolbar chip by its name, the button by
 * its words, or the wax seal by the word it shows ("Talk"). Every such line is written out whole here, so a voice review
 * reads the real sentence and a reworded source line cannot slip past a pattern.
 */
export const TOUCH_WORDS = {
  ...V1,
  /** The 3D view's name for a screen reader on a touch screen (the desktop one names W A S D and the mouse). */
  canvas: "3D courtyard. Push the rose to walk, drag to look.",
  /** The Quest log's last line: questWordsV3's `talkHint`, for touch. "Talk" is the seal's word at an advisor. */
  talkHint: (names: readonly string[]): string => `Walk up to ${names.join(" or ")} and tap Talk.`,
} as const;

/** Each desktop line that names a key, and the whole line a touch screen shows instead. */
export const TOUCH_LINES: Readonly<Record<string, string>> = {
  [HOURGLASS_SHUT]: 'Shut while you look back. Tap "Back to today".',
  // At Sal's stand the seal shows "Talk" ("Press E to talk to Sal: open a new stall").
  [STREET_EMPTY_AT_SAL]: "No stalls yet. Tap Talk and Sal opens the first one.",
  // The Book's grown-up lines: the Towers chip in the toolbar is the T key.
  [STARTER_V1.book.pages.walls.real as string]: "Tap Towers: each tower says its walls.",
  [STARTER_V1.book.pages.moat.real as string]: "Tap Towers: each tower says its moat.",
  [STARTER_V1.book.pages.storms.real as string]: "Tap Towers: walls and moat say if a business changed.",
};

/** The keys the game uses; a button's trailing "(E)" or "(H)" names one, and on touch the button itself is the tap. */
const TRAILING_KEY = /\s*\((?:E|H|M|P)\)$/;

/** The line as a touch screen says it: its whole touch line if it has one, else without a trailing key; unchanged if neither. */
export function forTouch(text: string): string {
  return TOUCH_LINES[text] ?? text.replace(TRAILING_KEY, "");
}

/** `forTouch` on a touch screen, the line as written on a desktop. */
export function keyWords(text: string, touch: boolean): string {
  return touch ? forTouch(text) : text;
}
