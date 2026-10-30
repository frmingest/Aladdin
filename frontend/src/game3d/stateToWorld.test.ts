import { describe, expect, it } from "vitest";
import type { GameState, GameTower } from "../lib/types";
import { MOAT_WIDTH, SIZE_HEIGHT, WALL_LOOK, stateToWorld, strengthOf } from "./stateToWorld";
import { towerSpots } from "./layout";

function tower(o: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: o.holding_id ?? "id",
    ticker: "AAA",
    name: "Alpha",
    instrument_type: "stock",
    sector: null,
    structure: "keep",
    value_nok: "1000",
    weight_pct: "10",
    size_class: "medium",
    moat: "wide",
    wall: "granite",
    wall_reason: "net debt / EBITDA 0.8x",
    wall_inputs: {},
    freshness: "fresh",
    analysis_age_days: 10,
    verdict_rating: null,
    land: "fog",
    land_reason: "",
    margin_of_safety_pct: null,
    thesis: "intact",
    tripwires_fired: 0,
    siege_exposure: "unsurveyed",
    siege_shock_pct: null,
    siege_method: null,
    shared_wall_with: [],
    ...o,
  };
}

function state(towers: GameTower[], demo = false): GameState {
  return {
    mapping_version: "v1",
    as_of: "2026-10-30T06:00:00Z",
    demo,
    total_value_nok: "10000",
    towers,
    diworsification: {} as GameState["diworsification"],
    vault: {} as GameState["vault"],
    siege: null,
    notes: [],
  };
}

describe("stateToWorld", () => {
  it("gives an empty courtyard when there is no state", () => {
    const w = stateToWorld(null);
    expect(w.towers).toEqual([]);
    expect(w.hiddenCount).toBe(0);
  });

  it("puts the biggest holdings on the pads, first pad first", () => {
    const w = stateToWorld(
      state([
        tower({ holding_id: "small", name: "Small", weight_pct: "2" }),
        tower({ holding_id: "big", name: "Big", weight_pct: "40" }),
      ]),
    );
    expect(w.towers.map((t) => t.holdingId)).toEqual(["big", "small"]);
    expect(w.towers[0].spot).toEqual(towerSpots()[0]);
  });

  it("counts holdings that do not fit on the pads and keeps them in the plain list", () => {
    const many = Array.from({ length: 11 }, (_, i) => tower({ holding_id: `h${i}`, name: `H${i}`, weight_pct: String(20 - i) }));
    const w = stateToWorld(state(many));
    expect(w.towers).toHaveLength(8);
    expect(w.hiddenCount).toBe(3);
    expect(w.plain).toHaveLength(11);
  });

  it("makes a weaker wall always look weaker: integrity, crown and cracks all agree", () => {
    const order = ["basalt", "granite", "brick", "timber", "rotted"] as const;
    for (let i = 1; i < order.length; i++) {
      const strong = WALL_LOOK[order[i - 1]];
      const weak = WALL_LOOK[order[i]];
      expect(weak.integrity!).toBeLessThan(strong.integrity!);
      expect(weak.crenels).toBeLessThanOrEqual(strong.crenels);
      expect(weak.cracks).toBeGreaterThanOrEqual(strong.cracks);
    }
    expect(strengthOf("basalt")).toBe("strong");
    expect(strengthOf("brick")).toBe("fair");
    expect(strengthOf("rotted")).toBe("weak");
  });

  it("does not let a big, heavy holding with rotted walls look strong", () => {
    const w = stateToWorld(state([tower({ size_class: "great", weight_pct: "45", wall: "rotted", moat: "none" })]));
    const t = w.towers[0];
    expect(t.height).toBe(SIZE_HEIGHT.great);
    expect(t.strength).toBe("weak");
    expect(t.cracks).toBeGreaterThan(0);
    expect(t.moatWidth).toBe(0);
  });

  it("keeps unknown as fog, never a middle grade", () => {
    const w = stateToWorld(state([tower({ wall: "unsurveyed", moat: "unsurveyed", size_class: "unknown" })]));
    const t = w.towers[0];
    expect(t.fog).toBe(true);
    expect(t.strength).toBe("unknown");
    expect(t.moatFog).toBe(true);
    expect(t.moatWidth).toBe(MOAT_WIDTH.unsurveyed);
    expect(t.crenels).toBe(0);
  });

  it("carries the stored thesis and freshness through unchanged", () => {
    const w = stateToWorld(state([tower({ thesis: "breached", freshness: "overgrown" })]));
    expect(w.towers[0].flag).toBe("breached");
    expect(w.towers[0].freshness).toBe("overgrown");
    expect(stateToWorld(state([tower({ thesis: "not_analyzed" })])).towers[0].flag).toBe("none");
  });

  it("passes demo mode through so the page can say it is sample data", () => {
    expect(stateToWorld(state([tower()], true)).demo).toBe(true);
  });

  it("plain facts match the 3D state for every tower", () => {
    const w = stateToWorld(state([tower({ wall: "timber", moat: "narrow", size_class: "small", weight_pct: "7" })]));
    const t = w.towers[0];
    expect(t.facts).toMatchObject({ wall: "timber", moat: "narrow", size: "small", weightPct: "7" });
    expect(t.moatWidth).toBe(MOAT_WIDTH.narrow);
    expect(t.height).toBe(SIZE_HEIGHT.small);
  });
});
