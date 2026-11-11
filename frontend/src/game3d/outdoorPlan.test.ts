import { describe, expect, it } from "vitest";
import type { Theme3dId } from "../lib/sectors";
import { COBBLE_RADIUS, KEEP, SPAWN, TOWER_SPOT_COUNT, WALL_RADIUS, WALL_THICKNESS, cornerTowers } from "./layout";
import { cornerTowerFootprint, keepModelFootprint } from "./keepModels";
import { LAND_TOWER_REACH } from "./holdingLand";
import { FENCE_RADIUS } from "./farmDressing";
import { MARKET_CENTER, MARKET_REACH } from "./marketPieces";
import { CAMP_CENTER, CAMP_REACH } from "./campPieces";
import { PERCH } from "./watchPlan";
import { QUARTER_GATE } from "./quarterPlan";
import { SIEGE_GATE } from "./siegeField";
import { DRILL_POST } from "./stormDrill";
import { DESK, SHELF } from "./desk";
import { VAULT } from "./vaultPlan";
import { REALM_POST } from "./realmPlan";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { MARKET } from "./marketPieces";
import { CAMP } from "./campPieces";
import { BOOTHS } from "./boothPlan";
import { STANDING_TORCHES } from "./standingTorches";
import {
  DOOR_REACH,
  FOOTPRINT,
  HOLDING_RING_FROM,
  HOLDING_RING_RADIUS,
  HOLDING_RING_STEP,
  HOLDING_RING_TO,
  HOLDING_SPOTS,
  PLOT_FOOTPRINT_MAX,
  PLOT_GAP,
  SPOTS_PER_SIDE,
  WALL_GAP,
  assignPlots,
  doorPointOf,
  footprintOf,
  plotsTable,
  type PlotInput,
} from "./outdoorPlan";

const THEMES = Object.keys(FOOTPRINT) as Theme3dId[];
const input = (theme: Theme3dId, i: number, fish = false): PlotInput => ({ holdingId: `h${i}`, theme, fish });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const bearing = (s: { x: number; z: number }) => Math.atan2(s.x, s.z);

describe("holding spots: inside the wall, evenly round it", () => {
  it("has exactly the eight spots the fortress shows, four on each side", () => {
    expect(HOLDING_SPOTS).toHaveLength(TOWER_SPOT_COUNT);
    expect(HOLDING_SPOTS.filter((s) => s.x > 0)).toHaveLength(SPOTS_PER_SIDE);
    expect(HOLDING_SPOTS.filter((s) => s.x < 0)).toHaveLength(SPOTS_PER_SIDE);
  });

  it("stands every spot inside the wall, with its whole footprint on the cobbles and clear of the wall", () => {
    for (const s of HOLDING_SPOTS) {
      const r = Math.hypot(s.x, s.z);
      expect(r + PLOT_FOOTPRINT_MAX, "inside the cobbles").toBeLessThanOrEqual(COBBLE_RADIUS + 0.5);
      expect(WALL_RADIUS - WALL_THICKNESS / 2 - (r + PLOT_FOOTPRINT_MAX), "wall room").toBeGreaterThanOrEqual(WALL_GAP);
    }
  });

  it("puts every spot on one ring round the middle", () => {
    for (const s of HOLDING_SPOTS) expect(Math.hypot(s.x, s.z)).toBeCloseTo(HOLDING_RING_RADIUS, 9);
  });

  it("spaces neighbours on a side by the same angle, and mirrors the east side in the west", () => {
    for (const side of [1, -1]) {
      const angles = HOLDING_SPOTS.filter((s) => Math.sign(s.x) === side)
        .map((s) => Math.abs(bearing(s)))
        .sort((a, b) => a - b);
      expect(angles[0]).toBeCloseTo(HOLDING_RING_FROM, 9);
      expect(angles[angles.length - 1]).toBeCloseTo(HOLDING_RING_TO, 9);
      for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(HOLDING_RING_STEP, 9);
    }
    for (const s of HOLDING_SPOTS) {
      const twin = HOLDING_SPOTS.find((o) => Math.abs(o.x + s.x) < 1e-9 && Math.abs(o.z - s.z) < 1e-9);
      expect(twin, `${s.x}, ${s.z}`).toBeDefined();
    }
  });

  it("keeps two buildings of the widest footprint apart, edge to edge", () => {
    for (let i = 0; i < HOLDING_SPOTS.length; i++)
      for (let j = i + 1; j < HOLDING_SPOTS.length; j++)
        expect(dist(HOLDING_SPOTS[i], HOLDING_SPOTS[j]) - 2 * PLOT_FOOTPRINT_MAX, `${i}/${j}`).toBeGreaterThanOrEqual(PLOT_GAP);
  });

  it("leaves the gate road, the middle walk to the keep, the spawn and the keep door clear", () => {
    for (const s of HOLDING_SPOTS) {
      expect(Math.abs(s.x) - PLOT_FOOTPRINT_MAX, "middle walk").toBeGreaterThan(8);
      expect(dist(s, SPAWN) - PLOT_FOOTPRINT_MAX, "spawn").toBeGreaterThan(15);
    }
  });

  it("keeps off the keep (and its wider plain-shape fallback), the corner towers and the keep's own props", () => {
    const keep = keepModelFootprint();
    for (const s of HOLDING_SPOTS) {
      const nearKeep = Math.abs(s.x - KEEP.x) < KEEP.width / 2 + PLOT_FOOTPRINT_MAX && Math.abs(s.z - KEEP.z) < KEEP.depth / 2 + PLOT_FOOTPRINT_MAX;
      expect(nearKeep, "plain keep").toBe(false);
      const nearModel = Math.abs(s.x) < keep.width / 2 + PLOT_FOOTPRINT_MAX && Math.abs(s.z - keep.centerZ) < keep.depth / 2 + PLOT_FOOTPRINT_MAX;
      expect(nearModel, "keep model").toBe(false);
      for (const c of cornerTowers()) expect(dist(s, c) - PLOT_FOOTPRINT_MAX - cornerTowerFootprint().radius, "corner tower").toBeGreaterThan(PLOT_GAP);
    }
  });

  it("keeps off the market corner, the quarter gate, the drill camp and the siege gate", () => {
    for (const s of HOLDING_SPOTS) {
      expect(dist(s, MARKET_CENTER) - MARKET_REACH - PLOT_FOOTPRINT_MAX, "market").toBeGreaterThan(0);
      expect(dist(s, CAMP_CENTER) - CAMP_REACH - PLOT_FOOTPRINT_MAX, "camp").toBeGreaterThan(0);
      expect(dist(s, QUARTER_GATE) - PLOT_FOOTPRINT_MAX, "quarter gate").toBeGreaterThan(8);
      expect(dist(s, SIEGE_GATE) - PLOT_FOOTPRINT_MAX, "siege gate").toBeGreaterThan(8);
      expect(dist(s, DRILL_POST) - PLOT_FOOTPRINT_MAX, "drill post").toBeGreaterThan(8);
      expect(dist(s, PERCH) - PLOT_FOOTPRINT_MAX, "perch").toBeGreaterThan(4);
    }
  });

  it("keeps off the desk, the vault, the realm post, the people and every prop, piece of scenery and booth in the yard", () => {
    const fixed = [DESK, SHELF, VAULT, REALM_POST, ...NPCS, ...PROPS, ...SCENERY.filter((p) => p.y === 0), ...MARKET, ...CAMP, ...BOOTHS, ...STANDING_TORCHES];
    for (const s of HOLDING_SPOTS)
      for (const p of fixed) expect(dist(s, p) - PLOT_FOOTPRINT_MAX, `${(p as { id?: string }).id ?? "fixed"} at ${p.x}, ${p.z}`).toBeGreaterThan(1);
  });
});

