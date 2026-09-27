import { describe, expect, it } from "vitest";
import { MODE_OPTIONS, ROLE_LABELS } from "./analystTypes";
import { isDalioBlindPass, isFundBlindPass, verdictRole } from "./types";
import type { DalioBlindPassOutput } from "./types";

const section = { summary: "s", evidence_ids: [] };
const dalio: DalioBlindPassOutput = {
  debt_cycle: { short_term_phase: "tightening", long_term_phase: "late_leveraging", summary: "s", evidence_ids: [] },
  quadrant_fit: { favoured_environments: ["rising_inflation"], summary: "s", evidence_ids: [] },
  currency_risk: section,
  country_risk: section,
  internal_external_order: section,
  portfolio_role_and_diversification: section,
  verdict: {
    rating: "Buy",
    portfolio_role: "inflation_hedge",
    thesis_bullets: [],
    top_risks: [],
    metrics_to_monitor: [],
    invalidation_triggers: [],
    evidence_ids: [],
  },
};

describe("F22 analyst types", () => {
  it("tells a Dalio blind pass apart from the fund one", () => {
    expect(isDalioBlindPass(dalio)).toBe(true);
    expect(isFundBlindPass(dalio)).toBe(false);
  });

  it("reads the portfolio role only off a Dalio verdict", () => {
    expect(verdictRole(dalio.verdict)).toBe("inflation_hedge");
    const buffett = {
      rating: "Buy" as const,
      thesis_bullets: [],
      top_risks: [],
      metrics_to_monitor: [],
      invalidation_triggers: [],
      evidence_ids: [],
    };
    expect(verdictRole(buffett)).toBeNull();
    expect(verdictRole(null)).toBeNull();
  });

  it("offers exactly the three whole-app modes, Buffett/Munger first", () => {
    expect(MODE_OPTIONS.map((o) => o.value)).toEqual(["buffett_munger", "dalio", "side_by_side"]);
    expect(Object.keys(ROLE_LABELS)).toHaveLength(6);
  });
});
