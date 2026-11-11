/**
 * v7 courtyard dialogue (2026-11-11): the Guide speaks first. While one of the five First Steps is open (and has words
 * of its own), the advisors say that; otherwise v6 speaks exactly as before. v6 stays untouched and everything else here is
 * re-exported from it. The Guide's words live in `guideWordsV1.ts`.
 */
import { guideLines } from "./guideWordsV1";
import type { GuideStatus } from "./guideQuests";
import type { NpcId } from "./npcs";
import type { QuestState, ReviewQuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";
import { talk as talkV6 } from "./dialogueV6";

export {
  DESK_NUDGE,
  DESK_WHERE,
  IMPORT_PATH,
  WHY_EXPLAINED,
  closeLabel,
  pointsToDesk,
  pointsToImport,
  sayShare,
} from "./dialogueV6";

export const DIALOGUE_VERSION = "v7";

/** What the Guide looked like when you walked up (before the talk counted), so the words match the step you came for. */
export interface GuideTalk {
  status: GuideStatus;
  /** The advisors you had already met when you walked up. */
  met: readonly NpcId[];
}

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
