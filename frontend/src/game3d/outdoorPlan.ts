/**
 * Where the holdings stand (S31, moved back inside the wall 2026-11-11). Pure data and maths, no three.js and no React.
 *
 * The holdings stand inside the fortress, spread evenly round the inside of the wall: four along the east wall and four
 * along the west wall, on one ring, the same angle apart. The south (the gate, Sal's corner and the market on the east,
 * the Storm Drill camp on the west) and the keep in the north are left open, so the ring runs from just north of the camp
 * and the market up to either side of the keep. Every door faces the open middle of the yard. The file keeps its old
 * name (`outdoorPlan`) so the many callers stay put; the holdings no longer stand outside.
 *
 * THE RULE: the ground may not carry a fact. A spot depends on the holding's ORDER (weight rank) only, the same rule the
 * horseshoe and the meadow used. Never the verdict, the margin of safety, the thesis, the wall or the moat. `assignPlots`
 * takes nothing else, so it cannot read them. The spots are fixed numbers, the same for every portfolio. The theme only
 * decides how wide the building stands (its footprint), never where.
 *
 * Coordinates are the courtyard's: x east, z south, the gate at the south (z positive). Angles run with 0 at the south
 * gate: position = (radius * sin(angle), radius * cos(angle)), so PI is north.
 */
import type { Theme3dId } from "../lib/sectors";
import type { Spot } from "./layout";
import { LAND_TOWER_REACH } from "./holdingLand";
import { FENCE_RADIUS } from "./farmDressing";
import { MOAT_WIDTH, SIZE_RADIUS } from "./towerLook";

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
  armoury: WIDE_TOWER,
  apothecary: WIDE_TOWER,
  plain: WIDE_TOWER,
};

/** The widest footprint of any theme: every spot is spaced for it, so any theme fits any spot. */
export const PLOT_FOOTPRINT_MAX = Math.max(...Object.values(FOOTPRINT));
/** Open ground kept between two buildings (edge to edge), and between a building and anything else in the yard. */
export const PLOT_GAP = 2;
/** Open ground kept between a building and the inside face of the curtain wall. */
export const WALL_GAP = 3;

export function footprintOf(theme: Theme3dId): number {
  return FOOTPRINT[theme];
}

/** The ring the holdings stand on: its outer edge (radius plus the widest footprint) meets the edge of the cobbles. */
export const HOLDING_RING_RADIUS = 42;
/** The ring's southern end, either side (radians from the gate): just north of the market (east) and the drill camp (west). */
export const HOLDING_RING_FROM = (92 * Math.PI) / 180;
/** The ring's northern end, either side: clear of the keep (and of its plain-shape fallback, which is wider). */
export const HOLDING_RING_TO = (158 * Math.PI) / 180;
/** Spots per side wall. Two sides make the eight the fortress shows. */
export const SPOTS_PER_SIDE = 4;
/** The same angle between every pair of neighbours on a side. */
export const HOLDING_RING_STEP = (HOLDING_RING_TO - HOLDING_RING_FROM) / (SPOTS_PER_SIDE - 1);

function ringSpot(angle: number): Spot {
  return { x: HOLDING_RING_RADIUS * Math.sin(angle), z: HOLDING_RING_RADIUS * Math.cos(angle) };
}

/**
 * The spots, best first: the biggest holding takes the east spot nearest the gate, the next the west spot facing it, and
 * so on up the walls towards the keep. Mirrored on purpose, like the old horseshoe: the yard reads as even.
 */
export const HOLDING_SPOTS: readonly Spot[] = Array.from({ length: SPOTS_PER_SIDE * 2 }, (_, i) => {
  const step = Math.floor(i / 2);
  const side = i % 2 === 0 ? 1 : -1;
  return ringSpot(side * (HOLDING_RING_FROM + step * HOLDING_RING_STEP));
});

/** How far a door stands from the middle of its plot: the widest footprint plus a half unit of open ground. */
export const DOOR_REACH = PLOT_FOOTPRINT_MAX + 0.5;

/** Every building faces the open middle of the yard: its door is on the side towards the centre. */
export function doorPointOf(spot: Spot): Spot {
  const r = Math.hypot(spot.x, spot.z);
  const k = (r - DOOR_REACH) / r;
  return { x: spot.x * k, z: spot.z * k };
}

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
  /** Which spot on the ring (0 = best, east of the gate side). */
  index: number;
  spot: Spot;
  footprint: number;
}

/**
 * Plots for holdings given in weight order (biggest first, the order of the flat Fortress): the n-th holding takes the
 * n-th spot. More holdings than spots leaves the rest without a plot (the fortress shows eight, the ring has eight).
 */
export function assignPlots(holdings: readonly PlotInput[]): Plot[] {
  return holdings.slice(0, HOLDING_SPOTS.length).map((h, index) => ({
    holdingId: h.holdingId,
    theme: h.theme,
    fish: !!h.fish,
    index,
    spot: HOLDING_SPOTS[index],
    footprint: footprintOf(h.theme),
  }));
}

/** The plots as a plain table, for a test log and the PR text. */
export function plotsTable(plots: readonly Plot[], nameOf: (id: string) => string = (id) => id): string {
  const head = "| Holding | Theme | Spot | (x, z) | Footprint |\n|---|---|---|---|---|";
  return [
    head,
    ...plots.map(
      (p) =>
        `| ${nameOf(p.holdingId)} | ${p.theme}${p.fish ? " (fish)" : ""} | ${p.index + 1} | ${p.spot.x.toFixed(1)}, ${p.spot.z.toFixed(1)} | ${p.footprint.toFixed(1)} |`,
    ),
  ].join("\n");
}
