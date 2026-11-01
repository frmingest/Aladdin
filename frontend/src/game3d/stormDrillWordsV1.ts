/**
 * Quest 3, Storm Drill: the words (version 1, 2026-11-01). Short, game voice. A change to any wording that
 * could be shown for real is a NEW version file (stormDrillWordsV2.ts), never an edit of this one.
 */
export const DRILL_WORDS_VERSION = "v1";

export const DRILL_TITLE = "Storm Drill";
export const DRILL_GOAL = "Pick a fall. Write what you would do before it happens.";
export const DRILL_PANEL_TITLE = "Storm Drill";
export const DRILL_PANEL_SUB = "A rehearsal. Nothing is traded and nothing is sent.";
export const DRILL_PROMPT = "Press E to start a drill";
export const DRILL_FALL_LABEL = "If the market falls by";
export const DRILL_PLAN_LABEL = "I would";
export const DRILL_SAVE = "Write it down";
export const DRILL_SAVING = "Writing...";

export const DRILL_STATUS_WORDS = {
  loading: "Reading your drills...",
  unreadable: "Can't read your drills right now.",
  sample: "Sample fortress, not yours.",
  open: "Open",
  done: "Done! You have a plan written down.",
} as const;

export const DRILL_BLOCK_WORDS = {
  sample: "Sample fortress, not yours. Nothing is saved here.",
  unreadable: "Can't read your drills right now. Nothing is saved.",
  loading: "Reading your drills...",
} as const;
