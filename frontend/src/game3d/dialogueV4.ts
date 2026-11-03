/**
 * v4 courtyard dialogue (text pass 3, 2026-11-03), from the 3D text review. A full new set of lines, so v1 to v3 stay as they
 * were shown. What changed:
 *  - Barren Wuffet (the Oracle) is warm and speaks in full phrases. Marlie Chunger (the Partner) is clipped and dry.
 *  - One name per thing: "why" (not thesis or reason), "look-back" (not review), "share of the fortress" (not of the portfolio).
 *  - The count is told the way the quest counts it: a holding is done only with BOTH lines (why, and what proves you wrong).
 *    v1 to v3 said "no written reason", which disagreed with the count for a holding that had a why but no wrong-if line.
 * Hand-written, chosen by fixed rules; no model writes a word of it. No buy or sell wording, no cheering, no reward for
 * acting, and unknown stays unknown. Once shown for real, add dialogueV5.ts instead of editing this.
 */
import { IMPORT_PATH } from "./dialogueV2";
import { mostSure, nameList, whichWords } from "./quest";
import type { QuestState, ReviewQuestState } from "./quest";
import type { NpcId } from "./npcs";

export const DIALOGUE_VERSION = "v4";
export { IMPORT_PATH };

export const BARE_PADS_ORACLE: readonly string[] = [
  "The pads are bare. Bring in your holdings and your towers rise here.",
  "Then I will ask why you own each one.",
];

export const DESK_NUDGE: readonly string[] = ["The desk by the keep door is waiting."];

/** True when the Oracle sends the person to the import page, so the panel can show the link. */
export function pointsToImport(npc: NpcId, q: QuestState): boolean {
  return npc === "oracle" && q.status === "empty";
}

/** True when the Oracle sends the person to the desk, so the panel can say so. */
export function pointsToDesk(npc: NpcId, q: QuestState): boolean {
  return npc === "oracle" && q.status === "open";
}

function oracle(q: QuestState): string[] {
  switch (q.status) {
    case "loading":
      return ["One moment, friend. I am opening your journal."];
    case "unreadable":
      return ["I can't read your journal right now, and I won't guess what is in it.", "Try again in a moment."];
    case "empty":
      return [...BARE_PADS_ORACLE];
    case "open": {
      const n = q.missing.length;
      return [
        `${n} of your ${q.total} holdings still need words: ${nameList(q.missing.map((m) => m.name))}.`,
        "Write why you own each one, and what would prove you wrong. Do it now, before the price has an opinion.",
      ];
    }
    case "done":
      return [
        `All ${q.total} holdings have both lines.`,
        "A written why does not prove you right. It is a record you can check later. When a look-back comes due, come back and read it with me.",
      ];
  }
}

function partner(q: QuestState): string[] {
  switch (q.status) {
    case "loading":
    case "unreadable":
      return ["Can't argue from a journal I can't read. Come back when it opens."];
    case "empty":
      return ["Nothing to pick at yet."];
    case "open": {
      const first = q.missing[0];
      const big = first.facts.weightPct !== null ? `, ${first.facts.weightPct}% of the fortress` : "";
      return [
        "No why on paper? Then nothing can prove you wrong. Convenient.",
        `Start with ${first.name}${big}. Biggest tower with a missing line.`,
      ];
    }
    case "done":
      return [
        "Every holding has both lines. The easy part.",
        "Now read each wrong-if line. Would you admit it if it happened?",
      ];
  }
}

function lookbackOracle(r: ReviewQuestState): string[] {
  const n = r.due.length;
  const list = nameList(r.due.map((d) => `${d.name} (${whichWords(d.which)})`));
  return [
    `${n} ${n === 1 ? "entry is" : "entries are"} old enough to look back on: ${list}.`,
    "Read what you wrote then. Next to it, write what really happened. A look-back is not a verdict on you. It keeps the record honest.",
  ];
}

function lookbackPartner(r: ReviewQuestState): string[] {
  const pick = mostSure(r.due);
  if (!pick) return [];
  const sure = pick.confidence !== null ? `, where you wrote ${pick.confidence} out of 5 for confidence` : "";
  return [
    "Look-backs cost little when you were unsure. They cost most when you were sure. Those teach most.",
    `Start with ${pick.name}${sure}.`,
  ];
}

/** What the person says right now, across both quests. The first quest still open speaks. Pure: same state, same words. */
export function talk(npc: NpcId, q: QuestState, r: ReviewQuestState): string[] {
  if (q.status === "done" && r.status === "open") return npc === "oracle" ? lookbackOracle(r) : lookbackPartner(r);
  const lines = npc === "oracle" ? oracle(q) : partner(q);
  return pointsToDesk(npc, q) ? [...lines, ...DESK_NUDGE] : lines;
}
