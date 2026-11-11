/**
 * v6 courtyard dialogue (2026-11-11), a plain-words pass from a game-design and a UX review. v4 and v5 stay exactly as
 * they were shown; the panel now reads this file. What changed:
 *  - The task is said once, in plain words: a holding needs a "why" (why you own it) and "what would prove you wrong".
 *    v4 said "needs words", "both lines", "wrong-if" and "missing line" for the same thing.
 *  - The share of the fortress is shown the way a person says it ("about 17%"), never as the raw 25-digit number the
 *    backend sends. Rounding only changes the display; the stored figure is untouched, and a share that is already
 *    round ("40%") is shown exactly.
 *  - The desk is placed: the advisors now stand just inside the gate, so the Oracle and the Partner both say it is
 *    straight on toward the keep, on your left. A test ties those words to the real coordinates.
 *  - Short sentences, one idea each. Barren Wuffet stays warm and in full phrases; Marlie Chunger stays clipped and dry.
 * Hand-written, chosen by fixed rules; no model writes a word of it. No buy or sell wording, no cheering, no reward for
 * acting, and unknown stays unknown. Once shown for real, add dialogueV7.ts instead of editing this.
 */
import { IMPORT_PATH } from "./dialogueV4";
import { DRILL_ORACLE, DRILL_PARTNER, pointsToDrill } from "./dialogueV5";
import { mostSure, nameList, whichWords } from "./quest";
import type { QuestState, ReviewQuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";
import type { NpcId } from "./npcs";

export const DIALOGUE_VERSION = "v6";
export { IMPORT_PATH };
// The drill post lines were already short and plain in v5, so v6 keeps them as they are.
export { DRILL_ORACLE, DRILL_PARTNER, pointsToDrill };

/** What a "why" is, said once, in the words the quest log and the desk already use. */
export const WHY_EXPLAINED = "A why is two short notes: why you own it, and what would prove you wrong.";

/** Where the desk is, as seen by someone who has just walked in through the gate. A test checks it against `DESK`. */
export const DESK_WHERE = "straight on toward the keep, on your left";
export const DESK_NUDGE: readonly string[] = [`Write them at the desk. It is ${DESK_WHERE}.`];

export const BARE_PADS_ORACLE: readonly string[] = [
  "No holdings yet. Bring yours in and they appear around the fortress.",
  "Then we write why you own each one.",
];

/**
 * A share of the fortress, said the way a person says it. 10% and up is a whole number, under 10% keeps one decimal.
 * Exact figures stay exact ("40%"); anything rounded says "about". Null (no share, or not a number) stays unknown.
 */
export function sayShare(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 0 && n < 0.05) return "under 0.1%";
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${Math.abs(rounded - n) < 1e-9 ? "" : "about "}${rounded}%`;
}

/** True when the Oracle sends the person to the import page, so the panel can show the link. */
export function pointsToImport(npc: NpcId, q: QuestState): boolean {
  return npc === "oracle" && q.status === "empty";
}

/** True when the Oracle sends the person to the desk. (Both advisors now say where it is; v4 only had the Oracle say it.) */
export function pointsToDesk(npc: NpcId, q: QuestState): boolean {
  return npc === "oracle" && q.status === "open";
}

function oracle(q: QuestState): string[] {
  switch (q.status) {
    case "loading":
      return ["One moment, friend. I am opening your journal."];
    case "unreadable":
      return ["I can't open your journal just now, and I won't guess what is in it.", "Try again in a moment."];
    case "empty":
      return [...BARE_PADS_ORACLE];
    case "open": {
      const n = q.missing.length;
      const names = nameList(q.missing.map((m) => m.name));
      return [
        n === 1 ? `One holding has no why yet: ${names}.` : `${n} of your ${q.total} holdings have no why yet: ${names}.`,
        WHY_EXPLAINED,
        ...DESK_NUDGE,
      ];
    }
    case "done":
      return [
        `All ${q.total} holdings have their why and what would prove you wrong.`,
        "A written why is not proof. It is a record you can check later. When a look-back is due, come back and we will read it together.",
      ];
  }
}

function partner(q: QuestState): string[] {
  switch (q.status) {
    case "loading":
      return ["Wait. The journal is still opening."];
    case "unreadable":
      return ["Journal won't open. Nothing to say yet.", "Try again."];
    case "empty":
      return ["No holdings. Nothing to judge.", "Bring them in."];
    case "open": {
      const n = q.missing.length;
      const first = q.missing[0];
      const share = sayShare(first.facts.weightPct);
      const where = share ? `${first.name}: ${share} of your fortress.` : `${first.name}.`;
      return [
        n === 1 ? `${where} No why yet.` : `${n} holdings with no why. The biggest is ${where}`,
        `Write two notes: why you own it, what proves you wrong. The desk is ${DESK_WHERE}.`,
      ];
    }
    case "done":
      return [
        `All ${q.total} written. That was the easy part.`,
        "Now reread what would prove you wrong. Would you admit it if it happened?",
      ];
  }
}

function lookbackOracle(r: ReviewQuestState): string[] {
  const n = r.due.length;
  const list = nameList(r.due.map((d) => `${d.name} (${whichWords(d.which)})`));
  return [
    n === 1 ? `One note is old enough to look back on: ${list}.` : `${n} notes are old enough to look back on: ${list}.`,
    "Read what you wrote then. Next to it, write what really happened. It is not a verdict on you. It keeps the record honest.",
  ];
}

function lookbackPartner(r: ReviewQuestState): string[] {
  const pick = mostSure(r.due);
  if (!pick) return [];
  const n = r.due.length;
  const sure = pick.confidence !== null ? `, where you were ${pick.confidence} out of 5 sure` : "";
  return [
    `${n === 1 ? "1 look-back due." : `${n} look-backs due.`} Start with ${pick.name}${sure}.`,
    "The ones you were sure about teach the most.",
  ];
}

/** What the person says right now, across all three quests. The first quest still open speaks. Pure: same state, same words. */
export function talk(npc: NpcId, q: QuestState, r: ReviewQuestState, d?: DrillQuestState): string[] {
  if (pointsToDrill(q, r, d)) return npc === "oracle" ? [...DRILL_ORACLE] : [...DRILL_PARTNER];
  if (q.status === "done" && r.status === "open") return npc === "oracle" ? lookbackOracle(r) : lookbackPartner(r);
  return npc === "oracle" ? oracle(q) : partner(q);
}

/** The close button: "Not now" when the panel also offers a next step (import, retry), else "Got it". The key stays E. */
export function closeLabel(npc: NpcId, q: QuestState): string {
  return pointsToImport(npc, q) || q.status === "unreadable" ? "Not now (E)" : "Got it (E)";
}
