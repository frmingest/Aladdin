/**
 * The Siege Field: the words (version 1, 2026-11-04). Game voice: short, plain, for the player's act. Numbers and the
 * words about a tower's fate come from the siege yard (the flat page's own helpers), never from here. A change to any
 * wording that could be shown for real is a NEW version file (siegeFieldWordsV2.ts), never an edit of this one.
 */
export const FIELD_WORDS_VERSION = "v1";

export const FIELD_WORDS = {
  /** The name plate on arrival. */
  plate: "The Siege Field",
  /** The plain name, for the page title. */
  title: "Siege Field",
  /** Over the gate in the courtyard. */
  gateLabel: "Siege Field",
  gatePrompt: "Press E to ride out to the Siege Field",
  exitPrompt: "Press E to ride back",
  /** Under the command tent's headline. */
  whatIf: "A what-if, not a forecast.",
  /** Over a ghost: the tower could not be tested. */
  fogMark: "?",
} as const;
