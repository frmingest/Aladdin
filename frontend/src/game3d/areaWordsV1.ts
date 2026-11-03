/**
 * Name plate on arrival: the words (version 1, 2026-11-03). Short, game voice. A change to any wording that could be
 * shown for real is a NEW version file (areaWordsV2.ts), never an edit of this one.
 */
import type { AreaRef } from "./areas";
import { LAND_WORDS } from "./holdingLandWordsV1";

export const AREA_WORDS_VERSION = "v1";

export const AREA_LINES = {
  courtyard: "Back in the courtyard",
  town: "The Town",
  townhall: "Into the Town Hall",
  records: "Hall of Records",
} as const;

/** Shown when the new place never appeared and you were sent back. */
export const AREA_STUCK = "The door is stuck. Try again?";

/** The plate for a place. A tower names its own holding, so nothing is invented. */
export function areaLine(ref: AreaRef, holdingName?: string | null): string {
  if (ref.id === "holding") return holdingName ? LAND_WORDS.plate(holdingName) : LAND_WORDS.plateNoName;
  return AREA_LINES[ref.id];
}

/** The place's plain name, for the page title. */
export function areaName(ref: AreaRef, holdingName?: string | null): string {
  switch (ref.id) {
    case "courtyard":
      return "3D courtyard";
    case "town":
      return "The Town";
    case "townhall":
      return "Town Hall";
    case "records":
      return "Hall of Records";
    case "holding":
      return holdingName ? LAND_WORDS.title(holdingName) : LAND_WORDS.titleNoName;
  }
}
