/**
 * The siege yard: the words (version 1, 2026-11-02). Short, game voice; numbers are never reworded (they come from
 * the same helpers as the flat Siege Simulator). A change to any wording that could be shown for real is a NEW
 * version file (siegeYardWordsV2.ts), never an edit of this one.
 */
export const YARD_WORDS_VERSION = "v1";

export const YARD_TITLE = "What the fall does";
export const YARD_READING = "Counting the damage...";
export const YARD_REFRESHING = "Counting again...";
export const YARD_FAILED = "Can't count the damage right now. Your plan can still be written.";
export const YARD_EMPTY = "No towers to put under siege yet.";
export const YARD_BOOK = "The whole book";
export const YARD_LOSS = "What-if loss";
export const YARD_BETA = "Weighted beta";
export const YARD_COVERAGE = "Counted";
export const YARD_ROUGH = "Rough guide";
export const YARD_GAP = "Differs from the stress case";
export const YARD_FOG_NOTE = "left out of the total, never given a made-up number.";
export const YARD_MORE = "more on the flat page";
export const YARD_FLAT = "The full Siege Simulator";
/** Printed in place of a number for a tower that could not be modelled: unknown stays unknown. */
export const YARD_UNKNOWN = "?";

export function yardFogTitle(count: number): string {
  return `Fog over ${count} ${count === 1 ? "tower" : "towers"}: no usable beta, ${YARD_FOG_NOTE}`;
}

export function yardMoreLine(count: number): string {
  return `${count} ${YARD_MORE}.`;
}
