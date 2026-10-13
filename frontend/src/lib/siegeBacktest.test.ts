import { describe, expect, it } from "vitest";
import {
  allBacktestLines,
  barScale,
  barWidth,
  bookLines,
  episodeLine,
  gapWords,
  holdingBacktestLine,
  pct,
  shortDate,
  summaryLine,
} from "./siegeBacktest";
import type { SiegeBacktest, SiegeBacktestHolding } from "./types";

const row = (over: Partial<SiegeBacktestHolding> = {}): SiegeBacktestHolding => ({
  holding_id: "h1", ticker: "AAA.OL", name: "Alpha", weight_pct: "40", tested: true, verdict: "fell_more", beta: "0.50",
  beta_basis: "without_episode", predicted: "-0.0915", actual: "-0.3350", error: "-0.2440", reason: null, caution: null, ...over,
});

const bt = (over: Partial<SiegeBacktest> = {}): SiegeBacktest => ({
  backtest_version: "v1", scenarios_version: "v3", demo: false, benchmark_ticker: "OSEBX.OL", status: "ok", status_reason: "",
  window_start: "2024-10-14", window_end: "2026-10-12", episode: null, holdings: [row()], tested_count: 1, total_count: 3,
  tested_value_share: "0.6667", close_count: 0, fell_more_count: 1, fell_less_count: 0, mean_abs_error: "0.2440",
  close_points: "0.05", book: null, book_reason: null, notes: [], ...over,
});

describe("formatting", () => {
  it("signs percentages and survives junk", () => {
    expect(pct("-0.183")).toBe("-18.3%");
    expect(pct("0.04")).toBe("+4.0%");
    expect(pct(null)).toBe("—");
    expect(pct("x")).toBe("—");
  });
  it("words a date", () => {
    expect(shortDate("2026-03-12")).toBe("12 Mar 2026");
  });
  it("describes the episode", () => {
    const line = episodeLine({ peak_date: "2026-03-12", trough_date: "2026-03-26", fall: "-0.1829", trading_days: 11, recovered: false, significant: true }, "OSEBX.OL");
    expect(line).toBe("OSEBX.OL fell 18.3% from its high on 12 Mar 2026 to its low on 26 Mar 2026 (11 trading days).");
  });
});

describe("gap and rows", () => {
  it("signs the gap in plain words", () => {
    expect(gapWords("-0.2440")).toBe("24.4 points worse than the page said");
    expect(gapWords("0.062")).toBe("6.2 points better than the page said");
    expect(gapWords("0.0001")).toBe("No gap");
    expect(gapWords(null)).toBe("");
  });
  it("words a tested and an untested row", () => {
    expect(holdingBacktestLine(row())).toContain("would have said -9.2%; it did -33.5%");
    expect(holdingBacktestLine(row({ tested: false, reason: "no price history stored for this holding" }))).toBe("no price history stored for this holding");
  });
  it("summarises counts and coverage", () => {
    const s = summaryLine(bt());
    expect(s).toContain("1 of 3 holdings could be tested, 67% of the portfolio value");
    expect(s).toContain("average gap was 24.4 points");
  });
});

describe("bars", () => {
  it("scales to the longest bar and draws no bar for a gain", () => {
    const rows = [row(), row({ predicted: "0.02", actual: "0.03" })];
    const scale = barScale(rows);
    expect(scale).toBeCloseTo(0.335);
    expect(barWidth("-0.335", scale)).toBe(100);
    expect(barWidth("-0.0915", scale)).toBe(27);
    expect(barWidth("0.03", scale)).toBe(0);
    expect(barWidth(null, scale)).toBe(0);
  });
  it("never scales below 5%", () => {
    expect(barScale([row({ predicted: "-0.01", actual: "-0.02" })])).toBe(0.05);
  });
});

describe("book lines", () => {
  const book = { holdings_used: 2, value_share: "0.6", days: 400, predicted_fall: "-0.1", actual_fall: "-0.14", error: "-0.04", max_drawdown: "-0.2", max_drawdown_peak: "2026-03-12", max_drawdown_trough: "2026-03-26", longest_under_water_days: 90, under_water_now_days: 12 };
  it("reports the replay, its worst fall and days under water", () => {
    const lines = bookLines(book);
    expect(lines[0]).toContain("-14.0%");
    expect(lines[1]).toContain("-20.0%");
    expect(lines[2]).toContain("90 trading days");
    expect(lines[2]).toContain("12 trading days below");
  });
  it("says so when the prices do not cover the fall", () => {
    expect(bookLines({ ...book, actual_fall: null, error: null })[0]).toContain("do not cover the whole fall");
  });
});

describe("wording rules", () => {
  it("never tells anyone what to do with money or promises anything", () => {
    for (const line of allBacktestLines()) {
      expect(line).not.toMatch(/\b(buy|sell|invest|should|guarantee|will fall|will rise)\b/i);
    }
  });
});
