/**
 * v1 words for the courtyard Standing (Standing 1, 2026-10-31). Game voice: short, plain,
 * for the player's next act. Numbers stay exact; only the wording is playful. Hand-written,
 * chosen by fixed rules from the backend's Standing; no model writes a word of it.
 * Once shown for real, add standingWordsV2.ts instead of editing this.
 */
import type { Standing } from "../lib/types";

export const STANDING_WORDS_VERSION = "v1";

export interface StandingWords {
  headline: string;
  next: string | null;
  /** 0 to max: how many torches burn. Unknown (no Standing yet) is none. */
  lit: number;
}

/** What the Quest log says about the Standing. `failed` means the endpoint could not be read. */
export function standingWords(s: Standing | null, failed: boolean): StandingWords {
  if (failed) return { headline: "Can't read your Standing right now.", next: null, lit: 0 };
  if (s === null) return { headline: "Counting the torches...", next: null, lit: 0 };
  if (s.demo) return { headline: "Sample fortress: no Standing yet.", next: "Bring in your own holdings.", lit: 0 };
  if (s.level === 0) return { headline: "Standing: not started.", next: s.next_step, lit: 0 };
  return {
    headline: `Level ${s.level} of ${s.max_level}: ${s.title ?? ""}`.trim(),
    next: s.next_step ?? "More to build: the next levels come later.",
    lit: s.level,
  };
}
