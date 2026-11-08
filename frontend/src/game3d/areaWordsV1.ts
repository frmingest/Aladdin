/**
 * Name plate on arrival: the words (version 1, 2026-11-03). Short, game voice. A change to any wording that could be
 * shown for real is a NEW version file (areaWordsV2.ts), never an edit of this one.
 */
import type { AreaRef } from "./areas";
import { LAND_WORDS } from "./holdingLandWordsV1";
import { QUARTER_WORDS } from "./quarterWordsV1";
import { FIELD_WORDS } from "./siegeFieldWordsV1";
import { WEATHER_WORDS } from "./weatherTowerWordsV1";

export const AREA_WORDS_VERSION = "v1";

export const AREA_LINES = {
  courtyard: "Back in the courtyard",
  town: "The Town",
  townhall: "Into the Town Hall",
  records: "Hall of Records",
  weather: WEATHER_WORDS.plate,
} as const;

/** Shown when the new place never appeared and you were sent back. */
export const AREA_STUCK = "The door is stuck. Try again?";

/** The plate for a place. A tower names its own holding, so nothing is invented. */
export function areaLine(ref: AreaRef, holdingName?: string | null): string {
  if (ref.id === "holding") return holdingName ? LAND_WORDS.plate(holdingName) : LAND_WORDS.plateNoName;
  if (ref.id === "siege") return FIELD_WORDS.plate;
  if (ref.id === "quarter") return QUARTER_WORDS.plate;
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
    case "weather":
      return WEATHER_WORDS.pageTitle;
    case "siege":
      return FIELD_WORDS.title;
    case "quarter":
      return QUARTER_WORDS.title;
    case "holding":
      return holdingName ? LAND_WORDS.title(holdingName) : LAND_WORDS.titleNoName;
  }
}
