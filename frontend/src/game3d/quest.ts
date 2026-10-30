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

/* ------------------------------------------------------------------------- */
/* Quest 2, "Six-Month Reckoning" (game3d, week 4).                           */
/* ------------------------------------------------------------------------- */

export type ReviewQuestStatus = "loading" | "unreadable" | "empty" | "open" | "clear";
export type ReviewWhich = "6m" | "12m" | "both";

export interface DueReview {
  entryId: string;
  name: string;
  ticker: string;
  which: ReviewWhich;
  /** Days since the decision was written, as the journal service counted them. */
  daysSince: number;
  /** The 1 to 5 confidence written at the time; null when none was written. */
  confidence: number | null;
}

export interface ReviewQuestState {
  status: ReviewQuestStatus;
  /** Journal entries of any age. */
  entries: number;
  /** Reviews that are due and still unwritten, oldest decision first. */
  due: DueReview[];
}

export const REVIEW_QUEST_TITLE = "Six-Month Reckoning";
export const REVIEW_QUEST_GOAL =
  "When a journal entry is six months old, write what actually happened next to what you expected.";

/**
 * Derived, never stored. "Due" is the journal service's own flag
 * (`outcome.review_6m_due` / `review_12m_due`: old enough and no review text yet);
 * the 182- and 365-day rules stay in the backend and are not repeated here.
 * Nothing about prices or returns is read, so the quest cannot nudge a verdict.
 */
export function sixMonthReckoning(entries: readonly JournalEntry[] | null, failed: boolean): ReviewQuestState {
  if (failed) return { status: "unreadable", entries: 0, due: [] };
  if (entries === null) return { status: "loading", entries: 0, due: [] };
  if (entries.length === 0) return { status: "empty", entries: 0, due: [] };
  const due: DueReview[] = [];
  for (const e of entries) {
    const d6 = e.outcome.review_6m_due;
    const d12 = e.outcome.review_12m_due;
    if (!d6 && !d12) continue;
    due.push({
      entryId: e.id,
      name: e.company_name,
      ticker: e.ticker,
      which: d6 && d12 ? "both" : d6 ? "6m" : "12m",
      daysSince: e.outcome.days_since,
      confidence: e.confidence,
    });
  }
  due.sort((a, b) => b.daysSince - a.daysSince || a.name.localeCompare(b.name));
  return { status: due.length > 0 ? "open" : "clear", entries: entries.length, due };
}

export function whichWords(w: ReviewWhich): string {
  return w === "6m" ? "6 months" : w === "12m" ? "12 months" : "6 and 12 months";
}

/** The due entry the Partner points at: the one written with the highest confidence, else the oldest. */
export function mostSure(due: readonly DueReview[]): DueReview | null {
  if (due.length === 0) return null;
  let best = due[0];
  for (const d of due) if ((d.confidence ?? 0) > (best.confidence ?? 0)) best = d;
  return best;
}
