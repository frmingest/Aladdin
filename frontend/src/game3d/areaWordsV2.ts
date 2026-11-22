/**
 * Name plate on arrival and the page title (version 2, 2026-11-22, #493): version 1's words for every place it knew, plus
 * the starter's practice yard. Version 1 (`areaWordsV1.ts`) is not edited; this file only adds the yard. A change to any
 * wording that could be shown is a new version file (areaWordsV3.ts).
 */
import type { AreaRef } from "./areas";
import { AREA_STUCK, areaLine as areaLineV1, areaName as areaNameV1 } from "./areaWordsV1";
import { STARTER_WORDS } from "./starterWordsV1";

export const AREA_WORDS_VERSION = "v2";

export { AREA_STUCK };

/** The plate for a place. A tower names its own holding, so nothing is invented. */
export function areaLine(ref: AreaRef, holdingName?: string | null): string {
  if (ref.id === "practice") return STARTER_WORDS.place;
  return areaLineV1(ref, holdingName);
}

/** The place's plain name, for the page title. */
export function areaName(ref: AreaRef, holdingName?: string | null): string {
  if (ref.id === "practice") return STARTER_WORDS.place;
  return areaNameV1(ref, holdingName);
}
