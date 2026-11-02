import { describe, expect, it } from "vitest";
import type { JournalEntry } from "../lib/types";
import { sortedBooks } from "./journalBooks";

function entry(o: Partial<JournalEntry>): JournalEntry {
  return { id: "e", decided_on: "2026-01-01", created_at: "2026-01-01T08:00:00Z", ...o } as JournalEntry;
}

describe("sortedBooks", () => {
  it("puts the newest decision first and breaks ties by when it was written", () => {
    const a = entry({ id: "a", decided_on: "2026-03-01" });
    const b = entry({ id: "b", decided_on: "2026-05-01" });
    const c = entry({ id: "c", decided_on: "2026-05-01", created_at: "2026-05-01T12:00:00Z" });
    expect(sortedBooks([a, b, c]).map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("does not change the list it was given, and handles none", () => {
    const list = [entry({ id: "a", decided_on: "2026-01-01" }), entry({ id: "b", decided_on: "2026-02-01" })];
    sortedBooks(list);
    expect(list.map((e) => e.id)).toEqual(["a", "b"]);
    expect(sortedBooks([])).toEqual([]);
  });
});
