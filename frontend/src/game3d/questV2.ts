/**
 * Quest 1, version 2 (Standing 2, 2026-10-31): "Unwritten Thesis" now needs BOTH lines on a
 * holding: why you own it, and what would prove you wrong. That is the same test Level 3 (Reasons)
 * uses in the backend, so the quest and the level can no longer disagree. quest.ts (version 1,
 * reason only) is left as it was; this file is the one the courtyard uses.
 *
 * Derived, never stored: worked out fresh from the journal every render. If the journal cannot be
 * read the quest says so; it never guesses.
 */
import type { JournalEntry } from "../lib/types";
import type { QuestState } from "./quest";
import type { TowerView } from "./stateToWorld";

export const QUEST_VERSION = "v2";

/** One entry counts when it names a holding and has both lines, not blank. */
export function entryIsWritten(e: Pick<JournalEntry, "holding_id" | "thesis" | "invalidation">): boolean {
  return Boolean(e.holding_id) && (e.thesis ?? "").trim().length > 0 && (e.invalidation ?? "").trim().length > 0;
}

export function unwrittenThesisV2(
  holdings: readonly TowerView[],
  entries: readonly JournalEntry[] | null,
  failed: boolean,
): QuestState {
  const total = holdings.length;
  if (failed) return { status: "unreadable", total, written: 0, missing: [] };
  if (entries === null) return { status: "loading", total, written: 0, missing: [] };
  if (total === 0) return { status: "empty", total, written: 0, missing: [] };
  const written = new Set<string>();
  for (const e of entries) {
    if (entryIsWritten(e) && e.holding_id) written.add(e.holding_id);
  }
  const missing = holdings.filter((h) => !written.has(h.holdingId));
  return {
    status: missing.length === 0 ? "done" : "open",
    total,
    written: total - missing.length,
    missing,
  };
}

/** Quest log words for version 2 (game voice, short). */
export const QUEST_V2_GOAL = "Write why you own each holding. Write what proves you wrong.";
export const QUEST_V2_DONE = "Done! Every holding has both lines.";
export const QUEST_V2_BAR_LABEL = "Holdings with a reason and a wrong-if line";
