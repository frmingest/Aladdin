/**
 * The loading line's words (version 2, 2026-11-22, #493): version 1's line for every place it knew, plus the practice yard's.
 * Version 1 (`loadingWordsV1.ts`) keeps its wording (its only change is a narrower type, `AreaRefV1`, so it never sees the yard). A change to shown wording is a new version file (`loadingWordsV3.ts`).
 */
import type { AreaRef } from "./areas";
import { LOADING_SLOW, loadingLine as loadingLineV1 } from "./loadingWordsV1";
import { STARTER_WORDS } from "./starterWordsV1";

export const LOADING_WORDS_VERSION = "v2";

export { LOADING_SLOW };

/** One line per place. A holding's land names the holding, so nothing is invented. */
export function loadingLine(ref: AreaRef, holdingName?: string | null): string {
  if (ref.id === "practice") return STARTER_WORDS.loading;
  return loadingLineV1(ref, holdingName);
}
