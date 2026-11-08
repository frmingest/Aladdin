/**
 * The siege yard in the world: the words (version 3, 2026-11-08), from the 3D text plan (T4). Sentences leave the sky;
 * the world keeps short tags and the Storm Drill panel keeps the full text (siegeYardWordsV2.ts, untouched, still feeds
 * the panel). This file only adds the short in-world forms. Numbers are never reworded.
 */
export const YARD_WORLD_WORDS_VERSION = "v3";

/** Over the ghosts: how many towers could not be tested. Unknown stays fog; the reason is in the panel. */
export function yardFogTag(count: number): string {
  return `${count} ${count === 1 ? "tower" : "towers"} in fog`;
}

/** On the command tent when the count failed: short; the panel has the full sentence. */
export const YARD_FAILED_TAG = "Can't count right now";
