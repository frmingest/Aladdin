/**
 * v1 courtyard dialogue (2026-10-30). Hand-written, chosen by fixed rules from the
 * quest state; no model writes a word of it. Original wording in the spirit of the
 * two Fortress advisors, never presented as quotations from anyone real.
 *
 * Voice rules (same as backend advisor_lines_v1): state what the stored data shows,
 * then what to look at. No buy/sell wording, no cheering, no reward for acting, and
 * unknown stays unknown. Once shown for real, add dialogueV2.ts instead of editing this.
 */
import { nameList } from "./quest";
import type { QuestState } from "./quest";
import type { NpcId } from "./npcs";

export const DIALOGUE_VERSION = "v1";

function oracle(q: QuestState): string[] {
  switch (q.status) {
    case "loading":
      return ["One moment. I am opening your journal."];
    case "unreadable":
      return ["I cannot read your journal right now, and I will not guess what is in it.", "Try again in a moment."];
    case "empty":
      return ["The pads are bare. When a holding stands here, I will ask you why you own it."];
    case "open": {
      const n = q.missing.length;
      return [
        `${n} of your ${q.total} holdings have no written reason: ${nameList(q.missing.map((m) => m.name))}.`,
        "Write down why you own each one, and what would prove you wrong. Do it in your own words, before the price has an opinion.",
      ];
    }
    case "done":
      return [
        `All ${q.total} holdings have a written reason.`,
        "A written reason is not proof you are right. It is a record you can check later. When a review comes due, come back and read it with me.",
      ];
  }
}

function partner(q: QuestState): string[] {
  switch (q.status) {
    case "loading":
    case "unreadable":
      return ["I do not argue from a journal I cannot read. Come back when it opens."];
    case "empty":
      return ["Nothing to pick at yet."];
    case "open": {
      const first = q.missing[0];
      const big = first.facts.weightPct !== null ? `, ${first.facts.weightPct}% of the portfolio` : "";
      return [
        "Invert it. A holding with no written reason is one you can never be shown wrong about, and that suits the part of you that wants to be right.",
        `Start with ${first.name}${big}. It is the largest tower without a reason.`,
      ];
    }
    case "done":
      return [
        "Every one has a reason. That was the easy part.",
        "Read the line that says what would prove you wrong, one holding at a time, and ask whether you would honestly admit it if it happened.",
      ];
  }
}

/** Paragraphs the NPC says right now. Pure: the same quest state gives the same words. */
export function lines(npc: NpcId, q: QuestState): string[] {
  return npc === "oracle" ? oracle(q) : partner(q);
}