describe("footprints", () => {
  it("never exceeds the widest, and the widest is what the spacing was made for", () => {
    for (const t of THEMES) expect(footprintOf(t)).toBeLessThanOrEqual(PLOT_FOOTPRINT_MAX);
    expect(PLOT_FOOTPRINT_MAX).toBe(Math.max(LAND_TOWER_REACH, FENCE_RADIUS + 0.5, ...Object.values(FOOTPRINT)));
  });
});

describe("doors face the middle of the yard", () => {
  it("stands the door post one door-reach from the building, on the line to the middle", () => {
    for (const s of HOLDING_SPOTS) {
      const d = doorPointOf(s);
      expect(dist(d, s)).toBeCloseTo(DOOR_REACH, 9);
      expect(Math.hypot(d.x, d.z)).toBeLessThan(Math.hypot(s.x, s.z));
      expect(Math.atan2(d.x, d.z)).toBeCloseTo(bearing(s), 9);
    }
  });

  it("keeps every door post inside the wall and clear of the next building", () => {
    for (const s of HOLDING_SPOTS) {
      const d = doorPointOf(s);
      expect(Math.hypot(d.x, d.z)).toBeLessThan(WALL_RADIUS - WALL_THICKNESS / 2);
      for (const o of HOLDING_SPOTS) if (o !== s) expect(dist(d, o), "door vs neighbour").toBeGreaterThan(PLOT_FOOTPRINT_MAX);
    }
  });
});

describe("assignPlots", () => {
  it("gives the n-th holding the n-th spot, whatever its theme", () => {
    const plots = assignPlots(THEMES.slice(0, 8).map((t, i) => input(t, i)));
    expect(plots.map((p) => p.spot)).toEqual(HOLDING_SPOTS);
    expect(plots.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("decides the spot by weight order only: the theme changes the width, never the place", () => {
    const a = assignPlots(THEMES.slice(0, 8).map((t, i) => input(t, i)));
    const b = assignPlots(THEMES.slice(3, 11).map((t, i) => input(t, i, i % 2 === 0)));
    expect(b.map((p) => p.spot)).toEqual(a.map((p) => p.spot));
    expect(b.map((p) => p.footprint)).toEqual(THEMES.slice(3, 11).map(footprintOf));
  });

  it("is deterministic and leaves the rest without a plot when there are more than eight", () => {
    const many = Array.from({ length: 11 }, (_, i) => input("plain", i));
    expect(assignPlots(many)).toEqual(assignPlots(many));
    expect(assignPlots(many)).toHaveLength(TOWER_SPOT_COUNT);
  });

  it("puts the biggest holding on the east spot nearest the gate and the next on the west spot facing it", () => {
    const [a, b] = assignPlots([input("plain", 0), input("plain", 1)]);
    expect(a.spot.x).toBeGreaterThan(0);
    expect(b.spot.x).toBeLessThan(0);
    expect(a.spot.z).toBeCloseTo(b.spot.z, 9);
  });

  it("writes a plain table", () => {
    const table = plotsTable(assignPlots([input("mine", 0), input("farm", 1, true)]), (id) => `Name ${id}`);
    expect(table).toContain("Name h0");
    expect(table).toContain("farm (fish)");
  });
});
