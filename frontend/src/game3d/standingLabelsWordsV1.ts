/**
 * Game-voice layer for the last few backend-written Standing sentences that still read like system text in `/game3d`
 * (text pass 4i). The level titles, goals and torch facts are already game voice in the backend (`standing_v1..v3.py`,
 * `standing.py`); three strings are not: "queue the analysis" (system voice), "Nothing is known." (unknown is fog) and
 * the gap label "no tagged filing" (a filing is a report). The flat Fortress keeps the backend wording; only the 3D
 * Quest log and the tower's gap label pass through here.
 *
 * Exact strings only, so a sentence this file does not know (a new backend wording, or a v4 standing) comes back
 * untouched, never dropped or guessed. Numbers are not touched. Version 1 (2026-11-09): a change to any wording that could
 * be shown for real is a NEW file (standingLabelsWordsV2.ts), never an edit of this one.
 */
import type { StandingWordsV3 } from "./standingWordsV3";

const EXACT: Record<string, string> = {
  "Lift the fog: fetch reports, queue the analysis.": "Lift the fog: fetch reports, then ask for the analysis.",
  "The watch has not reported. Nothing is known.": "The Watch hasn't reported. Everything is in fog.",
  "no tagged filing": "no tagged report",
};

/** One backend Standing sentence or gap label in game voice; unknown text comes back as it was. */
export const gameStandingText = (text: string): string => EXACT[text] ?? text;

const mapText = (s: string | null): string | null => (s === null ? null : gameStandingText(s));

/** The Quest log's Standing words with the leftover system sentences in game voice. */
export function withGameStandingLabels(w: StandingWordsV3): StandingWordsV3 {
  return { ...w, next: mapText(w.next), watch: mapText(w.watch), ledger: mapText(w.ledger) };
}

/** Words that must not survive on a string the table above knows. Used by the test. */
export const STANDING_BANNED = [/\bqueue\b/i, /Nothing is known/, /\bfiling\b/i];
export const STANDING_KNOWN: readonly string[] = Object.keys(EXACT);
