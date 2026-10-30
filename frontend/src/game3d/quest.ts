/**
 * Quest 1, "Unwritten Thesis" (game3d, week 3).
 *
 * Derived, never stored: the quest is "every holding has a written reason in the
 * decision journal". It reads the journal the app already keeps and computes the
 * answer fresh each time, so there is no quest save file to drift from the truth,
 * no XP and no reward. If the journal cannot be read the quest says so; it never
 * guesses a status.
 */
import type { JournalEntry } from "../lib/types";
import type { TowerView } from "./stateToWorld";

export type QuestStatus = "loading" | "unreadable" | "empty" | "open" | "done";

export interface QuestState {
  status: QuestStatus;
  /** Holdings in the fortress (all of them, not only those on a pad). */
  total: number;
  written: number;
  /** Holdings with no written reason, biggest first (same order as the Fortress). */
  missing: TowerView[];
}

export const QUEST_TITLE = "Unwritten Thesis";
export const QUEST_GOAL = "Write down why you own each holding, and what would prove you wrong.";

export function unwrittenThesis(
  holdings: readonly TowerView[],
  entries: readonly JournalEntry[] | null,
  failed: boolean,
): QuestState {
  const total = holdings.length;
  if (failed) return { status: "unreadable", total, written: 0, missing: [] };
  if (entries === null) return { status: "loading", total, written: 0, missing: [] };
  if (total === 0) return { status: "empty", total, written: 0, missing: [] };
  const withReason = new Set<string>();
  for (const e of entries) {
    if (e.holding_id && e.thesis.trim().length > 0) withReason.add(e.holding_id);
  }
  const missing = holdings.filter((h) => !withReason.has(h.holdingId));
  return {
    status: missing.length === 0 ? "done" : "open",
    total,
    written: total - missing.length,
    missing,
  };
}

/** "A, B and C", capped so a long list stays readable. */
export function nameList(names: readonly string[], max = 4): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}
