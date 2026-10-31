/**
 * v2 courtyard dialogue (Standing 1, 2026-10-31). Everything is as in dialogueV1 except one
 * thing: with no holdings, the Oracle no longer stops at "the pads are bare". He says what is
 * missing and where to start (Level 1, Bare Ground). Hand-written, chosen by fixed rules; no
 * model writes a word of it. Same voice rules as v1: no buy/sell wording, no cheering, no reward
 * for acting, unknown stays unknown. Once shown for real, add dialogueV3.ts instead of editing this.
 */
import { talk as talkV1 } from "./dialogueV1";
import type { NpcId } from "./npcs";
import type { QuestState, ReviewQuestState } from "./quest";

export const DIALOGUE_VERSION = "v2";

/** Where the first step happens: the existing Portfolio page takes the broker export. */
export const IMPORT_PATH = "/portfolio";

export const BARE_PADS_ORACLE: readonly string[] = [
  "The pads are bare. Upload your broker export and your towers rise here.",
  "Then I will ask why you own each one.",
];

/** True when the Oracle is sending the person to the import page, so the panel can show the link. */
export function pointsToImport(npc: NpcId, q: QuestState): boolean {
  return npc === "oracle" && q.status === "empty";
}

export function talk(npc: NpcId, q: QuestState, r: ReviewQuestState): string[] {
  if (pointsToImport(npc, q)) return [...BARE_PADS_ORACLE];
  return talkV1(npc, q, r);
}
