import { describe, expect, it } from "vitest";
import { formatNok, formatPct100 } from "./format";
import {
  MACRO_HEADLINE_KEYS,
  macroHeadlineIndicators,
  metalsValueText,
  policyRateText,
  portfolioValueText,
  rankedCounts,
  thesisStatusCounts,
  thesisSummaryText,
  totalReturnText,
} from "./headlines";

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

  const ind = (key: string, value: string | null, extra: object = {}) =>
    ({ key, value, display_unit: "%", stale: false, ...extra }) as never;

  it("prints Norway's policy rate as the Macro page does, marks it stale, and says nothing without a value", () => {
    expect(policyRateText({ indicators: [ind("no_policy_rate", "4.25")] })).toBe("4.25%");
    expect(policyRateText({ indicators: [ind("no_policy_rate", "4.25", { stale: true })] })).toBe("4.25% (stale)");
    expect(policyRateText({ indicators: [ind("no_policy_rate", null)] })).toBeNull();
    expect(policyRateText({ indicators: [ind("no_cpi_yoy", "3.1")] })).toBeNull();
  });

  it("keeps the Dashboard strip's list and order, dropping indicators with no value", () => {
    const all = MACRO_HEADLINE_KEYS.map((k) => ind(k, "1"));
    expect(macroHeadlineIndicators({ indicators: all }).map((i) => i.key)).toEqual(MACRO_HEADLINE_KEYS);
    const some = [ind("us_10y", "4"), ind("no_policy_rate", "4.25"), ind("usd_nok", null), ind("other", "9")];
    expect(macroHeadlineIndicators({ indicators: some }).map((i) => i.key)).toEqual(["no_policy_rate", "us_10y"]);
  });

  const row = (status: string, status_label: string) => ({ status, status_label }) as never;
  const DOT = "\u{1F534}";

  it("counts thesis statuses most urgent first and leaves empty ones out", () => {
    const rows = [row("intact", "Intact"), row("tripwire_fired", `${DOT} Tripwire fired`), row("intact", "Intact"), row("review", "Needs review")];
    expect(thesisStatusCounts(rows).map((p) => [p.status, p.count])).toEqual([
      ["tripwire_fired", 1],
      ["review", 1],
      ["intact", 2],
    ]);
    expect(thesisSummaryText(rows)).toBe("1 tripwire fired, 1 to review, 2 intact");
    expect(thesisSummaryText(rows)).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(thesisSummaryText([])).toBe("Nothing watched yet");
  });

  it("prints the precious-metals total as the Precious metals page does", () => {
    expect(metalsValueText({ total_value_nok: "98765.4" })).toBe(formatNok("98765.4"));
  });
});
