import { describe, expect, it } from "vitest";
import { formatNok, formatPct100 } from "./format";
import { portfolioValueText, rankedCounts, totalReturnText } from "./headlines";

describe("headlines", () => {
  it("prints the portfolio value exactly as the Dashboard does", () => {
    expect(portfolioValueText({ total_value_nok: "1234567.89" })).toBe(formatNok("1234567.89"));
  });

  it("prints total return with two decimals, and a dash when unknown", () => {
    expect(totalReturnText({ total_return_pct: "12.3456" })).toBe(formatPct100("12.3456", 2));
    expect(totalReturnText({ total_return_pct: null })).toBe("—");
  });

  it("counts ranked and unranked rows of the board", () => {
    const rows = [{ zone: "below_bear" }, { zone: "unavailable" }, { zone: "above_bull" }, { zone: "unavailable" }, { zone: "base_to_bull" }];
    expect(rankedCounts({ rows } as never)).toEqual({ ranked: 3, unavailable: 2 });
    expect(rankedCounts(undefined)).toEqual({ ranked: 0, unavailable: 0 });
  });
});
