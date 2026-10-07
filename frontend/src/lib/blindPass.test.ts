import { describe, expect, it } from "vitest";
import {
  ANALYZABLE_TYPES,
  EQUITY_ANALYZABLE_TYPES,
  WRAPPER_TYPES,
  blindPassNotes,
  isCommodityBlindPass,
  isFundBlindPass,
  isIncomeBlindPass,
  type AnyBlindPass,
} from "./types";

const section = { summary: "s", evidence_ids: ["EV-001"] };
const verdict = {
  rating: "Hold" as const,
  thesis_bullets: [],
  top_risks: [],
  metrics_to_monitor: [],
  invalidation_triggers: [],
  evidence_ids: [],
};

const income: AnyBlindPass = {
  yield_and_alternatives: section,
  credit_and_rate_risk: section,
  steward_and_costs: section,
  portfolio_construction: section,
  macro_stress_test: section,
  role_in_portfolio: section,
  verdict,
};
const commodity: AnyBlindPass = {
  what_you_own: section,
  cost_and_carry: section,
  macro_stress_test: section,
  role_in_portfolio: section,
  verdict,
};
const fund: AnyBlindPass = {
  moat: { circle_of_competence_summary: "c", overall_rating: "None", coverage_caveat: "x", evidence_ids: [] },
  steward_and_costs: section,
  portfolio_construction: section,
  macro_stress_test: section,
  valuation_synthesis: section,
  role_in_portfolio: section,
  verdict,
};
const company: AnyBlindPass = {
  moat: { circle_of_competence_summary: "c", overall_rating: "Wide", sources: [], evidence_ids: [] },
  capital_efficiency: section,
  financial_fortress: section,
  macro_stress_test: section,
  valuation_synthesis: section,
  verdict,
};

describe("blind pass guards", () => {
  it("tell the four schemas apart even though three share role_in_portfolio", () => {
    expect([isFundBlindPass(fund), isIncomeBlindPass(fund), isCommodityBlindPass(fund)]).toEqual([true, false, false]);
    expect([isFundBlindPass(income), isIncomeBlindPass(income), isCommodityBlindPass(income)]).toEqual([
      false,
      true,
      false,
    ]);
    expect([isFundBlindPass(commodity), isIncomeBlindPass(commodity), isCommodityBlindPass(commodity)]).toEqual([
      false,
      false,
      true,
    ]);
    expect([isFundBlindPass(company), isIncomeBlindPass(company), isCommodityBlindPass(company)]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("list the right sections for each schema", () => {
    expect(blindPassNotes(income).map((n) => n.title)).toContain("Credit and rate risk");
    expect(blindPassNotes(commodity).map((n) => n.title)).toContain("Cost and carry");
    expect(blindPassNotes(fund).map((n) => n.title)).toContain("Valuation notes");
    expect(blindPassNotes(company).map((n) => n.title)).toContain("Financial fortress");
  });
});

describe("instrument type sets", () => {
  it("keep equity roll-ups equity-only while every type is analyzable", () => {
    expect(EQUITY_ANALYZABLE_TYPES.has("bond_fund")).toBe(false);
    for (const t of ["stock", "equity_etf", "equity_fund", "bond_fund", "money_market_fund", "commodity_etc"]) {
      expect(ANALYZABLE_TYPES.has(t)).toBe(true);
    }
    expect(WRAPPER_TYPES.has("stock")).toBe(false);
    expect(WRAPPER_TYPES.has("commodity_etc")).toBe(true);
  });
});
