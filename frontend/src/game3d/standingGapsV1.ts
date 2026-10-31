/**
 * Named gaps for Standing level 2 (v1, 2026-10-31). A holding listed here cannot be
 * surveyed today for a reason outside the player's control (for example a company
 * whose filings carry no machine-readable figures). It stays fog in the courtyard,
 * but it does not hold the level at 1 forever: a named gap counts as "looked at".
 *
 * Small on purpose, and every line says why. Never add a holding just to lift a level.
 * Once shown for real, add standingGapsV2.ts instead of editing this file.
 */
export const STANDING_GAPS_VERSION = "v1";

export interface NamedGap {
  /** Matched against the holding's ticker, ignoring case. */
  ticker: string;
  /** Plain words, shown to the player. */
  why: string;
}

export const STANDING_GAPS_V1: readonly NamedGap[] = [
  {
    ticker: "JAREN.OL",
    why: "Jæren Sparebank: its filings on Newsweb carry no tagged figures, so there is nothing to survey yet.",
  },
];
