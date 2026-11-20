/**
 * The Siege Field (asset plan A5, 2026-11-04). Pure data and maths, no three.js and no React.
 *
 * Part of the main map since issue #466: a compact camp on the south-west meadow, with an entrance and no gate of its own (it used to be a place
 * reached through a gate; see `SIEGE_PLOT`): a wall line with one section per
 * holding, a camp of siege engines, skeleton attackers and a command tent. It puts art we already own on the map:
 * `siege.glb` (Kenney Castle Kit: wall, pillar, rocks, banners, the five engines), the four KayKit Skeletons and
 * the tent from `camp.glb`.
 *
 * What carries a fact, and what never does:
 * - A wall section carries ONE fact: how much of that holding the fall takes. The number is the backend's
 *   (`damageWidth`, via the siege yard); this file only turns it into a shape (a height and some rubble).
 * - The engines, attackers, tent and banners are a fixed list. They never grow, multiply or move with the fall,
 *   a holding or a verdict (the enemy camp stays a fixed size, decision of 2026-10-31). A test pins this.
 * - A holding with no usable beta stands in fog: a pale ghost and a "?", never a made-up height.
 * Breach reads from shape, not colour: height, a gap and rubble. No red or green.
 */
import { FALL_DEFAULT } from "./stormDrill";
import type { YardRow, YardFog } from "./siegeYard";

/** The fall the field is drawn at: the drill's own default, the same number the flat page opens with. */
export const FIELD_FALL = FALL_DEFAULT;
/** The field lists up to twelve towers (decision D8); the rest are counted and left to Plain view. */
export const FIELD_MAX_SECTIONS = 12;
/** Fog towers shown as ghosts behind the line; the rest are counted in the plate. */
export const FIELD_MAX_FOG = 6;

// --- Where the field stands on the meadow -----------------------------------------------------------------------
/**
 * The field is part of the main map (issue #466): a compact camp on the open lawn south-west of the fortress, between the lane round the
 * wall and the edge of the meadow, in sight of the Town. It is not a place of its own any more: no gate, no fade, no way back.
 *
 * Local coordinates are the field's own (x across the wall line, z down the field, the wall line at the north end, so camera yaw 0 looks up
 * the field). `SIEGE_PLOT` puts that frame on the meadow: its origin, and a turn so the wall line stands on the far (outer) side and the open
 * south end faces the fortress. The turn is the courtyard's own rule for "outward": local north (0, -1) maps to the radial direction at the
 * plot's angle round the wall (-46 degrees, so the plot sits south-west of the gate road). The plot is 50 wide and 34 deep, fitted to the ground between the lane round the wall (r 58.6) and the walkable edge of the meadow (r 104).
 */
export const SIEGE_PLOT = { x: -56.7, z: 54.7, yaw: Math.PI + (-46 * Math.PI) / 180 } as const;
/** Half the width of the plot, and its depth from the north edge to the south edge (local z). Everything the field draws stays inside. */
export const FIELD_HALF_WIDTH = 25;
export const FIELD_NORTH = -17;
export const FIELD_SOUTH = 17;
/** The entrance: two posts and a plank across the open south end, level with the plot's edge. Furniture only; the gap between the posts is open ground. */
export const FIELD_ENTRANCE = { x: 0, z: 15.5 } as const;

export interface Pt {
  x: number;
  z: number;
}

/** A point in the field's own frame, as a point on the meadow (the courtyard's world frame). */
export function fieldToWorld(p: Pt): Pt {
  const c = Math.cos(SIEGE_PLOT.yaw);
  const s = Math.sin(SIEGE_PLOT.yaw);
  return { x: SIEGE_PLOT.x + p.x * c + p.z * s, z: SIEGE_PLOT.z - p.x * s + p.z * c };
}

