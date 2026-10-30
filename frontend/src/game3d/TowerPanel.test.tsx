import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameState, GameTower } from "../lib/types";
import TowerPanel from "./TowerPanel";
import { towerFacts } from "./towerFacts";
import { stateToWorld } from "./stateToWorld";

function tower(o: Partial<GameTower>): GameTower {
  return {
    holding_id: "id", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: "10", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...o,
  };
}
const state = (towers: GameTower[], demo = false): GameState =>
  ({ mapping_version: "v1", as_of: null, demo, total_value_nok: "0", towers, notes: [], siege: null } as unknown as GameState);

const noop = () => {};

describe("TowerPanel (plain view of the 3D scene)", () => {
  it("says what each tower stands for, in the stored words", () => {
    const w = stateToWorld(state([tower({ name: "Rotty", wall: "rotted", moat: "none", thesis: "breached" })]));
    const html = renderToStaticMarkup(<TowerPanel world={w} loading={false} error={null} onRetry={noop} />);
    expect(html).toContain("Rotty");
    expect(html).toContain("Rotted walls");
    expect(html).toContain("No moat");
    expect(html).toContain("a tripwire has fired");
  });

  it("keeps unknown as 'not surveyed' in words too", () => {
    const w = stateToWorld(state([tower({ wall: "unsurveyed", moat: "unsurveyed", size_class: "unknown" })]));
    const facts = towerFacts(w.towers[0]);
    expect(facts).toContain("not surveyed");
    expect(facts).toContain("Size unknown");
  });

  it("labels sample data and never shows towers when loading failed", () => {
    const demo = renderToStaticMarkup(<TowerPanel world={stateToWorld(state([tower({})], true))} loading={false} error={null} onRetry={noop} />);
    expect(demo).toContain("Sample fortress");
    const failed = renderToStaticMarkup(<TowerPanel world={stateToWorld(null)} loading={false} error="Could not load the fortress." onRetry={noop} />);
    expect(failed).toContain("Try again");
    expect(failed).not.toContain("<li");
  });

  it("mentions holdings that do not fit on the pads", () => {
    const many = Array.from({ length: 10 }, (_, i) => tower({ holding_id: `h${i}`, name: `H${i}`, weight_pct: String(30 - i) }));
    const html = renderToStaticMarkup(<TowerPanel world={stateToWorld(state(many))} loading={false} error={null} onRetry={noop} />);
    expect(html).toContain("2 more than the courtyard has pads for");
    expect(html).toContain("(not on a pad)");
  });
});
