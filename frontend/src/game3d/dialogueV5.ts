/**
 * v5 courtyard dialogue (2026-11-10). v4 stays exactly as it was shown; this adds one thing on top of it: once both
 * journal quests are quiet (every holding has both lines, no look-back is due), the Oracle and the Partner point you at
 * the Storm Drill post, the third quest, if no drill has been written yet.
 *
 * Hand-written, chosen by fixed rules; no model writes a word of it. No buy or sell wording, no cheering, no reward
 * for acting. Drill status that is not "open" (loading, unreadable, sample, done) says nothing extra: unknown stays
 * unknown, and a done drill needs no nudge. Once shown for real, add dialogueV6.ts instead of editing this.
 */
import { IMPORT_PATH, pointsToImport, pointsToDesk, BARE_PADS_ORACLE, DESK_NUDGE, talk as talkV4 } from "./dialogueV4";
import type { NpcId } from "./npcs";
import type { QuestState, ReviewQuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";

export const DIALOGUE_VERSION = "v5";
export { IMPORT_PATH, pointsToImport, pointsToDesk, BARE_PADS_ORACLE, DESK_NUDGE };

export const DRILL_ORACLE: readonly string[] = [
  "Your whys are written. One rehearsal is left: the drill post on the west side of the courtyard.",
  "Pick a fall, then write what you would do before it happens. Nothing is traded, nothing is sent.",
];

export const DRILL_PARTNER: readonly string[] = [
  "Plans are easy while the market is green.",
  "Drill post, west side. Write yours before it hurts.",
];

/** True when the person should be pointed at the drill post: both journal quests are quiet and no drill is written. */
export function pointsToDrill(q: QuestState, r: ReviewQuestState, d: DrillQuestState | undefined): boolean {
  return q.status === "done" && r.status !== "open" && d?.status === "open";
}

/** What the person says right now, across all three quests. Pure: same state, same words. */
export function talk(npc: NpcId, q: QuestState, r: ReviewQuestState, d?: DrillQuestState): string[] {
  if (pointsToDrill(q, r, d)) return npc === "oracle" ? [...DRILL_ORACLE] : [...DRILL_PARTNER];
  return talkV4(npc, q, r);
}