/** The other way: where a point on the meadow is in the field's own frame. */
export function worldToField(p: Pt): Pt {
  const c = Math.cos(SIEGE_PLOT.yaw);
  const s = Math.sin(SIEGE_PLOT.yaw);
  const dx = p.x - SIEGE_PLOT.x;
  const dz = p.z - SIEGE_PLOT.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** The four corners of the plot on the meadow, for what has to keep off it (the grove, the boulders, a tilled patch, the meadow plants). */
export function plotCorners(): Pt[] {
  return [
    { x: -FIELD_HALF_WIDTH, z: FIELD_NORTH },
    { x: FIELD_HALF_WIDTH, z: FIELD_NORTH },
    { x: FIELD_HALF_WIDTH, z: FIELD_SOUTH },
    { x: -FIELD_HALF_WIDTH, z: FIELD_SOUTH },
  ].map(fieldToWorld);
}

/** True when a point on the meadow is on the plot, or within `margin` of it. */
export function onPlot(p: Pt, margin = 0): boolean {
  const l = worldToField(p);
  return Math.abs(l.x) <= FIELD_HALF_WIDTH + margin && l.z >= FIELD_NORTH - margin && l.z <= FIELD_SOUTH + margin;
}

/**
 * The camp wakes (is drawn, and reads the book) once the hero is this close to the middle of the plot, so a cold load makes no request for it
 * and draws none of it. It is hidden again past `FIELD_SLEEP_RANGE` (wider, so standing on the edge does not flicker), which stops its
 * skeletons and takes it out of the draw. Its model files start loading at `FIELD_PRELOAD_RANGE`, so waking is not a stall.
 */
export const FIELD_WAKE_RANGE = 50;
export const FIELD_SLEEP_RANGE = 70;
export const FIELD_PRELOAD_RANGE = 55;

// --- The field itself ----------------------------------------------------------------------------------------
export const FIELD_WALL_Z = -10;
export const FIELD_FOG_Z = -15.5;
/** One wall section is this wide (a native 1 x 1.31 x 1 piece, scaled). */
export const SECTION_WIDTH = 3.4;
export const SECTION_THICKNESS = 1.7;
/** Full height of an unhurt section: 1.31 native x 3.4. */
export const SECTION_HEIGHT = 4.45;

export const NEAR_ZERO_BAR = 10;
export type BreachTier = 0 | 1 | 2 | 3;

/**
 * The shape for a share lost. `bar` is the backend's own 0 to 100 damage width (0 for a gain), so the tiers are:
 * unhurt (under 10), cracked (under 30), broken down (under 60), breached (60 and over, a gap).
 */
export function breachTier(bar: number): BreachTier {
  if (!Number.isFinite(bar) || bar < NEAR_ZERO_BAR) return 0;
  if (bar < 30) return 1;
  if (bar < 60) return 2;
  return 3;
}

/** How much of the wall's height is left, by tier. Never rises with the tier. */
export const TIER_HEIGHT: Readonly<Record<BreachTier, number>> = { 0: 1, 1: 0.8, 2: 0.45, 3: 0.12 };
/** Rubble heaps at the foot of the section, by tier. */
export const TIER_RUBBLE: Readonly<Record<BreachTier, number>> = { 0: 0, 1: 1, 2: 2, 3: 3 };
/** A section you can walk through: only the breached one. */
export const tierSolid = (t: BreachTier): boolean => t < 3;

export interface Section {
  id: string;
  name: string;
  x: number;
  z: number;
  tier: BreachTier;
  /** The wall's drawn height in world units. */
  height: number;
  rubble: number;
  solid: boolean;
  /** The signed share lost, as the flat page prints it. */
  shock: string;
  /** The flat page's one word for how it fares. */
  status: string;
}

export interface FogGhost {
  id: string;
  name: string;
  x: number;
  z: number;
}

/** Centres for `n` things in a row, middle at x = 0. */
export function rowX(n: number, width: number = SECTION_WIDTH): number[] {
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * width);
}

/** One section per modelled tower, worst first from west to east. The caller passes rows in the panel's order. */
export function sectionsFor(rows: readonly YardRow[]): Section[] {
  const shown = rows.slice(0, FIELD_MAX_SECTIONS);
  const xs = rowX(shown.length);
  return shown.map((r, i) => {
    const tier = breachTier(r.bar);
    return {
      id: r.id,
      name: r.name,
      x: xs[i],
      z: FIELD_WALL_Z,
      tier,
      height: SECTION_HEIGHT * TIER_HEIGHT[tier],
      rubble: TIER_RUBBLE[tier],
      solid: tierSolid(tier),
      shock: r.shock,
      status: r.status,
    };
  });
}

