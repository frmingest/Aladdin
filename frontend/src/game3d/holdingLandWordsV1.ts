/**
 * A holding's land: the words (version 1, 2026-11-03). Short, game voice, written for the player's act. A change to
 * any wording that could be shown for real is a NEW version file (holdingLandWordsV2.ts), never an edit of this one.
 * Facts (name, weight, value) are printed by `gateStoneFor`, not written here.
 */
export const LAND_WORDS_VERSION = "v1";

export const LAND_WORDS = {
  /** The plate on arrival, with the holding's name. */
  plate: (name: string) => `Into ${name}'s land`,
  /** The plate when the name is not known. */
  plateNoName: "Into the land",
  /** The place's plain name for the page title. */
  title: (name: string) => `${name}'s land`,
  titleNoName: "Holding land",
  /** The prompt when you stand at the gate. */
  gatePrompt: "Press E to head back outside",
  /** The label over the open front of the records house. */
  houseLabel: "Records house",
} as const;
