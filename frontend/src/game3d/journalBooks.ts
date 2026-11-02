/**
 * Reading the old journal entries in the world (3D sprint S16, PR 2). Pure helpers, no React.
 * The order is the only thing worked out here; every other value is the server's.
 */
import type { JournalEntry } from "../lib/types";

/** Newest decision first; entries on the same day by when they were written, newest first. Does not change the input. */
export function sortedBooks(entries: readonly JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => {
    const byDay = b.decided_on.localeCompare(a.decided_on);
    return byDay !== 0 ? byDay : b.created_at.localeCompare(a.created_at);
  });
}
