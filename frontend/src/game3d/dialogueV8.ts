/**
 * v8 courtyard dialogue (2026-11-22, #478): v7 with the Guide's words from `guideWordsV2.ts`, where step 4 is "Read the
 * sky" at the pole by the keep instead of the Weather Tower. Everything else speaks exactly as v7 (the Guide first while a
 * First Step with words of its own is open, otherwise v6). v7 stays untouched and everything else here is re-exported.
 */
import { guideLines } from "./guideWordsV2";
import type { NpcId } from "./npcs";
import type { QuestState, ReviewQuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";
import { talk as talkV6 } from "./dialogueV6";
import type { GuideTalk } from "./dialogueV7";

export {
  DESK_NUDGE,
  DESK_WHERE,
  IMPORT_PATH,
  WHY_EXPLAINED,
  closeLabel,
  pointsToDesk,
  pointsToImport,
  sayShare,
} from "./dialogueV7";
export type { GuideTalk } from "./dialogueV7";

export const DIALOGUE_VERSION = "v8";

/** The Guide's words for this person, or null when the Guide has none right now (all done, or the "why" step). */
export function guideTalk(npc: NpcId, guide: GuideTalk | null | undefined): string[] | null {
  if (!guide || !guide.status.current) return null;
  const other: NpcId = npc === "oracle" ? "partner" : "oracle";
  return guideLines(npc, guide.status.current, guide.met.includes(other));
}

/** What the person says right now. Pure: same state, same words. */
export function talk(
  npc: NpcId,
  q: QuestState,
  r: ReviewQuestState,
  d?: DrillQuestState,
  guide?: GuideTalk | null,
): string[] {
  return guideTalk(npc, guide) ?? talkV6(npc, q, r, d);
}
