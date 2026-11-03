/**
 * Quest log words (version 3, 2026-11-03), from the 3D text review (`docs/game/game3d-text-review-2026-11-03.md`, pass 3).
 * Names follow the review's glossary: "why" (not thesis or reason), "look-back" (not review or reckoning),
 * "Sample fortress" (not demo), "To do" (not Open). Numbers are never reworded. quest.ts (v1) and questV2.ts (v2) keep
 * the sums and their old words; this file is the one the Quest log reads.
 */
export const QUEST_WORDS_VERSION = "v3";

export const QUEST_SAMPLE = "Sample fortress, not yours.";

/** Card 1: every holding has both lines (why, and what proves you wrong). */
export const WHYS_TITLE = "Write Your Whys";
export const WHYS_GOAL = "Write why you own each holding. Write what proves you wrong.";
export const WHYS_BAR_LABEL = "Holdings with both lines";
export const WHYS_STILL = "Still to write:";
export const WHYS_WHERE = "Write them at the desk by the keep door.";
export const whysCount = (written: number, total: number): string => `${written} of ${total} have both lines`;

export const WHYS_STATUS = {
  loading: "Reading your journal…",
  unreadable: "Can't read your journal right now.",
  empty: "No holdings yet, so nothing to write.",
  open: "To do",
  done: "Done! Every holding has both lines.",
} as const;

/** Card 2: the look-backs that have come due. */
export const LOOKBACK_TITLE = "Six-Month Look-back";
export const LOOKBACK_GOAL = "When an entry is six months old, write what happened next to what you expected.";
export const lookbackCount = (n: number): string => `${n} due:`;
export const LOOKBACK_JOURNAL = "Old entries in Plain view";

export const LOOKBACK_STATUS = {
  loading: "Reading your journal…",
  unreadable: "Can't read your journal right now.",
  empty: "No journal entries yet, so nothing to look back on.",
  open: "To do",
  clear: "Clear! No look-back is waiting.",
} as const;

/** Card 3: the Storm Drill. */
export const DRILL_CARD_STATUS = {
  loading: "Reading your drills…",
  unreadable: "Can't read your drills right now.",
  sample: QUEST_SAMPLE,
  open: "To do",
  done: "Done! You have a plan written down.",
} as const;
export const DRILL_CARD_WHERE = "Find the drill post in the south-west.";
export const drillCardDone = (count: number, fall: string | null): string =>
  `${count} written${fall !== null ? `, the last for a ${fall} fall` : ""}.`;

export const talkHint = (names: readonly string[]): string => `Press E next to ${names.join(" or ")} to talk.`;
