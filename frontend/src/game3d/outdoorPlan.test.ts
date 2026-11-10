import { describe, expect, it } from "vitest";
import type { Theme3dId } from "../lib/sectors";
import { WALL_RADIUS, TOWER_SPOT_COUNT } from "./layout";
import { HORIZON_LIMIT } from "./horizonPieces";
import { LAND_TOWER_REACH } from "./holdingLand";
import { FENCE_RADIUS } from "./farmDressing";
import { MARKET_CENTER } from "./marketPieces";
import { CAMP_CENTER, CAMP_REACH } from "./campPieces";
import { PERCH, WATCH_POST } from "./watchPlan";
import { TOWN_HALL_OUTSIDE, TOWN_HALL_REACH } from "./townHallOutside";
import {
  FALLBACK,
  FOOTPRINT,
  GATE_OUTSIDE,
  OUTDOOR_SPOTS,
  OUTDOOR_SPOT_COUNT,
  OUTDOOR_ZONES,
  PLOT_FOOTPRINT_MAX,
  PLOT_GAP,
  ROAD_GAP,
  ROAD_HALF,
  ROAD_START_Z,
  WALL_GAP,
  assignPlots,
  footprintTable,
  groundLimits,
  plotsTable,
  walkFromGate,
  zoneOf,
  zoneWalks,
  type PlotInput,
} from "./outdoorPlan";

const THEMES: Theme3dId[] = ["mine", "quarry", "ingots", "farm", "stall", "bank", "factory", "windmill", "watermill", "fountain", "plain"];

/** One input per holding, with a made-up id. */
const input = (theme: Theme3dId, i: number, fish = false): PlotInput => ({ holdingId: `h${i}`, theme, fish });

function allSpots() {
  return OUTDOOR_ZONES.flatMap((zone) => OUTDOOR_SPOTS[zone].map((spot, index) => ({ zone, index, spot })));
}

describe("outdoor spots: the ground rules", () => {
  it("has more spots than the fortress can show", () => {
    expect(OUTDOOR_SPOT_COUNT).toBeGreaterThanOrEqual(TOWER_SPOT_COUNT);
    expect(allSpots()).toHaveLength(OUTDOOR_SPOT_COUNT);
  });

  it("every zone has a spot, and every zone's fallback list visits every zone once", () => {
    for (const zone of OUTDOOR_ZONES) {
      expect(OUTDOOR_SPOTS[zone].length).toBeGreaterThan(0);
      expect([...FALLBACK[zone]].sort()).toEqual([...OUTDOOR_ZONES].sort());
      expect(FALLBACK[zone][0]).toBe(zone);
    }
  });

  it("every spot stands outside the wall with room to spare, and inside the walkable meadow", () => {
    for (const { zone, index, spot } of allSpots()) {
      const g = groundLimits(spot, PLOT_FOOTPRINT_MAX);
      expect(g.wallRoom, `${zone}[${index}] wall room`).toBeGreaterThanOrEqual(WALL_GAP);
      expect(g.limitRoom, `${zone}[${index}] meadow room`).toBeGreaterThanOrEqual(2);
      expect(g.fromMiddle).toBeGreaterThan(WALL_RADIUS);
      expect(g.fromMiddle).toBeLessThan(HORIZON_LIMIT);
    }
  });

  it("every spot is off the gate road", () => {
    for (const { zone, index, spot } of allSpots()) {
      if (spot.z < ROAD_START_Z - PLOT_FOOTPRINT_MAX) continue;
      expect(Math.abs(spot.x) - PLOT_FOOTPRINT_MAX, `${zone}[${index}] road room`).toBeGreaterThanOrEqual(ROAD_HALF + ROAD_GAP);
    }
  });

  it("every spot is a building-width from every other", () => {
    const spots = allSpots();
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot(spots[i].spot.x - spots[j].spot.x, spots[i].spot.z - spots[j].spot.z);
        expect(d, `${spots[i].zone}[${spots[i].index}] to ${spots[j].zone}[${spots[j].index}]`).toBeGreaterThanOrEqual(2 * PLOT_FOOTPRINT_MAX + PLOT_GAP);
      }
    }
  });

  it("every spot is clear of the Town Hall beside the gate road", () => {
    for (const { zone, index, spot } of allSpots()) {
      expect(Math.hypot(spot.x - TOWN_HALL_OUTSIDE.x, spot.z - TOWN_HALL_OUTSIDE.z), `${zone}[${index}]`).toBeGreaterThanOrEqual(TOWN_HALL_REACH + PLOT_FOOTPRINT_MAX + PLOT_GAP);
    }
  });

  it("the open meadow spreads round the wall: one holding in each quarter, nowhere near the gate road crowd", () => {
    const quarter = (s: { x: number; z: number }) => `${s.z > 0 ? "S" : "N"}${s.x > 0 ? "E" : "W"}`;
    expect(OUTDOOR_SPOTS.meadow.map(quarter).sort()).toEqual(["NE", "NW", "SE", "SW"]);
    // The first holdings that have no landscape of their own stand far apart: the first four are at least 50 from each other.
    const p = assignPlots(["fountain", "bank", "stall", "factory"].map((t, i) => input(t as Theme3dId, i)));
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) expect(Math.hypot(p[i].spot.x - p[j].spot.x, p[i].spot.z - p[j].spot.z)).toBeGreaterThanOrEqual(50);
  });

  it("every spot is clear of the market corner, the drill camp, the watch post and the perch", () => {
    const held = [
      { ...MARKET_CENTER, r: 12 },
      { ...CAMP_CENTER, r: CAMP_REACH },
      { ...WATCH_POST, r: 3 },
      { ...PERCH, r: 3 },
    ];
    for (const { zone, index, spot } of allSpots()) {
      for (const h of held) {
        expect(Math.hypot(spot.x - h.x, spot.z - h.z), `${zone}[${index}]`).toBeGreaterThanOrEqual(h.r + PLOT_FOOTPRINT_MAX);
      }
    }
  });

  it("the footprints cover what each dressing draws", () => {
    for (const t of THEMES) expect(FOOTPRINT[t]).toBeGreaterThanOrEqual(LAND_TOWER_REACH);
    expect(FOOTPRINT.farm).toBeGreaterThan(FENCE_RADIUS);
    expect(PLOT_FOOTPRINT_MAX).toBe(Math.max(...THEMES.map((t) => FOOTPRINT[t])));
  });
});

