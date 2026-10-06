import { describe, expect, it } from "vitest";
import { shortReason } from "./unrankable";

describe("shortReason", () => {
  it("names the common causes in a word or two", () => {
    expect(shortReason("Cannot compute CAGR: latest period (FY2025) is not profitable").label).toBe("Loss-making");
    expect(shortReason("Cannot compute CAGR: only one profitable year on file (FY2025); a growth rate needs at least two").label).toBe("One profitable year");
    expect(shortReason("DCF unavailable: fewer than two periods with complete owner-earnings inputs (net_income)").label).toBe("Data missing");
    expect(shortReason("Price-to-book valuation unavailable: no financial history on file").label).toBe("No financial history");
    expect(shortReason("Cannot value on justified P/B: no ROE for any period").label).toBe("No ROE data");
  });
  it("marks a withheld, implausible DCF as an inputs check", () => {
    const r = shortReason("DCF base value of 149.03 is 3.7x the share price of 40.26 — far outside what a sound model gives, so it is withheld");
    expect(r).toEqual({ label: "Check inputs", kind: "model" });
  });
  it("does not guess when the text is unknown or missing", () => {
    expect(shortReason("something new").label).toBe("Not valued yet");
    expect(shortReason(null).label).toBe("Not valued yet");
  });
});
