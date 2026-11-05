/**
 * The Siege Field tools: the words (version 1, 2026-11-05). Game voice: short, plain, for the player's act. A change to
 * any wording that could be shown for real is a NEW version file (siegeFieldToolsWordsV2.ts), never an edit of this one.
 * Percentages and yardstick names are the flat page's own and are passed in, never written here.
 */
export const FIELD_TOOLS_WORDS_VERSION = "v1";

export const FIELD_TOOLS_WORDS = {
  /** Over the winch: the fall it holds right now. */
  winchPlate: (pct: string) => `Fall ${pct}`,
  winchPrompt: (pct: string) => `Press E to crank the fall (now ${pct})`,
  /** Over a marker stone: its name and the fall that reaches that line. */
  stormName: "Storm line",
  siegeName: "Siege line",
  stonePlate: (name: string, pct: string) => `${name} ${pct}`,
  /** The line is never reached inside the slider's range: the stone says so and E does nothing. */
  stoneNever: (name: string) => `${name}: out of reach`,
  stonePrompt: (name: string, pct: string) => `Press E to set the fall to ${pct} (${name})`,
  /** On a yardstick banner. */
  bannerNow: "In use",
  bannerPrompt: (name: string) => `Press E to measure against ${name}`,
} as const;
