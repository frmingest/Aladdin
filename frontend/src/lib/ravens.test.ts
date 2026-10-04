import { describe, expect, it } from "vitest";
import {
  MAX_SEEN,
  SEEN_KEY,
  ageText,
  loadSeen,
  markSeen,
  ravenHeading,
  ravenHoldingIds,
  ravenOneLine,
  saveSeen,
  unseen,
} from "./ravens";
import type { Raven } from "./types";

const raven = (id: string, over: Partial<Raven> = {}): Raven => ({
  id, kind: "figures", holding_id: `h-${id}`, ticker: "AAA.OL", name: "Alpha", in_portfolio: true, period: "FY2025",
  previous_period: "FY2024", captured_at: "2026-10-02T00:00:00Z", age_days: 2, document_id: null,
  summary: "Against FY2024: 1 better, 1 worse, 0 steady.", better: 1, worse: 1, lines: [], ...over,
});

const memory = (initial: string | null = null) => {
  let value = initial;
  return {
    getItem: (k: string) => (k === SEEN_KEY ? value : null),
    setItem: (k: string, v: string) => {
      if (k === SEEN_KEY) value = v;
    },
    read: () => value,
  };
};

describe("seen state", () => {
  it("round-trips ids and survives junk, blocked or missing storage", () => {
    const store = memory();
    saveSeen(new Set(["a", "b"]), store);
    expect([...loadSeen(store)]).toEqual(["a", "b"]);
    expect(loadSeen(memory("not json")).size).toBe(0);
    expect(loadSeen(memory('{"a":1}')).size).toBe(0);
    expect([...loadSeen(memory('["a",3,"b"]'))]).toEqual(["a", "b"]);
    expect(loadSeen(null).size).toBe(0);
    expect(() => saveSeen(new Set(["a"]), null)).not.toThrow();
    const throwing = { setItem: () => { throw new Error("quota"); } };
    expect(() => saveSeen(new Set(["a"]), throwing)).not.toThrow();
    const exploding = { getItem: () => { throw new Error("blocked"); } };
    expect(loadSeen(exploding).size).toBe(0);
  });

  it("keeps only the newest ids once the cap is passed", () => {
    const store = memory();
    saveSeen(new Set(Array.from({ length: MAX_SEEN + 20 }, (_, i) => `id${i}`)), store);
    const saved = JSON.parse(store.read() ?? "[]") as string[];
    expect(saved).toHaveLength(MAX_SEEN);
    expect(saved[saved.length - 1]).toBe(`id${MAX_SEEN + 19}`);
  });

  it("filters unseen ravens and names the towers they sit on", () => {
    const ravens = [raven("a"), raven("b"), raven("c")];
    const seen = markSeen(new Set(["a"]), ["b"]);
    expect(unseen(ravens, seen).map((r) => r.id)).toEqual(["c"]);
    expect([...ravenHoldingIds(ravens, seen)]).toEqual(["h-c"]);
    expect(seen.has("b")).toBe(true);
  });
});

describe("wording", () => {
  it("says when a report landed", () => {
    expect(ageText(0)).toBe("today");
    expect(ageText(1)).toBe("yesterday");
    expect(ageText(5)).toBe("5 days ago");
  });

  it("heads and summarises a figures raven and a text-only raven", () => {
    expect(ravenHeading(raven("a"))).toBe("Alpha: FY2025 captured");
    expect(ravenHeading(raven("a", { kind: "text_only", period: null }))).toBe("Alpha: a report was captured");
    const withLines = raven("a", { lines: [{ metric: "roic", label: "ROIC", previous: null, current: null, direction: "better", text: "x" }, { metric: "roe", label: "ROE", previous: null, current: null, direction: "worse", text: "y" }] });
    expect(ravenOneLine(withLines)).toBe("1 better, 1 worse of 2 measures against FY2024.");
    expect(ravenOneLine(raven("a", { kind: "text_only", summary: "No figures." }))).toBe("No figures.");
  });

  it("never gives advice in any label", () => {
    const text = [ageText(3), ravenHeading(raven("a")), ravenOneLine(raven("a"))].join(" ");
    expect(text).not.toMatch(/\b(buy|sell|add|trim|invest|purchase)\b/i);
  });
});
