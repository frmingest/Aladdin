/**
 * v3 courtyard dialogue (Standing 2, 2026-10-31). Everything is as in dialogueV2 except one
 * thing: while some holding still lacks a reason or a wrong-if line, the Oracle points to the
 * writing desk instead of leaving the question open. Hand-written, chosen by fixed rules; no model
 * writes a word of it. Same voice rules: no buy/sell wording, no cheering, no reward for acting.
 * Once shown for real, add dialogueV4.ts instead of editing this.
 */
import { talk as talkV2 } from "./dialogueV2";
import type { NpcId } from "./npcs";
import type { QuestState, ReviewQuestState } from "./quest";

export const DIALOGUE_VERSION = "v3";

export const DESK_NUDGE: readonly string[] = ["Walk to the desk by the keep door. Write why. Write what proves you wrong."];

/** True when the Oracle sends the person to the desk, so the panel can say so. */
export function pointsToDesk(npc: NpcId, q: QuestState): boolean {
  return npc === "oracle" && q.status === "open";
}

export function talk(npc: NpcId, q: QuestState, r: ReviewQuestState): string[] {
  const lines = talkV2(npc, q, r);
  if (pointsToDesk(npc, q)) return [...lines, ...DESK_NUDGE];
  return lines;
}