/** Towers with no usable beta, as ghosts behind the line. Never a number. */
export function ghostsFor(fog: readonly YardFog[]): FogGhost[] {
  const shown = fog.slice(0, FIELD_MAX_FOG);
  const xs = rowX(shown.length, SECTION_WIDTH * 1.6);
  return shown.map((f, i) => ({ id: f.id, name: f.name, x: xs[i], z: FIELD_FOG_Z }));
}

// --- The fixed camp (no input) -------------------------------------------------------------------------------
export type EngineNode = "siege_catapult" | "siege_trebuchet" | "siege_ballista" | "siege_ram" | "siege_tower";

export interface Engine {
  id: string;
  model: EngineNode;
  x: number;
  z: number;
  /** Turn about the vertical axis, radians. The pieces face south at 0; PI faces the wall line. */
  yaw: number;
  scale: number;
  solid: number;
}

const NORTH = Math.PI;

/** Five engines, one of each, in a rank south of the wall line. Fixed: nothing here depends on anything. */
export const ENGINES: readonly Engine[] = [
  { id: "field-catapult", model: "siege_catapult", x: -16, z: -2, yaw: NORTH, scale: 2.4, solid: 1.9 },
  { id: "field-trebuchet", model: "siege_trebuchet", x: -8, z: 0, yaw: NORTH, scale: 2.4, solid: 2.1 },
  { id: "field-ballista", model: "siege_ballista", x: 0, z: -2, yaw: NORTH, scale: 2.4, solid: 1.8 },
  { id: "field-ram", model: "siege_ram", x: 8, z: 0, yaw: NORTH, scale: 2.4, solid: 2.1 },
  { id: "field-tower", model: "siege_tower", x: 16, z: -2, yaw: NORTH, scale: 2.4, solid: 2.3 },
];

export type AttackerFile = "Skeleton_Minion" | "Skeleton_Warrior" | "Skeleton_Rogue" | "Skeleton_Mage";

export interface Attacker {
  id: string;
  file: AttackerFile;
  x: number;
  z: number;
  yaw: number;
  height: number;
  /** Seconds into the idle clip at the start, so they do not breathe in step. */
  phase: number;
}

const ATTACKER_FILES: readonly AttackerFile[] = ["Skeleton_Warrior", "Skeleton_Minion", "Skeleton_Rogue", "Skeleton_Mage"];

/** Eight skeletons in two ranks in front of the engines. Fixed count, fixed places; they only breathe. */
export const ATTACKERS: readonly Attacker[] = Array.from({ length: 8 }, (_, i) => {
  const rank = i < 4 ? 0 : 1;
  const col = i % 4;
  return {
    id: `field-skeleton-${i + 1}`,
    file: ATTACKER_FILES[(col + rank) % ATTACKER_FILES.length],
    x: (col - 1.5) * 8 + (rank === 1 ? 4 : 0),
    z: 4 + rank * 3.5,
    yaw: NORTH,
    height: 1.9,
    phase: ((i * 37) % 17) / 10,
  };
});

/** The command tent (from camp.glb) and the two banners at the ends of the line (from siege.glb). */
export const FIELD_TENT = { x: 20.5, z: 5, yaw: -0.7, scale: 4.2, solid: 1.6 } as const;
export const FIELD_BANNERS = [
  { id: "field-banner-west", x: -(rowX(FIELD_MAX_SECTIONS)[FIELD_MAX_SECTIONS - 1] + SECTION_WIDTH), z: FIELD_WALL_Z, scale: 3.4 },
  { id: "field-banner-east", x: rowX(FIELD_MAX_SECTIONS)[FIELD_MAX_SECTIONS - 1] + SECTION_WIDTH, z: FIELD_WALL_Z, scale: 3.4 },
] as const;
/** Rocks scattered on the open ground, fixed. */
export const FIELD_ROCKS = [
  { id: "field-rock-1", model: "rocks_large", x: -22, z: 8, yaw: 0.4, scale: 2.6 },
  { id: "field-rock-2", model: "rocks_small", x: -17, z: 11.5, yaw: 1.9, scale: 2.4 },
  { id: "field-rock-3", model: "rocks_large", x: 22, z: 11, yaw: 2.7, scale: 2.8 },
  { id: "field-rock-4", model: "rocks_small", x: 13.5, z: 11.5, yaw: 0.9, scale: 2.2 },
] as const;
