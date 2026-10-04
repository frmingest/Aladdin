import { describe, expect, it } from "vitest";
import {
  actionLabel,
  changeText,
  circleSegments,
  COUNCIL_LABEL,
  daysText,
  filterRecords,
  priceLine,
  REVIEW_LABEL,
  verdictLine,
  weightText,
} from "./rituals";
import type { DecisionRecord } from "./types";

const rec = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "1", holding_id: "h", ticker: "AAA.OL", company_name: "Alpha", action: "buy", decided_on: "2026-01-01",
  days_since: 100, thesis: "why", invalidation: null, confidence: 3, verdict_then: "Buy", verdict_now: "Buy",
  price_then: "100", price_now: "120", price_now_at: null, currency: "NOK", price_change_pct: "20",
  price_note: null, review_6m: "not_due", review_12m: "not_due", review_6m_text: null, review_12m_text: null, ...over,
});

describe("price and verdict wording", () => {
  it("formats the change with a sign and never calls an unknown 0", () => {
    expect(changeText("20")).toBe("+20.0%");
    expect(changeText("-3.44")).toBe("-3.4%");
    expect(changeText("0")).toBe("0.0%");
    expect(changeText(null)).toBe("unknown");
    expect(changeText("x")).toBe("unknown");
  });
  it("says why a price cannot be compared", () => {
    expect(priceLine(rec({ price_then: null }))).toMatch(/No price was written/);
    expect(priceLine(rec({ price_now: null, price_note: "no stored price since the decision" }))).toBe(
      "no stored price since the decision",
    );
    expect(priceLine(rec())).toContain("(+20.0%)");
  });
  it("reports verdict then and now, with unknown when missing", () => {
    expect(verdictLine(rec())).toBe("Analyst verdict then and now: Buy");
    expect(verdictLine(rec({ verdict_now: "Sell" }))).toBe("Analyst verdict then: Buy; now: Sell");
    expect(verdictLine(rec({ verdict_then: null, verdict_now: null }))).toContain("none recorded");
  });
  it("uses no verdict words about the decision itself", () => {
    const text = [priceLine(rec()), verdictLine(rec()), ...Object.values(REVIEW_LABEL), ...Object.values(COUNCIL_LABEL)].join(" ");
    expect(text).not.toMatch(/\b(good|bad|right|wrong|win|loss|score|hit)\b/i);
  });
});

describe("labels and filters", () => {
  it("labels actions and passes unknown ones through", () => {
    expect(actionLabel("trim")).toBe("Trimmed");
    expect(actionLabel("swap")).toBe("swap");
  });
  it("filters to owed reviews", () => {
    const rs = [rec({ id: "a" }), rec({ id: "b", review_6m: "due" }), rec({ id: "c", review_12m: "due" })];
    expect(filterRecords(rs, true).map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterRecords(rs, false)).toHaveLength(3);
  });
  it("words elapsed time", () => {
    expect(daysText(0)).toBe("today");
    expect(daysText(30)).toBe("30 days ago");
    expect(daysText(200)).toBe("7 months ago");
    expect(daysText(900)).toBe("2.5 years ago");
  });
  it("shows a missing weight as unknown", () => {
    expect(weightText(null)).toBe("unknown");
    expect(weightText("12.345")).toBe("12.3%");
  });
});

describe("circle bar", () => {
  it("drops empty segments and keeps unmarked separate from inside", () => {
    const s = circleSegments({
      inside_weight_pct: "30", edge_weight_pct: "0", outside_weight_pct: "20", unmarked_weight_pct: "15", unclassified_weight_pct: "0",
    });
    expect(s.map((x) => x.key)).toEqual(["inside", "outside", "unmarked"]);
  });
});
