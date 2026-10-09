import { describe, expect, it } from "vitest";
import { describeTower, knifeEdgeSummary, nearMargins } from "./fortress";
import type { GameMargin, GameTower } from "./types";

const margin = (over: Partial<GameMargin>): GameMargin => ({
  metric: "net_debt_to_ebitda", label: "Net debt / EBITDA", value: "2.4", boundary: "2.5",
  direction: "weaker", to_tier: "timber", distance: "0.1", near: true,
  text: "Net debt / EBITDA is 2.4x; timber begins above 2.5x (0.1x of room).", ...over,
});

const tower = (margins?: GameMargin[]): GameTower => ({
  holding_id: "h1", ticker: "TST", name: "Test", instrument_type: "stock", sector: null, structure: "keep",
  value_nok: null, weight_pct: null, size_class: "medium", moat: "wide", wall: "brick", wall_reason: "",
  wall_inputs: {}, wall_margins: margins, freshness: "fresh", analysis_age_days: 1, verdict_rating: null,
  land: "fog", land_reason: "", margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0,
  siege_exposure: "unsurveyed", siege_shock_pct: null, siege_method: null, shared_wall_with: [],
});

describe("knife-edge (A1)", () => {
  it("flags only near margins on the weaker side", () => {
    const t = tower([margin({}), margin({ direction: "stronger", near: false, to_tier: "granite" })]);
    expect(nearMargins(t)).toHaveLength(1);
    expect(knifeEdgeSummary(t)).toContain("timber begins above 2.5x");
  });

  it("says nothing for old frames without margins or when nothing is near", () => {
    expect(nearMargins(tower(undefined))).toEqual([]);
    expect(knifeEdgeSummary(tower([margin({ near: false })]))).toBeNull();
  });

  it("is named for screen readers, without advice wording", () => {
    const text = describeTower(tower([margin({})])).toLowerCase();
    expect(text).toContain("close to the line of a weaker wall");
    for (const w of ["buy", "sell", "should"]) expect(text).not.toContain(w);
  });
});
