import { describe, expect, it } from "vitest";
import { formatIndicatorChange, formatIndicatorValue, formatNok, formatPct100, formatPercent } from "./format";

describe("formatIndicatorValue", () => {
  it("shows rates with the precision the server sent", () => {
    expect(formatIndicatorValue({ value: "4.25", display_unit: "%" })).toBe("4.25%");
    expect(formatIndicatorValue({ value: "3.3", display_unit: "%" })).toBe("3.3%");
    expect(formatIndicatorValue({ value: "-0.50", display_unit: "%" })).toBe("-0.50%");
  });
  it("shows FX with four decimals and derived spreads in points", () => {
    expect(formatIndicatorValue({ value: "9.3466", display_unit: "NOK" })).toBe("9.3466");
    expect(formatIndicatorValue({ value: "0.95", display_unit: "pp" })).toBe("+0.95 pp");
    expect(formatIndicatorValue({ value: "-0.10", display_unit: "pp" })).toBe("-0.10 pp");
  });
  it("shows a dash when there is no value", () => {
    expect(formatIndicatorValue({ value: null, display_unit: "%" })).toBe("—");
  });
});

describe("formatIndicatorChange", () => {
  it("signs changes and names the unit", () => {
    expect(formatIndicatorChange("-0.25", "pp")).toBe("−0.25 pp");
    expect(formatIndicatorChange("6.53", "pct")).toBe("+6.53%");
    expect(formatIndicatorChange("0.00", "pp")).toBe("±0.00 pp");
    expect(formatIndicatorChange(null, "pp")).toBe("—");
  });
});

describe("existing formatters", () => {
  it("formats 0-100 and 0-1 percentages differently", () => {
    expect(formatPct100("12.34")).toBe("12.3%");
    expect(formatPercent("0.1234")).toBe("12.3%");
    expect(formatPct100(null)).toBe("—");
  });
  it("formats NOK amounts rounded, Norwegian grouping", () => {
    expect(formatNok("1234567.8").replace(/\s/g, " ")).toBe("1 234 568 kr");
  });
});
