/**
 * What the writing desk sends to the journal (Standing 2). Pure helpers, no React.
 * A desk entry is a NEW journal entry for one holding: the journal needs an action and a date,
 * so the desk records "hold" with today's date (you are writing why you own it now). A real buy
 * or sell still goes through the Journal page. The desk never edits or deletes an old entry.
 */
import type { JournalEntryInput } from "../lib/types";

export const DESK_ACTION = "hold" as const;

/** Today as YYYY-MM-DD on the player's own clock (not UTC, so late evenings do not tip into tomorrow). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DeskDraft {
  holdingId: string;
  why: string;
  wrongIf: string;
}

/** Both lines are needed: Level 3 counts a holding only when it has both. */
export function deskReady(d: DeskDraft): boolean {
  return d.holdingId.length > 0 && d.why.trim().length > 0 && d.wrongIf.trim().length > 0;
}

export function deskInput(d: DeskDraft, now: Date = new Date()): JournalEntryInput {
  return {
    holding_id: d.holdingId,
    action: DESK_ACTION,
    decided_on: todayIso(now),
    thesis: d.why.trim(),
    invalidation: d.wrongIf.trim(),
  };
}

/** Why the desk cannot save right now, in words; null when it can. */
export type DeskBlock = "sample" | "unreadable" | "loading" | "empty";

export const DESK_BLOCK_WORDS: Record<DeskBlock, string> = {
  sample: "Sample fortress, not yours. Nothing is saved here.",
  unreadable: "Can't read your journal right now. Nothing is saved.",
  loading: "Reading your journal...",
  empty: "No holdings yet, so nothing to write.",
};

export function deskBlock(demo: boolean, status: "loading" | "unreadable" | "empty" | "open" | "done"): DeskBlock | null {
  if (demo) return "sample";
  if (status === "unreadable") return "unreadable";
  if (status === "loading") return "loading";
  if (status === "empty") return "empty";
  return null;
}
