/**
 * The Weather Tower's words (version 2, 2026-11-12, issue #402). Same voice as v1: short, game-like, numbers exact (they
 * come from the flat page's own formatting). v2 replaces the needle key with a key for the new wall plates (a dot on a
 * 2-year bar instead of a clock hand). v1 stays as it was (it still names the door sign in the Town). A change to any
 * wording that could be shown for real is a NEW version file, never an edit of this one. No buy, sell, good or bad
 * words: this room only reads the economy's weather.
 */
export const WEATHER_WORDS_VERSION = "v2";

export const WEATHER_WORDS = {
  /** The name over the door and on the plate. */
  title: "The Weather Tower",
  /** The plate on arrival. */
  plate: "Into the Weather Tower",
  /** The page title of the place. */
  pageTitle: "Weather Tower",
  /** Shown while nothing has been read. */
  nothingYet: "No readings yet. Press Refresh on the Macro page.",
  reading: (reading: number, total: number) => `${reading} of ${total} plates reading`,
  more: (n: number) => `${n} more in the page`,
  noReading: "No reading",
  stale: "stale",
  threeMonths: "3 mo",
  twelveMonths: "12 mo",
  /** A short key to the pictures on every plate. */
  dotKey: "Dot: where today sits in its 2-year range",
  /** The two ends of the range bar. */
  low: "low",
  high: "high",
  railKey: "Norway's curve: one post for each maturity",
  west: "Norway",
  east: "United States",
  north: "The gaps",
  dialsPrompt: "Press E to read the full weather page",
  doorPrompt: "Press E to step back outside",
  /** The label over the door of the building in the Town. */
  signLabel: "Weather Tower",
} as const;
