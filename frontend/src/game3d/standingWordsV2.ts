/**
 * v2 words for the courtyard Standing (Standing 3, 2026-10-31): four levels, the fourth being The
 * Watch. Game voice, short and plain. Numbers stay exact; only the wording is playful. Hand-written,
 * chosen by fixed rules from the backend's Standing; no model writes a word of it.
 * v1 words stay as they were (standingWordsV1.ts) and are used while the backend serves `v1`.
 */
import type { Standing } from "../lib/types";
import { standingWords as standingWordsV1 } from "./standingWordsV1";
import type { StandingWords } from "./standingWordsV1";

export const STANDING_WORDS_VERSION = "v2";

export interface StandingWordsV2 extends StandingWords {
  /** What the backend says about the night watch (gate 4), once levels 1 to 3 hold. Null before that. */
  watch: string | null;
}

/** The level 4 fact, shown only when levels 1 to 3 hold: before that the watch is not the point yet. */
function watchFact(s: Standing): string | null {
  if (s.level < 3) return null;
  return s.gates.find((g) => g.level === 4)?.fact ?? null;
}

/** What the Quest log says about the Standing. `failed` means the endpoint could not be read. */
export function standingWordsV2(s: Standing | null, failed: boolean): StandingWordsV2 {
  if (failed) return { headline: "Can't read your Standing right now.", next: null, lit: 0, watch: null };
  if (s === null) return { headline: "Counting the torches...", next: null, lit: 0, watch: null };
  if (s.demo) return { headline: "Sample fortress: no Standing yet.", next: "Bring in your own holdings.", lit: 0, watch: null };
  if (s.level === 0) return { headline: "Standing: not started.", next: s.next_step, lit: 0, watch: null };
  const top = s.level >= s.max_level;
  return {
    headline: `Level ${s.level} of ${s.max_level}: ${s.title ?? ""}`.trim(),
    next: s.next_step ?? (top ? "Keep it up. Look at each wire that fires." : "More to build: the next levels come later."),
    lit: s.level,
    watch: watchFact(s),
  };
}

/** Pick the words that match the Standing the backend actually served. */
export function wordsFor(s: Standing | null, failed: boolean): StandingWordsV2 {
  return s?.version === "v2" ? standingWordsV2(s, failed) : { ...standingWordsV1(s, failed), watch: null };
}
