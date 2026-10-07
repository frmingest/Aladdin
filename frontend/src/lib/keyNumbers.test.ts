import { describe, expect, it } from "vitest";
import { buildKeyNumbers } from "./keyNumbers";
import type { HoldingValuation } from "./types";

const base = (over: Partial<HoldingValuation>): HoldingValuation =>
  ({
    holding_id: "h",
    ticker: "T",
    valuation_currency: "NOK",
    as_of: null,
    base_growth_rate: null,
    discount_rate: null,
    risk_free_rate_pct: null,
    beta: null,
    equity_risk_premium: null,
    current_price_per_share: "100",
    dcf: null,
    reverse_dcf_implied_growth: null,
    multiples: [],
    assumptions_version: "v3",
    unavailable_reasons: [],
    ...over,
  }) as HoldingValuation;

const dcf = (mos: string | null) => ({
  discount_rate: "0.09",
  terminal_growth_rate: "0.025",
  scenarios: [
    { label: "bear", growth_rate: "0.01", intrinsic_value_per_share: "80", margin_of_safety: "-0.25" },
    { label: "base", growth_rate: "0.03", intrinsic_value_per_share: "150", margin_of_safety: mos },
    { label: "bull", growth_rate: "0.05", intrinsic_value_per_share: "200", margin_of_safety: "0.5" },
  ],
});

describe("buildKeyNumbers", () => {
  it("shows price, base value and margin from the stored base scenario", () => {
    const k = buildKeyNumbers(base({ valuation_status: "ok", dcf: dcf("0.3333") }));
    expect(k.tiles.map((t) => t.id)).toEqual(["price", "base", "margin"]);
    expect(k.tiles[1].value).toBe("NOK 150.00");
    expect(k.tiles[2].value).toBe("33.3%");
    expect(k.tiles[2].tone).toBe("good");
    expect(k.note).toBeNull();
  });

  it("marks a negative margin as bad and a missing one as unknown, never as zero", () => {
    expect(buildKeyNumbers(base({ dcf: dcf("-0.2") })).tiles[2].tone).toBe("bad");
    const unknown = buildKeyNumbers(base({ dcf: dcf(null) })).tiles[2];
    expect(unknown.tone).toBe("unknown");
    expect(unknown.value).toBe("—");
  });

  it("says withheld, not a number, when the value was judged implausible", () => {
    const k = buildKeyNumbers(base({ valuation_status: "implausible", dcf: dcf("0.9") }));
    expect(k.tiles[1].value).toBe("Withheld");
    expect(k.tiles[2].value).toBe("—");
  });

  it("shows only the price and one note when there is no estimate", () => {
    const k = buildKeyNumbers(base({ valuation_status: "unavailable", dcf: null }));
    expect(k.tiles).toHaveLength(1);
    expect(k.note).toMatch(/No value estimate/);
  });

  it("reads a bank's price-to-book base and a fund's look-through base", () => {
    const bank = buildKeyNumbers(
      base({
        financials: {
          cost_of_equity: "0.09", growth_rate: "0.02", book_value_per_share: "90", roe_periods_used: 3, roe_was_capped: false,
          scenarios: [{ label: "base", roe: "0.1", justified_price_to_book: "1.2", value_per_share: "108", margin_of_safety: "0.07" }],
        },
      }),
    );
    expect(bank.tiles[1].value).toBe("NOK 108.00");
    const fund = buildKeyNumbers(
      base({
        fund_look_through: {
          scenarios: [{ label: "base", growth_rate: "0.02", fair_pe: "16", value_per_unit: "55", margin_of_safety: "-0.1" }],
          fund_earnings_yield: "0.05", fund_pe: "20", coverage_pct: "90", constituents_used: 30, constituents_total: 34,
          cost_of_equity: "0.08", terminal_growth_rate: "0.02", oldest_observation: null, notes: [], method_note: "",
        },
      }),
    );
    expect(fund.tiles[1].value).toBe("NOK 55.00");
    expect(fund.tiles[2].tone).toBe("bad");
  });

  it("says the price is not fetched instead of showing a blank", () => {
    expect(buildKeyNumbers(base({ current_price_per_share: null })).tiles[0].value).toBe("Not fetched");
  });
});
