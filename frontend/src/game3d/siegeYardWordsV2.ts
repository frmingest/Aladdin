/**
 * The siege yard: the words (version 2, 2026-11-03), from the 3D text review. Game voice and the review's glossary: "sway"
 * (not weighted beta), "fortress test" (not stress case), "in fog" (not "no usable beta"), "Plain view" (not the flat page).
 * Numbers are never reworded. Version 1 (siegeYardWordsV1.ts) stays as it was shown.
 */
export type YardLevel = "calm" | "gathering" | "besieged" | "unsurveyed";

export const YARD_WORDS_VERSION = "v2";

export const YARD_TITLE = "What the fall does";
export const YARD_READING = "Counting the damage…";
export const YARD_REFRESHING = "Counting again…";
export const YARD_FAILED = "Can't count the damage right now. Your plan can still be written.";
export const YARD_EMPTY = "No towers to test yet.";
export const YARD_BOOK = "Whole fortress";
export const YARD_LOSS = "Loss in the fall";
export const YARD_SWAY = "Sway";
/** Hover on "Sway": how hard market swings hit it. */
export const YARD_SWAY_HOVER = "1.0 moves with the market. Higher swings harder, lower swings less.";
export const YARD_COVERAGE = "Tested";
export const YARD_ROUGH = "Rough guide";
export const YARD_GAP = "Fortress test disagrees";
/** Hover on the gap flag: the long note. */
export const YARD_GAP_HOVER =
  "This fall scales the tower by its sway. The fortress's saved storm test asks a different question, so the two can differ a lot.";
export const YARD_FLAT = "Full test in Plain view";
/** Printed in place of a number for a tower that could not be tested: unknown stays fog. */
export const YARD_UNKNOWN = "?";

/** One short sentence per level, the sentence after the number. */
export const YARD_LEVEL_LINE: Record<YardLevel, string> = {
  calm: "Stays inside the storm line.",
  gathering: "Crosses the storm line.",
  besieged: "Crosses the siege line.",
  unsurveyed: "Too little price history to test it.",
};

/** The level's name, as a headline word. Unknown is "In fog". */
export const YARD_LEVEL_NAME: Record<YardLevel, string> = {
  calm: "The walls hold",
  gathering: "Storm clouds gather",
  besieged: "Under siege",
  unsurveyed: "In fog",
};

/** One word per tower row. */
export const YARD_STATUS = {
  sheltered: "Sheltered",
  exposed: "Exposed",
  breach_risk: "Wall could break",
  unmodelled: "In fog",
  gains: "Gains",
} as const;

export function yardFogTitle(count: number): string {
  return `Fog over ${count} ${count === 1 ? "tower" : "towers"}. Too little price history; left out of the total.`;
}

export function yardMoreLine(count: number): string {
  return `${count} more in Plain view.`;
}

/** "A 30% market fall costs the fortress 12.3%. Crosses the storm line." The fall's own subject comes from the caller. */
export function yardHeadline(fall: string, subject: string, level: YardLevel, bookPct: string | null, dir: "costs" | "adds to"): string {
  if (level === "unsurveyed" || bookPct === null) return `A ${fall} ${subject}: ${YARD_LEVEL_LINE.unsurveyed}`;
  return `A ${fall} ${subject} ${dir} the fortress ${bookPct}%. ${YARD_LEVEL_LINE[level]}`;
}

export function yardCoverageLine(tested: number, total: number, pct: string): string {
  return `Tested ${tested} of ${total} towers, ${pct} of the fortress by value.`;
}
