/**
 * v3 words for the courtyard Standing (Standing 4, 2026-11-01): five levels, the fifth being The
 * Ledger. Game voice, short and plain. Numbers stay exact; only the wording is playful. Hand-written,
 * chosen by fixed rules from the backend's Standing; no model writes a word of it.
 * v1 and v2 words stay as they were and are used while the backend serves `v1` or `v2`.
 */
import type { Standing } from "../lib/types";
import { standingWordsV2, wordsFor as wordsForV2 } from "./standingWordsV2";
import type { StandingWordsV2 } from "./standingWordsV2";

export const STANDING_WORDS_VERSION = "v3";

export interface StandingWordsV3 extends StandingWordsV2 {
  /** What the backend says about the look-backs (gate 5), once levels 1 to 4 hold. Null before that. */
  ledger: string | null;
}

/** The level 5 fact, shown only when levels 1 to 4 hold: before that the ledger is not the point yet. */
function ledgerFact(s: Standing): string | null {
  if (s.level < 4) return null;
  return s.gates.find((g) => g.level === 5)?.fact ?? null;
}

/** What the Quest log says about the Standing. `failed` means the endpoint could not be read. */
export function standingWordsV3(s: Standing | null, failed: boolean): StandingWordsV3 {
  const base = standingWordsV2(s, failed);
  if (!s || failed || s.demo || s.level === 0) return { ...base, ledger: null };
  const top = s.level >= s.max_level;
  return {
    ...base,
    // At the top the torch is held, not won: it goes out the day a look-back falls due.
    next: s.next_step ?? (top ? "All five lit. Keep looking back as entries age." : base.next),
    ledger: ledgerFact(s),
  };
}

/** Pick the words that match the Standing the backend actually served. */
export function wordsFor(s: Standing | null, failed: boolean): StandingWordsV3 {
  return s?.version === "v3" ? standingWordsV3(s, failed) : { ...wordsForV2(s, failed), ledger: null };
}
