import { describe, expect, it } from "vitest";
import { describePriceAssumes } from "./priceAssumes";
import type { PriceAssumes } from "./types";

const read: PriceAssumes = {
  price_per_share: "40",
  shares_outstanding: "100000000",
  market_cap: "4000000000",
  discount_rate: "0.09",
  terminal_growth_rate: "0.025",
  required_owner_earnings: "253658536",
  required_per_share: "2.5365",
  latest_owner_earnings: "-30000000",
  latest_period: "FY2025",
};

describe("describePriceAssumes", () => {
  it("says what yearly owner earnings the price already counts on", () => {
    const text = describePriceAssumes(read, "NOK");
    expect(text.headline).toContain("NOK 40.00");
    expect(text.headline).toContain("NOK 253.7m");
    expect(text.headline).toContain("2.5%");
    expect(text.headline).toContain("9.0%");
  });

  it("puts the company's own latest owner earnings beside it", () => {
    const text = describePriceAssumes(read, "NOK");
    expect(text.comparison).toContain("FY2025");
    expect(text.comparison).toContain("-30.0m");
  });

  it("leaves the comparison out when the latest figure is not known", () => {
    expect(describePriceAssumes({ ...read, latest_owner_earnings: null }, "NOK").comparison).toBeNull();
    expect(describePriceAssumes({ ...read, latest_owner_earnings: undefined }, "NOK").comparison).toBeNull();
  });

  it("always says it is not a valuation", () => {
    expect(describePriceAssumes(read, null).caveat).toMatch(/not a valuation/);
  });
});
