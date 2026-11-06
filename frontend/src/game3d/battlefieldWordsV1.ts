/**
 * The old battlefield on the Siege Field: the words (version 1, 2026-11-06). Game voice: short, plain, for the
 * player's act. The numbers come from the flat Siege page's own helpers (`lib/siegeBacktest`), never from here.
 * A change to any wording that could be shown for real is a NEW version file (battlefieldWordsV2.ts), never an edit
 * of this one.
 */
export const BATTLE_WORDS_VERSION = "v1";

export const BATTLE_WORDS = {
  /** Over the board at the head of the ground. */
  board: "The old battlefield",
  reading: "Reading the old war...",
  failed: "The old battlefield will not open.",
  /** No stored fall big enough to replay (or no price history yet). */
  quiet: "No big fall to replay yet.",
  /** Under the board: it checks the page's method on one past fall and says nothing about the next. */
  notForecast: "One old fall. Not a forecast.",
  legend: "Scorch: what happened. Chalk: what the page said.",
  /** On a plate: "Alpha did -33.5%, said -9.2%". */
  did: "did",
  said: "said",
  /** A holding the method could not be tested on stands in fog. */
  fogMark: "?",
  verdict: {
    close: "Close",
    fell_more: "Fell harder",
    fell_less: "Fell softer",
    not_tested: "?",
  },
  table: "Your drills",
  tableEmpty: "Nothing pinned yet.",
  tableFailed: "The war table is out of reach.",
} as const;

export const battleMore = (n: number): string => `${n} more in Plain view`;
export const battleTested = (tested: number, total: number): string => `${tested} of ${total} tested`;
