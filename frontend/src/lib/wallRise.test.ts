import { describe, expect, it } from "vitest";
import { describeRise, riseRows, wallRise } from "./wallRise";
import type { GameMargin, GameTower } from "./types";

const m = (over: Partial<GameMargin>): GameMargin => ({
  metric: "net_debt_to_ebitda", label: "Net debt / EBITDA", value: "2.0", boundary: "1.5",
  direction: "stronger", to_tier: "granite", distance: "0.5", near: false,
  text: "Net debt / EBITDA is 2.0x; granite needs 1.5x or less (0.5x away).", ...over,
});

const tower = (wall: GameTower["wall"], margins?: GameMargin[], over: Partial<GameTower> = {}): GameTower => ({
  holding_id: `h-${wall}`, ticker: "TST", name: `Test ${wall}`, instrument_type: "stock", sector: null, structure: "keep",
  value_nok: null, weight_pct: null, size_class: "medium", moat: "wide", wall, wall_reason: "",
  wall_inputs: {}, wall_margins: margins, freshness: "fresh", analysis_age_days: 1, verdict_rating: null,
  land: "fog", land_reason: "", margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0,
  siege_exposure: "unsurveyed", siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...over,
});

// Brick band is 1.5x (granite line) to 2.5x (timber line); 2.0x is exactly halfway up.
const brickHalf = [m({}), m({ direction: "weaker", boundary: "2.5", to_tier: "timber", distance: "0.5" })];

describe("wallRise", () => {
  it("reads how far across the band a wall has come", () => {
    const r = wallRise(tower("brick", brickHalf));
    expect(r?.kind).toBe("climbing");
    expect(r?.next).toBe("granite");
    expect(r?.progress).toBeCloseTo(0.5);
    expect(r?.gapText).toContain("granite needs 1.5x");
  });

  it("is fog, not zero, when the band has no lower edge or nothing is stored", () => {
    const rotted = wallRise(tower("rotted", [m({ value: "6", boundary: "4", to_tier: "timber" })]));
    expect(rotted?.kind).toBe("climbing");
    expect(rotted?.progress).toBeNull();
    const none = wallRise(tower("brick", []));
    expect(none?.kind).toBe("unmeasured");
    expect(none?.progress).toBeNull();
  });

  it("marks the top rung and a financial wall with nothing stronger", () => {
    expect(wallRise(tower("basalt"))?.kind).toBe("top");
    const bank = wallRise(tower("granite", [m({ metric: "equity_to_assets", direction: "weaker", to_tier: "brick" })]));
    expect(bank?.kind).toBe("top");
    expect(bank?.next).toBeNull();
  });

  it("gives no rise for towers that are not keeps or were never surveyed", () => {
    expect(wallRise(tower("unsurveyed"))).toBeNull();
    expect(wallRise(tower("not_applicable"))).toBeNull();
    expect(wallRise(tower("granite", [], { structure: "outpost" }))).toBeNull();
  });

  it("keeps the weaker side and the cover penalty visible", () => {
    const r = wallRise(
      tower("brick", [
        ...brickHalf.slice(0, 1),
        m({ direction: "weaker", boundary: "2.5", to_tier: "timber", distance: "0.1", near: true }),
        m({ metric: "interest_coverage", direction: "stronger", text: "Interest cover is 2.0x; at 3.0x or more the wall is no longer pulled down (1.0x away)." }),
      ]),
    );
    expect(r?.slipping).toBe(true);
    expect(r?.heldBack).toContain("no longer pulled down");
    expect(describeRise(r!)).toContain("weaker rung");
  });

  it("orders nearest first, then unreadable bands, then unmeasured, then the top", () => {
    const far = tower("brick", [m({ value: "2.4" }), m({ direction: "weaker", boundary: "2.5", to_tier: "timber" })], { holding_id: "far" });
    const near = tower("brick", [m({ value: "1.6" }), m({ direction: "weaker", boundary: "2.5", to_tier: "timber" })], { holding_id: "near" });
    const fog = tower("rotted", [m({ value: "6", boundary: "4", to_tier: "timber" })], { holding_id: "fog" });
    const unmeasured = tower("timber", [], { holding_id: "unmeasured" });
    const top = tower("basalt", undefined, { holding_id: "top" });
    expect(riseRows([top, unmeasured, fog, far, near]).map((r) => r.tower.holding_id)).toEqual(["near", "far", "fog", "unmeasured", "top"]);
  });

  it("uses no advice wording", () => {
    const text = describeRise(wallRise(tower("brick", brickHalf))!).toLowerCase();
    for (const w of ["buy", "sell", "should"]) expect(text).not.toContain(w);
  });
});
