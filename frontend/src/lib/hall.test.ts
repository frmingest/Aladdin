import { describe, expect, it } from "vitest";
import { ACTION_SPINE, HALL_COPY, HALL_CHROME_BUDGET, SEAL_LOOK, defaultOpenId, spineFor, tomeAria, tomeFor } from "./hall";
import type { DecisionRecord } from "./types";

const rec = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "r1", holding_id: "h1", ticker: "X", company_name: "Acme", action: "buy", decided_on: "2026-01-02", days_since: 100,
  thesis: "t", invalidation: null, confidence: 3, verdict_then: null, verdict_now: null, price_then: "10", price_now: "20", price_now_at: null,
  currency: "NOK", price_change_pct: "100", price_note: null, review_6m: "not_due", review_12m: "not_due", review_6m_text: null, review_12m_text: null, ...over,
});

describe("hall of records mapping", () => {
  it("tells the three seal states apart by shape and word", () => {
    const shapes = new Set(Object.values(SEAL_LOOK).map((s) => s.shape));
    const words = new Set(Object.values(SEAL_LOOK).map((s) => s.word));
    expect(shapes.size).toBe(3);
    expect(words.size).toBe(3);
  });
  it("gives each action its own letter and a fallback for an unknown one", () => {
    expect(new Set(Object.values(ACTION_SPINE).map((a) => a.letter)).size).toBe(Object.keys(ACTION_SPINE).length);
    expect(spineFor("mystery").letter).toBe("·");
  });
  it("wears a bookmark only when a review is owed", () => {
    expect(tomeFor(rec()).owed).toBe(false);
    expect(tomeFor(rec({ review_6m: "due" })).owed).toBe(true);
    expect(tomeFor(rec({ review_12m: "due" })).owed).toBe(true);
    expect(tomeFor(rec({ review_6m: "written", review_12m: "written" })).owed).toBe(false);
  });
  it("never draws a tome differently for its outcome", () => {
    const up = tomeFor(rec({ price_change_pct: "250", verdict_now: "Attractive" }));
    const down = tomeFor(rec({ price_change_pct: "-60", verdict_now: "Avoid", confidence: 1 }));
    expect(up).toEqual(down);
  });
  it("opens the first record with a review owed, else the first", () => {
    expect(defaultOpenId([])).toBeNull();
    expect(defaultOpenId([rec({ id: "a" }), rec({ id: "b", review_12m: "due" })])).toBe("b");
    expect(defaultOpenId([rec({ id: "a" }), rec({ id: "b" })])).toBe("a");
  });
  it("says reviews in the accessible name, with no outcome and no verdict word", () => {
    const label = tomeAria(rec({ review_6m: "due" }));
    expect(label).toMatch(/owed/);
    expect(label).not.toMatch(/\b(win|loss|good|bad|score|profit)\b/i);
  });
  it("keeps its own words short and free of grading language", () => {
    const words = Object.values(HALL_COPY).join(" ").split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(HALL_CHROME_BUDGET + 25);
    expect(Object.values(HALL_COPY).join(" ")).not.toMatch(/\b(buy|sell|score|win|streak|reward|points?)\b/i);
  });
});
