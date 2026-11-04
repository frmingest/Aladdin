/**
 * Where the holdings stand out in the landscape (S31 PR 1). Pure data and maths, no three.js and no React.
 *
 * The fortress stays where it is; its holdings step out onto the meadow beyond the wall. Each theme has a home zone with
 * more spots than it can ever need (a river bend, a rise by the river, fields, the hill foot, the road edge). Holdings
 * fill their zone from the best spot outward, heaviest first; if a zone is full they spill to a fixed fallback order.
 *
 * THE RULE: the landscape may not carry a fact. A spot depends on the holding's THEME and its ORDER (weight rank)
 * only, the same rule the horseshoe uses today. Never the verdict, the margin of safety, the thesis, the wall or
 * the moat. `assignPlots` takes nothing else, so it cannot read them. The spots are fixed numbers, the same for every
 * portfolio. Nothing is drawn by this file, and nothing in the game calls it yet (PR 3 does).
 *
 * Coordinates are the courtyard's: x east, z south, the gate at the south (z positive). The wall stands at
 * WALL_RADIUS; the walkable meadow ends at HORIZON_LIMIT.
 */
import type { Theme3dId } from "../lib/sectors";
import { WALL_RADIUS, WALL_THICKNESS, type Spot } from "./layout";
import { HORIZON_LIMIT } from "./horizonPieces";
import { LAND_TOWER_REACH } from "./holdingLand";
import { FENCE_RADIUS } from "./farmDressing";
import { MOAT_WIDTH, SIZE_RADIUS } from "./towerLook";

export type OutdoorZone = "river" | "rise" | "fields" | "hill" | "road";

export const OUTDOOR_ZONES: readonly OutdoorZone[] = ["river", "rise", "fields", "hill", "road"];

/** Words for the readout and tests. Not shown to the player (PR 3 decides what a door post says). */
export const ZONE_LABEL: Record<OutdoorZone, string> = {
  river: "River bend",
  rise: "Rise by the river",
  fields: "Fields",
  hill: "Hill foot",
  road: "Road edge",
};

/** How wide each theme stands on the ground, from the centre to the edge of its stream band (or fence, or moat). */
const WIDE_TOWER = SIZE_RADIUS.great + MOAT_WIDTH.wide;
export const FOOTPRINT: Record<Theme3dId, number> = {
  mine: LAND_TOWER_REACH,
  quarry: LAND_TOWER_REACH,
  ingots: WIDE_TOWER,
  farm: FENCE_RADIUS + 0.5,
  stall: WIDE_TOWER,
  bank: WIDE_TOWER,
  factory: WIDE_TOWER,
  windmill: LAND_TOWER_REACH,
  watermill: LAND_TOWER_REACH,
  fountain: LAND_TOWER_REACH,
  plain: WIDE_TOWER,
};

/** The widest footprint of any theme: every spot is spaced for it, so any theme fits any spot. */
export const PLOT_FOOTPRINT_MAX = Math.max(...Object.values(FOOTPRINT));
/** Open ground kept between two buildings (edge to edge), and between a building and the wall or the road. */
export const PLOT_GAP = 2;
export const WALL_GAP = 3;
/** The gate road is 6 wide (Courtyard.tsx); a building's edge stays this far from its edge. */
export const ROAD_HALF = 3;
export const ROAD_GAP = 4;
/** Where the road ends and the plots to the south of it may no longer line up with it. */
export const ROAD_START_Z = WALL_RADIUS - 4;

export function footprintOf(theme: Theme3dId): number {
  return FOOTPRINT[theme];
}

/**
 * The spots, per zone, best first. Fixed numbers, never computed from a holding. Coordinates (x, z) in world units.
 * The river runs down from the northern hills and bends past the east and south-east of the wall; the watermill and the
 * fish farm stand on it, a windmill on a rise beside it; the fields lie to the west; the hill foot is the north; the road
 * edge is the strip either side of the gate road, a short walk from the gate.
 */
export const OUTDOOR_SPOTS: Readonly<Record<OutdoorZone, readonly Spot[]>> = {
  river: [
    { x: 66, z: 40 },
    { x: 80, z: 14 },
    { x: 76, z: -14 },
  ],
  rise: [
    { x: 58, z: 66 },
    { x: 88, z: -4 },
  ],
  fields: [
    { x: -66, z: 30 },
    { x: -80, z: 4 },
    { x: -72, z: -26 },
  ],
  hill: [
    { x: 0, z: -84 },
    { x: -30, z: -70 },
    { x: 30, z: -72 },
  ],
  road: [
    { x: -16, z: 62 },
    { x: 16, z: 62 },
    { x: -18, z: 80 },
    { x: 18, z: 80 },
  ],
};

/** Total spots across all zones: more than the eight holdings the fortress can show. */
export const OUTDOOR_SPOT_COUNT = OUTDOOR_ZONES.reduce((n, z) => n + OUTDOOR_SPOTS[z].length, 0);

/** The zone a theme calls home. A fish farm lives on the river, a plain farm in the fields. */
export function zoneOf(theme: Theme3dId, fish = false): OutdoorZone {
  switch (theme) {
    case "watermill":
      return "river";
    case "farm":
      return fish ? "river" : "fields";
    case "windmill":
      return "rise";
    case "mine":
    case "quarry":
      return "hill";
    default:
      // fountain, bank, stall, factory, ingots and the plain tower: the road edge until their own building arrives.
      return "road";
  }
}

/** If a zone is full, the next zones to try, in this order. Fixed, so the same inputs always give the same plots. */
export const FALLBACK: Readonly<Record<OutdoorZone, readonly OutdoorZone[]>> = {
  river: ["river", "rise", "fields", "road", "hill"],
  rise: ["rise", "river", "fields", "road", "hill"],
  fields: ["fields", "road", "rise", "river", "hill"],
  hill: ["hill", "fields", "river", "rise", "road"],
  road: ["road", "fields", "river", "hill", "rise"],
};

