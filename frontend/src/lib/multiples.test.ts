import { describe, expect, it } from "vitest";
import { latestSkipReason } from "./multiples";
import type { PeriodMultiples } from "./types";

const period = (name: string, skipped: Record<string, string>): PeriodMultiples => ({
  period: name,
  matched_price_observed_at: null,
  computed: {},
  skipped,
});

describe("latestSkipReason", () => {
  it("quotes the newest period, not the opening-balance year", () => {
    const series = [
      period("FY2019", { ev_to_ebitda: "missing: shares_outstanding (and no net income ÷ EPS to derive it)" }),
      period("FY2024", { ev_to_ebitda: "missing: ebitda" }),
      period("FY2025", { ev_to_ebitda: "missing: ebitda" }),
    ];
    expect(latestSkipReason(series, "ev_to_ebitda")).toBe("FY2025: missing: ebitda");
  });

  it("falls back to an older period when the newest has no reason for that metric", () => {
    const series = [period("FY2024", { price_to_sales: "missing: revenue" }), period("FY2025", {})];
    expect(latestSkipReason(series, "price_to_sales")).toBe("FY2024: missing: revenue");
  });

  it("is null when no period gives a reason", () => {
    expect(latestSkipReason([period("FY2025", {})], "price_to_book")).toBeNull();
    expect(latestSkipReason([], "price_to_book")).toBeNull();
  });
});
