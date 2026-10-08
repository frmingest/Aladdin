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
  ravenReadable,
  ravensTabLabel,
  groupSummary,
  saveSeen,
  splitRavens,
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

describe("ravenReadable (G31)", () => {
  it("gives the reader what it needs to open the raven's report", () => {
    const r = raven("a", { document_id: "d1", document_filename: "fy25.xhtml", document_type: "annual_report" });
    expect(ravenReadable(r)).toEqual({
      id: "d1", original_filename: "fy25.xhtml", type: "annual_report", reporting_period: "FY2025",
    });
  });
  it("has nothing to open for a raven without a stored report (demo) or an old payload", () => {
    expect(ravenReadable(raven("a"))).toBeNull();
    expect(ravenReadable(raven("b", { document_id: "d2" }))).toBeNull();
  });
  it("leaves the type undefined when the API did not send one", () => {
    expect(ravenReadable(raven("c", { document_id: "d3", document_filename: "x.pdf" }))?.type).toBeUndefined();
  });
});

describe("recent first (48 hours)", () => {
  const NOW = "2026-10-08T18:00:00Z";
  const at = (hoursAgo: number) => new Date(Date.parse(NOW) - hoursAgo * 3_600_000).toISOString();
  const r = (id: string, hoursAgo: number, over: Partial<Raven> = {}) =>
    raven(id, { captured_at: at(hoursAgo), age_days: Math.floor(hoursAgo / 24), ...over });

  it("puts the last 48 hours first and groups everything older per company", () => {
    const list = [
      r("old-a1", 100, { holding_id: "A", name: "Alpha" }),
      r("new-b", 3, { holding_id: "B", name: "Beta" }),
      r("old-a2", 120, { holding_id: "A", name: "Alpha" }),
      r("old-c", 90, { holding_id: "C", name: "Gamma" }),
      r("new-a", 47, { holding_id: "A", name: "Alpha" }),
    ];
    const split = splitRavens(list, new Set(), NOW);
    expect(split.recent.map((x) => x.id)).toEqual(["new-b", "new-a"]);
    expect(split.earlierCount).toBe(3);
    expect(split.earlier.map((g) => g.name)).toEqual(["Gamma", "Alpha"]);
    expect(split.earlier[1].ravens.map((x) => x.id)).toEqual(["old-a1", "old-a2"]);
    expect(groupSummary(split.earlier[1])).toBe("2 reports · newest 4 days ago");
  });

  it("drops seen ravens and honours the portfolio / watchlist filter", () => {
    const list = [
      r("a", 1, { in_portfolio: true }),
      r("b", 2, { in_portfolio: false }),
      r("c", 200, { in_portfolio: false, holding_id: "W" }),
    ];
    expect(splitRavens(list, new Set(["a"]), NOW).recent.map((x) => x.id)).toEqual(["b"]);
    expect(splitRavens(list, new Set(), NOW, "portfolio").recent.map((x) => x.id)).toEqual(["a"]);
    const watch = splitRavens(list, new Set(), NOW, "watchlist");
    expect(watch.recent.map((x) => x.id)).toEqual(["b"]);
    expect(watch.earlierCount).toBe(1);
  });

  it("counts a raven exactly at the cut-off as recent, and survives a bad clock or date", () => {
    expect(splitRavens([r("edge", 48)], new Set(), NOW).recent).toHaveLength(1);
    expect(splitRavens([r("just-over", 48.01)], new Set(), NOW).recent).toHaveLength(0);
    expect(() => splitRavens([r("x", 1)], new Set(), "junk")).not.toThrow();
    expect(splitRavens([raven("bad", { captured_at: "nope" })], new Set(), NOW).earlierCount).toBe(1);
    expect(splitRavens([], new Set(), null)).toEqual({ recent: [], earlier: [], earlierCount: 0 });
  });

  it("labels the tab with new ravens only", () => {
    expect(ravensTabLabel(0)).toBe("Ravens");
    expect(ravensTabLabel(4)).toBe("Ravens · 4 new");
  });
});
