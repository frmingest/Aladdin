/**
 * The loading line's words (version 1, 2026-11-22, #479): what the page says while the world, or a place, is still being
 * drawn. Game voice: short, plain, one line, the place's own name, no promise of how long. A change to shown wording is a
 * new version file (`loadingWordsV2.ts`).
 */
import type { AreaRef } from "./areas";

export const LOADING_WORDS_VERSION = "v1";

/** One line per place. A holding's land names the holding, so nothing is invented. */
export function loadingLine(ref: AreaRef, holdingName?: string | null): string {
  switch (ref.id) {
    case "courtyard":
      return "Raising the walls…";
    case "townhall":
      return "Opening the Town Hall…";
    case "records":
      return "Dusting off the Hall of Records…";
    case "weather":
      return "Climbing the Weather Tower…";
    case "mint":
      return "Firing up the Royal Mint…";
    case "quarter":
      return "Setting out the Market Quarter…";
    case "holding":
      return holdingName ? `Walking to ${holdingName}'s land…` : "Walking to the land…";
  }
}

/** The progress bar's name for screen readers. */
export const LOADING_BAR_LABEL = "Drawing the world";