describe("assignPlots", () => {
  it("gives each theme its home zone, best spot first", () => {
    expect(zoneOf("watermill")).toBe("river");
    expect(zoneOf("farm", true)).toBe("river");
    expect(zoneOf("farm")).toBe("fields");
    expect(zoneOf("windmill")).toBe("rise");
    expect(zoneOf("mine")).toBe("hill");
    expect(zoneOf("quarry")).toBe("hill");
    for (const t of ["fountain", "bank", "stall", "factory", "ingots", "armoury", "apothecary", "plain"] as const) expect(zoneOf(t)).toBe("meadow");

    const p = assignPlots([input("windmill", 0), input("watermill", 1), input("farm", 2), input("mine", 3), input("fountain", 4)]);
    expect(p.map((x) => x.zone)).toEqual(["rise", "river", "fields", "hill", "meadow"]);
    for (const x of p) expect(x.index).toBe(0);
    expect(p[0].spot).toEqual(OUTDOOR_SPOTS.rise[0]);
  });

  it("heaviest first: the first holding of a theme takes the best spot, the next the next", () => {
    const p = assignPlots([input("watermill", 0), input("watermill", 1), input("watermill", 2)]);
    expect(p.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(p.map((x) => x.zone)).toEqual(["river", "river", "river"]);
  });

  it("a full zone spills down the fixed fallback list", () => {
    const p = assignPlots([0, 1, 2, 3, 4].map((i) => input("watermill", i)));
    expect(p.map((x) => x.zone)).toEqual(["river", "river", "river", "rise", "rise"]);
    const q = assignPlots([0, 1, 2, 3].map((i) => input("windmill", i)));
    expect(q.map((x) => x.zone)).toEqual(["rise", "rise", "river", "river"]);
  });

  it("a holding with no building yet stands as a plain tower on the open meadow", () => {
    const p = assignPlots([input("plain", 0), input("ingots", 1)]);
    expect(p.map((x) => x.zone)).toEqual(["meadow", "meadow"]);
    expect(p[0].footprint).toBe(FOOTPRINT.plain);
  });

  it("is deterministic: the same inputs give the same plots", () => {
    const inputs = THEMES.slice(0, 8).map((t, i) => input(t, i, i === 3));
    expect(assignPlots(inputs)).toEqual(assignPlots(inputs));
    expect(assignPlots(inputs)).toEqual(assignPlots(inputs.map((x) => ({ ...x }))));
  });

  it("only theme, fish and order decide the spot: holdings that differ in anything else get the same spot", () => {
    const base = [input("watermill", 0), input("farm", 1, true), input("mine", 2), input("fountain", 3)];
    const decorated = base.map((b, i) => ({
      ...b,
      // Everything the landscape must never read. assignPlots takes PlotInput, so this is dropped by structure.
      verdict: i % 2 ? "breached" : "intact",
      margin_of_safety: i * 10,
      wall: i % 2 ? "rotted" : "basalt",
      moat: i % 2 ? "none" : "wide",
      thesis: i % 2 ? "breached" : "intact",
    }));
    const a = assignPlots(base);
    const b = assignPlots(decorated);
    expect(b.map((p) => p.spot)).toEqual(a.map((p) => p.spot));
    expect(b.map((p) => p.zone)).toEqual(a.map((p) => p.zone));
    // And the spot of a holding does not depend on which holding it is, only on its place in the order.
    const swapped = assignPlots([{ holdingId: "x", theme: "watermill" }, { holdingId: "y", theme: "watermill" }]);
    const other = assignPlots([{ holdingId: "y", theme: "watermill" }, { holdingId: "x", theme: "watermill" }]);
    expect(swapped.map((p) => p.spot)).toEqual(other.map((p) => p.spot));
  });

  it("never gives two holdings the same spot, for every order of up to eight holdings over six representative themes", () => {
    // 6^8 = 1.7 million orders. Each representative stands for its zone (and the fish farm for the river).
    const reps: PlotInput[] = [
      { holdingId: "a", theme: "watermill" },
      { holdingId: "b", theme: "windmill" },
      { holdingId: "c", theme: "farm" },
      { holdingId: "d", theme: "mine" },
      { holdingId: "e", theme: "fountain" },
      { holdingId: "f", theme: "farm", fish: true },
    ];
    const keyOf = new Map<string, number>();
    allSpots().forEach(({ zone, index }, n) => keyOf.set(`${zone}:${index}`, n));
    const seq: PlotInput[] = new Array(8);
    const digits = new Array(8).fill(0);
    const total = reps.length ** 8;
    for (let n = 0; n < total; n++) {
      let k = n;
      for (let i = 0; i < 8; i++) {
        digits[i] = k % reps.length;
        k = Math.floor(k / reps.length);
        seq[i] = { ...reps[digits[i]], holdingId: `h${i}` };
      }
      const plots = assignPlots(seq);
      if (plots.length !== 8) throw new Error(`only ${plots.length} placed for ${digits.join("")}`);
      const seen = new Set<number>();
      for (const p of plots) {
        const id = keyOf.get(`${p.zone}:${p.index}`)!;
        if (seen.has(id)) throw new Error(`spot reused for ${digits.join("")}`);
        seen.add(id);
      }
    }
    expect(total).toBe(1679616);
  }, 60_000);

  it("places every holding of any mix of the eleven themes, up to eight, on distinct spots that are in the ground rules", () => {
    let seed = 12345;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const valid = new Set(allSpots().map(({ spot }) => `${spot.x},${spot.z}`));
    for (let run = 0; run < 20000; run++) {
      const n = 1 + Math.floor(rand() * 8);
      const inputs = Array.from({ length: n }, (_, i) => input(THEMES[Math.floor(rand() * THEMES.length)], i, rand() < 0.3));
      const plots = assignPlots(inputs);
      expect(plots).toHaveLength(n);
      expect(plots.map((p) => p.holdingId)).toEqual(inputs.map((x) => x.holdingId));
      const spots = plots.map((p) => `${p.spot.x},${p.spot.z}`);
      expect(new Set(spots).size).toBe(n);
      for (const s of spots) expect(valid.has(s)).toBe(true);
    }
  });

  it("leaves the extras without a plot instead of stacking them, if there are more holdings than spots", () => {
    const inputs = Array.from({ length: OUTDOOR_SPOT_COUNT + 3 }, (_, i) => input("plain", i));
    const plots = assignPlots(inputs);
    expect(plots).toHaveLength(OUTDOOR_SPOT_COUNT);
    expect(new Set(plots.map((p) => `${p.spot.x},${p.spot.z}`)).size).toBe(OUTDOOR_SPOT_COUNT);
  });
});

describe("readout", () => {
  it("walks: every zone is reachable and nothing is farther than a quarter of a kilometre", () => {
    const walks = zoneWalks();
    expect(walks.map((w) => w.zone)).toEqual([...OUTDOOR_ZONES]);
    for (const w of walks) {
      expect(w.nearest).toBeGreaterThan(0);
      expect(w.farthest).toBeGreaterThanOrEqual(w.nearest);
      expect(w.farthest).toBeLessThan(250);
    }
    expect(walkFromGate(OUTDOOR_SPOTS.meadow[0])).toBeLessThan(walkFromGate(OUTDOOR_SPOTS.hill[0]));
  });

  it("the walk goes round the wall, never through it", () => {
    // The hill foot is straight across the fortress from the gate: the walk is longer than the straight line.
    for (const spot of OUTDOOR_SPOTS.hill) {
      expect(walkFromGate(spot)).toBeGreaterThan(Math.hypot(spot.x - GATE_OUTSIDE.x, spot.z - GATE_OUTSIDE.z) + 20);
    }
    // The first meadow spot (south-east) is in plain view of the gate: the straight line.
    const near = OUTDOOR_SPOTS.meadow[0];
    expect(walkFromGate(near)).toBeCloseTo(Math.hypot(near.x - GATE_OUTSIDE.x, near.z - GATE_OUTSIDE.z), 6);
    // Never shorter than the straight line.
    for (const { spot } of allSpots()) {
      expect(walkFromGate(spot)).toBeGreaterThanOrEqual(Math.hypot(spot.x - GATE_OUTSIDE.x, spot.z - GATE_OUTSIDE.z) - 1e-9);
    }
  });

  it("prints the plots and the footprints as plain tables", () => {
    const plots = assignPlots([input("watermill", 0), input("farm", 1, true), input("plain", 2)]);
    const t = plotsTable(plots, (id) => `Holding ${id}`);
    expect(t).toContain("| Holding h0 | watermill | River bend |");
    expect(t).toContain("farm (fish)");
    const f = footprintTable();
    for (const theme of THEMES) expect(f).toContain(`| ${theme} |`);
    expect(f).toContain("Open meadow");
  });
});
