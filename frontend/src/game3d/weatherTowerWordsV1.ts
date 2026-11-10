/**
 * The Weather Tower's words (version 1, 2026-11-08). Short, game voice, numbers stay exact (they come from the flat page's
 * own formatting). A change to any wording that could be shown for real is a NEW version file (weatherTowerWordsV2.ts),
 * never an edit of this one. No buy, sell, good or bad words: this room only reads the economy's weather.
 */
export const WEATHER_WORDS_VERSION = "v1";

export const WEATHER_WORDS = {
  /** The name over the door and on the plate. */
  title: "The Weather Tower",
  /** The plate on arrival. */
  plate: "Into the Weather Tower",
  /** The page title of the place. */
  pageTitle: "Weather Tower",
  /** Shown while nothing has been read. */
  nothingYet: "No readings yet. Press Refresh on the Macro page.",
  reading: (reading: number, total: number) => `${reading} of ${total} dials reading`,
  more: (n: number) => `${n} more in the page`,
  noReading: "No reading",
  stale: "stale",
  threeMonths: "3 mo",
  twelveMonths: "12 mo",
  /** A short key to the pictures. */
  needleKey: "Needle: low to high over 2 years",
  railKey: "Norway's curve: one post for each maturity",
  west: "Norway",
  east: "United States",
  north: "The gaps",
  dialsPrompt: "Press E to read the full weather page",
  doorPrompt: "Press E to step back outside",
  /** The label over the door of the building in the Town. */
  signLabel: "Weather Tower",
} as const;
