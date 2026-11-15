/**
 * The Royal Mint's words (version 1, 2026-11-15). Short, game voice. Numbers never come from here: every figure on a plate is
 * the backend's own, printed through `lib/format.ts`. A change to any wording that could be shown for real is a NEW version
 * file (mintWordsV2.ts), never an edit of this one. No buy, sell, good or bad words: the Mint reads consequences, it gives no advice.
 */
export const MINT_WORDS_VERSION = "v1";

export const MINT_WORDS = {
  /** The name over the door and on the plate. */
  title: "The Royal Mint",
  plate: "Into the Royal Mint",
  pageTitle: "Royal Mint",
  /** The permanent banner. The backend's own banner is shown when it has one. */
  banner: "Scenario, not forecast.",
  stamp: "STAMP",
  pressPrompt: "Press E to STAMP",
  pressNeedsPull: "Pull a lever first, then STAMP",
  pressBusy: "Stamping...",
  pressFailed: "The press jammed. Try again?",
  spanPrompt: (years: number) => `Press E: look ${years === 1 ? "3 years" : "1 year"} ahead`,
  spanPlate: (years: number) => `Look ahead: ${years} ${years === 1 ? "year" : "years"}`,
  bookPrompt: "Press E to read the results as plain words",
  doorPrompt: "Press E to step back outside",
  leverPrompt: (name: string) => `Press E to pull ${name}`,
  leverOff: "At rest",
  /** Shown on the result wall before the first stamp, and after the levers move. */
  wallEmpty: "Pull a lever, then STAMP",
  wallStale: "Levers moved. STAMP again",
  /** The tab on a plate whose answer no longer matches the levers. */
  stale: "Old answer",
  wallLoading: "Stamping...",
  wallFailed: "No answer from the kingdom's books",
  /** What the ledger could not be read. The wall stays bare, never guessed. */
  ledgerFailed: "The lever book did not open",
  notModelled: "Not modelled",
  /** Direction, by shape and word (never colour alone). */
  direction: {
    up: "Up",
    leans_up: "Leans up",
    unclear: "Can't tell",
    leans_down: "Leans down",
    down: "Down",
  } as Record<string, string>,
  /** Marks beside the direction word. Shape carries the meaning, not colour. */
  mark: {
    up: "▲",
    leans_up: "△",
    unclear: "◇",
    leans_down: "▽",
    down: "▼",
  } as Record<string, string>,
  plain: "Plain",
  /** The lectern board (kept apart from the top-left Plain view button). */
  ledger: "Ledger",
  real: "After inflation",
  directionOnly: "Direction only",
  portfolio: "Whole book",
  covered: (pct: string) => `${pct} of your book is modelled`,
  more: (n: number) => `${n} more in the plain list`,
  temperament: "Mood of the Mint",
  temperamentCalm: "Calm",
  temperamentRestless: "Restless",
  wildShort: "A wild pull: trust it less",
  plainTitle: "The Mint, in plain words",
  plainClose: "Close",
  /** The wording of one notch of one lever (the notch's size is what the backend is sent). */
  notch: {
    toll_gate: (size: number) => (size < 0 ? `Cut the rate by ${Math.abs(size)} points` : `Raise the rate by ${size} points`),
    great_press: (size: number) => (size < 0 ? `Press less: ${Math.abs(size)}% of GDP` : `Press more: ${size}% of GDP`),
    great_melt: (size: number) => `Melt ${size}% of GDP`,
    coin_rain: (size: number) => `Pay out ${size}% of GDP`,
    harbour_guard: (size: number) => (size < 0 ? `Krone out: ${Math.abs(size)}% of GDP` : `Krone in: ${size}% of GDP`),
  } as Record<string, (size: number) => string>,
  variant: {
    sterilised: "money held",
    unsterilised: "money moves",
  } as Record<string, string>,
} as const;
