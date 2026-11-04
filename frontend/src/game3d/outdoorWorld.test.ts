import { describe, expect, it } from "vitest";
import type { GameState, GameTower } from "../lib/types";
import { stateToWorld } from "./stateToWorld";
import { WALL_RADIUS } from "./layout";
import { ENTER_REACH, enterableOf, nearestTower, outdoorExit } from "./towerDoor";
import { returnSpot } from "./areas";
import { centreChoice } from "./landCentre";
import { slotOf } from "./OutdoorHoldings";

function tower(o: Partial<GameTower> = {}): GameTower {
  return {
    holding_id: "id", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
    value_nok: "1000", weight_pct: "10", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
    wall_inputs: {}, freshness: "fresh", analysis_age_days: 10, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed", siege_shock_pct: null,
    siege_method: null, shared_wall_with: [], ...o,
  } as GameTower;
}

const state = (towers: GameTower[]): GameState =>
  ({ mapping_version: "v1", as_of: "2026-11-04T06:00:00Z", demo: false, towers } as unknown as GameState);

const SECTORS = ["Energy", "Materials", "Industrials", "Financials", "Consumer Staples", "Health Care", "Information Technology", "Utilities"];
const eight = (o: (i: number) => Partial<GameTower> = () => ({})) =>
  SECTORS.map((sector, i) => tower({ holding_id: `h${i}`, name: `H${i}`, sector, weight_pct: String(30 - i), ...o(i) }));

describe("holdings on the meadow (S31 PR 3)", () => {
  it("stands every holding outside the wall, each on its own plot", () => {
    const w = stateToWorld(state(eight()));
    expect(w.towers).toHaveLength(8);
    const keys = new Set(w.towers.map((t) => `${t.spot.x},${t.spot.z}`));
    expect(keys.size).toBe(8);
    for (const t of w.towers) {
      expect(t.plot).toBeDefined();
      expect(Math.hypot(t.spot.x, t.spot.z)).toBeGreaterThan(WALL_RADIUS + 3);
    }
  });

  it("decides the spot by theme and weight order only: wall, moat, thesis and size change nothing", () => {
    const a = stateToWorld(state(eight()));
    const b = stateToWorld(
      state(eight((i) => ({ wall: i % 2 ? "rotted" : "basalt", moat: i % 2 ? "none" : "wide", thesis: i % 2 ? "breached" : "intact", size_class: i % 2 ? "tiny" : "great" }))),
    );
    expect(b.towers.map((t) => t.spot)).toEqual(a.towers.map((t) => t.spot));
  });

  it("keeps the rest in the plain list, not on the meadow", () => {
    const many = Array.from({ length: 11 }, (_, i) => tower({ holding_id: `m${i}`, name: `M${i}`, weight_pct: String(20 - i) }));
    const w = stateToWorld(state(many));
    expect(w.towers).toHaveLength(8);
    expect(w.hiddenCount).toBe(3);
    expect(w.plain.slice(8).every((t) => t.plot === undefined)).toBe(true);
  });

  it("faces every door along its lane, and the door post stands at the footprint", () => {
    for (const t of stateToWorld(state(eight())).towers) {
      const p = t.plot!;
      const toDoor = Math.atan2(p.door.x - t.spot.x, p.door.z - t.spot.z);
      expect(p.doorYaw).toBeCloseTo(toDoor, 9);
      expect(Math.hypot(p.door.x - t.spot.x, p.door.z - t.spot.z)).toBeGreaterThan(p.footprint);
    }
  });

  it("counts the reach from the footprint: fat and thin holdings are equally easy to enter", () => {
    const towers = stateToWorld(state(eight((i) => ({ size_class: i % 2 ? "tiny" : "great" })))).towers.map(enterableOf);
    for (const e of towers) {
      expect(e.radius).toBeGreaterThan(3.9);
      const at = { x: e.spot.x + Math.sin(e.outdoorDoorYaw!) * (e.radius + ENTER_REACH - 0.1), z: e.spot.z + Math.cos(e.outdoorDoorYaw!) * (e.radius + ENTER_REACH - 0.1) };
      expect(nearestTower(at, towers)?.holdingId).toBe(e.holdingId);
    }
  });

  it("puts you in front of the door on the way out, never on the building, and looking at it", () => {
    const w = stateToWorld(state(eight()));
    const enter = w.towers.map(enterableOf);
    for (const t of w.towers) {
      const out = outdoorExit(t.spot, t.plot!.doorYaw, t.plot!.footprint);
      expect(Math.hypot(out.x - t.spot.x, out.z - t.spot.z)).toBeGreaterThan(t.plot!.footprint);
      const back = returnSpot({ id: "holding", holdingId: t.holdingId } as never, { id: "courtyard" }, enter);
      expect(back?.x).toBeCloseTo(out.x, 9);
      expect(back?.z).toBeCloseTo(out.z, 9);
    }
  });

  it("falls back to the plain tower for a sector with no building yet, and dresses the rest", () => {
    const w = stateToWorld(state(eight()));
    const choices = w.towers.map((t) => centreChoice(slotOf(t)!));
    expect(choices).toContain("dressing");
    expect(choices).toContain("tower");
  });

  it("builds the building's wear and stream from the wall and moat tier only", () => {
    const t = stateToWorld(state([tower({ sector: "Energy", wall: "rotted", moat: "none" })])).towers[0];
    const s = slotOf(t)!;
    expect(s.theme).toBe(t.plot!.theme);
    expect(s.tower).toBe(t);
  });
});