/** What a holding must tell the plan: its identity, its theme and whether it is a fish farm. Nothing about its state. */
export interface PlotInput {
  holdingId: string;
  theme: Theme3dId;
  fish?: boolean;
}

export interface Plot {
  holdingId: string;
  theme: Theme3dId;
  fish: boolean;
  zone: OutdoorZone;
  /** Which spot of that zone (0 = best). */
  index: number;
  spot: Spot;
  footprint: number;
}

/**
 * Plots for holdings given in weight order (biggest first, the order of the flat Fortress). A holding takes the best
 * free spot of its home zone; a full zone sends it down its fallback list. More holdings than spots leaves the rest
 * without a plot (the fortress shows eight, so the spots are always enough for them).
 */
export function assignPlots(holdings: readonly PlotInput[]): Plot[] {
  const taken = new Set<string>();
  const plots: Plot[] = [];
  for (const h of holdings) {
    const fish = !!h.fish;
    const home = zoneOf(h.theme, fish);
    let placed: Plot | null = null;
    for (const zone of FALLBACK[home]) {
      const spots = OUTDOOR_SPOTS[zone];
      const index = spots.findIndex((_, i) => !taken.has(`${zone}:${i}`));
      if (index < 0) continue;
      taken.add(`${zone}:${index}`);
      placed = { holdingId: h.holdingId, theme: h.theme, fish, zone, index, spot: spots[index], footprint: footprintOf(h.theme) };
      break;
    }
    if (placed) plots.push(placed);
  }
  return plots;
}

/** Where you step out of the gate onto the meadow: just beyond the wall, on the road. */
export const GATE_OUTSIDE: Spot = { x: 0, z: WALL_RADIUS + WALL_THICKNESS / 2 + 1 };

/** The wall is solid: a walk that would cross it goes round it, hugging a circle just outside the stone. */
const WALK_RING = WALL_RADIUS + WALL_THICKNESS / 2 + 1;

/**
 * The walk from the gate to a spot, in world units: a straight line if it clears the wall, else along the wall's outside
 * (tangent, arc, tangent). A floor for the real walk, which also follows the track. Meant for the readout and the tests;
 * it is not the walking itself.
 */
export function walkFromGate(spot: Spot): number {
  const g = GATE_OUTSIDE;
  const dG = Math.hypot(g.x, g.z);
  const dS = Math.hypot(spot.x, spot.z);
  const angleG = Math.atan2(g.x, g.z);
  const angleS = Math.atan2(spot.x, spot.z);
  let delta = Math.abs(angleS - angleG);
  if (delta > Math.PI) delta = 2 * Math.PI - delta;
  const arc = delta - Math.acos(WALK_RING / dG) - Math.acos(Math.min(1, WALK_RING / dS));
  if (arc <= 0) return Math.hypot(spot.x - g.x, spot.z - g.z);
  return Math.sqrt(dG * dG - WALK_RING * WALK_RING) + WALK_RING * arc + Math.sqrt(Math.max(0, dS * dS - WALK_RING * WALK_RING));
}

export interface ZoneWalk {
  zone: OutdoorZone;
  spots: number;
  nearest: number;
  farthest: number;
}

/** The walk from the gate to every zone: nearest and farthest spot. */
export function zoneWalks(): ZoneWalk[] {
  return OUTDOOR_ZONES.map((zone) => {
    const d = OUTDOOR_SPOTS[zone].map(walkFromGate);
    return { zone, spots: d.length, nearest: Math.min(...d), farthest: Math.max(...d) };
  });
}

/** Where a spot stands against the hard limits: radius from the middle, and the free ground beyond its footprint. */
export function groundLimits(spot: Spot, footprint: number): { fromMiddle: number; wallRoom: number; limitRoom: number } {
  const fromMiddle = Math.hypot(spot.x, spot.z);
  return {
    fromMiddle,
    wallRoom: fromMiddle - footprint - (WALL_RADIUS + WALL_THICKNESS / 2),
    limitRoom: HORIZON_LIMIT - (fromMiddle + footprint),
  };
}

/** The plots as a plain table, for a test log and the PR text. */
export function plotsTable(plots: readonly Plot[], nameOf: (id: string) => string = (id) => id): string {
  const head = "| Holding | Theme | Zone | Spot (x, z) | Footprint | Walk from gate |\n|---|---|---|---|---|---|";
  return [
    head,
    ...plots.map(
      (p) =>
        `| ${nameOf(p.holdingId)} | ${p.theme}${p.fish ? " (fish)" : ""} | ${ZONE_LABEL[p.zone]} | ${p.spot.x}, ${p.spot.z} | ${p.footprint.toFixed(1)} | ${walkFromGate(p.spot).toFixed(0)} |`,
    ),
  ].join("\n");
}

/** The footprint of every dressing and the walk to every zone, as a plain table, for the PR text. */
export function footprintTable(): string {
  const rows = (Object.keys(FOOTPRINT) as Theme3dId[]).map((t) => `| ${t} | ${FOOTPRINT[t].toFixed(1)} |`);
  const walks = zoneWalks().map(
    (w) => `| ${ZONE_LABEL[w.zone]} | ${w.spots} | ${w.nearest.toFixed(0)} | ${w.farthest.toFixed(0)} |`,
  );
  return [
    "| Theme | Footprint radius |\n|---|---|",
    ...rows,
    "",
    "| Zone | Spots | Nearest walk | Farthest walk |\n|---|---|---|---|",
    ...walks,
  ].join("\n");
}
