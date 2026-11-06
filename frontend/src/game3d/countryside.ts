/**
 * The countryside round the fortress (S31 PR 2): a river, the tracks to every plot, and the fields. Pure data and maths,
 * no three.js and no React. `Countryside.tsx` draws it.
 *
 * THE RULE: the landscape may not carry a fact. Everything here is a fixed number: the same river, the same tracks and
 * the same fields for every portfolio, every verdict and every day. No function in this file takes a holding, a theme, a
 * wall tier or a moat tier, so none of it can lean on one. The only fact on the meadow is still the stream band round
 * each building (the moat tier), and that belongs to the building, not to the river.
 *
 * Coordinates are the courtyard's: x east, z south, the gate at the south (z positive).
 */
import type { Spot } from "./layout";
import { WALL_RADIUS, WALL_THICKNESS } from "./layout";
import { HORIZON, HORIZON_LIMIT, ROAD_END_Z } from "./horizonPieces";
import type { HorizonPiece } from "./horizonPieces";
import { OUTDOOR_SPOTS, OUTDOOR_ZONES, PLOT_FOOTPRINT_MAX, type OutdoorZone } from "./outdoorPlan";

/* ---------------------------------------------------------------- small maths */

export function distToSegment(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

export function distToPolyline(p: Spot, pts: readonly Spot[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i], pts[i + 1]));
  return best;
}

/** How close two polylines come to each other (zero if they cross). Meant for tests and thinning, not for drawing. */
export function polylineGap(a: readonly Spot[], b: readonly Spot[]): number {
  let best = Infinity;
  for (const p of a) best = Math.min(best, distToPolyline(p, b));
  for (const p of b) best = Math.min(best, distToPolyline(p, a));
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) if (segmentsCross(a[i], a[i + 1], b[j], b[j + 1])) return 0;
  }
  return best;
}

function segmentsCross(a: Spot, b: Spot, c: Spot, d: Spot): boolean {
  const o = (p: Spot, q: Spot, r: Spot) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** A smooth line through the waypoints (uniform Catmull-Rom), `per` samples a segment. */
export function smoothLine(waypoints: readonly Spot[], per = 6): Spot[] {
  const out: Spot[] = [];
  const n = waypoints.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = waypoints[Math.min(n - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...waypoints[n - 1] });
  return out;
}

/* ---------------------------------------------------------------- the river */

/** Waypoints from the south, where it runs off the meadow, up round the east, to the northern hills it comes from. */
export const RIVER_WAYPOINTS: readonly Spot[] = [
  { x: 42.4, z: 116.5 },
  { x: 55.5, z: 96.1 },
  { x: 64.3, z: 74.0 },
  { x: 71.2, z: 59.8 },
  { x: 73.7, z: 44.3 },
  { x: 81.8, z: 29.8 },
  { x: 88.6, z: 15.6 },
  { x: 95.9, z: 3.4 },
  { x: 97.8, z: -6.8 },
  { x: 90.3, z: -17.6 },
  { x: 85.3, z: -34.5 },
  { x: 79.5, z: -55.6 },
  { x: 66.8, z: -79.7 },
  { x: 46.9, z: -100.6 },
  { x: 24.9, z: -117.4 },
  { x: 8.9, z: -127.7 },
];
/** The water, and the bank of trodden earth either side of it. Clearly wider than any moat band. */
export const RIVER_WIDTH = 7;
export const RIVER_BANK = 1.2;
export const RIVER_HALF = RIVER_WIDTH / 2 + RIVER_BANK;

export function riverLine(): Spot[] {
  return smoothLine(RIVER_WAYPOINTS, 6);
}

/** A holding on the river or its rise stands this close to the water's edge: near enough to be a mill, never in it. */
export const WATER_NEAR_MIN = RIVER_WIDTH / 2 + 1.5;
export const WATER_NEAR_MAX = 15;

/* ---------------------------------------------------------------- the tracks */

/** The lane round the outside of the wall. Its inner edge clears the corner towers (3.3 wide, standing on the wall line). */
export const RING_RADIUS = 58.6;
export const RING_WIDTH = 1.6;
export const BRANCH_WIDTH = 2;
/** The gate road is 6 wide and ends at z 79 (Courtyard.tsx); the plots further out are reached by running it on. */
export const ROAD_WIDTH = 6;
export const ROAD_RUN_FROM_Z = 78;
export const ROAD_RUN_TO_Z = 92;
/** How far a door stands from the middle of its plot: the widest footprint plus a half unit of open ground. */
export const DOOR_REACH = PLOT_FOOTPRINT_MAX + 0.5;

export type TrackKind = "ring" | "branch" | "road-run" | "stub";

export interface Track {
  id: string;
  kind: TrackKind;
  width: number;
  points: Spot[];
  /** The zone and spot this track ends at (a door); absent for the ring and the road run. */
  to?: { zone: OutdoorZone; index: number };
}

function ringAt(angle: number): Spot {
  return { x: RING_RADIUS * Math.sin(angle), z: RING_RADIUS * Math.cos(angle) };
}

/** A closed lane round the wall, starting and ending at the gate road. */
export function ringLine(steps = 120): Spot[] {
  return Array.from({ length: steps + 1 }, (_, i) => ringAt((i / steps) * Math.PI * 2));
}

/** The road-edge plots face the road; every other plot faces the wall (its door is on the side towards the middle). */
export function doorPoint(zone: OutdoorZone, index: number): Spot {
  const s = OUTDOOR_SPOTS[zone][index];
  if (zone === "road") return { x: s.x - Math.sign(s.x) * DOOR_REACH, z: s.z };
  const r = Math.hypot(s.x, s.z);
  const k = (r - DOOR_REACH) / r;
  return { x: s.x * k, z: s.z * k };
}

export function tracks(): Track[] {
  const out: Track[] = [
    { id: "ring", kind: "ring", width: RING_WIDTH, points: ringLine() },
    { id: "road-run", kind: "road-run", width: ROAD_WIDTH, points: [{ x: 0, z: ROAD_RUN_FROM_Z }, { x: 0, z: ROAD_RUN_TO_Z }] },
  ];
  for (const zone of OUTDOOR_ZONES) {
    OUTDOOR_SPOTS[zone].forEach((s, index) => {
      const door = doorPoint(zone, index);
      const to = { zone, index };
      if (zone === "road") {
        // A short stub from the road's middle (the road hides its first half) straight to the door.
        out.push({ id: `${zone}-${index}`, kind: "stub", width: BRANCH_WIDTH, points: [{ x: 0, z: s.z }, door], to });
      } else {
        // A straight branch from the ring, at the same bearing as the plot, to the door.
        out.push({ id: `${zone}-${index}`, kind: "branch", width: BRANCH_WIDTH, points: [ringAt(Math.atan2(s.x, s.z)), door], to });
      }
    });
  }
  return out;
}

/* ---------------------------------------------------------------- the fields */

export interface FieldPatch {
  id: string;
  x: number;
  z: number;
  /** Across the furrows and along them, in units. */
  w: number;
  d: number;
  /** Turn about the vertical axis, radians. */
  yaw: number;
  furrows: number;
}

/** Tilled patches round the farm plots in the west. Fixed: they do not grow, shrink or change colour with anything. */
export const FIELDS: readonly FieldPatch[] = [
  { id: "f1", x: -73, z: 17, w: 12, d: 8, yaw: 0.35, furrows: 6 },
  { id: "f2", x: -76, z: -11, w: 12, d: 8, yaw: -0.3, furrows: 6 },
  { id: "f3", x: -78, z: 43, w: 12, d: 8, yaw: 0.9, furrows: 6 },
  { id: "f4", x: -93, z: 5, w: 10, d: 8, yaw: 0.1, furrows: 5 },
  { id: "f5", x: -83, z: -40, w: 12, d: 8, yaw: -0.8, furrows: 6 },
];

/** A patch's four corners, turned by its yaw. */
export function fieldCorners(f: FieldPatch): Spot[] {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [
    [-f.w / 2, -f.d / 2],
    [f.w / 2, -f.d / 2],
    [f.w / 2, f.d / 2],
    [-f.w / 2, f.d / 2],
  ].map(([lx, lz]) => ({ x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c }));
}

export const fieldReach = (f: FieldPatch): number => Math.hypot(f.w / 2, f.d / 2);

/* ---------------------------------------------------------------- flat strips for drawing */

export interface Strip {
  /** x, y, z per vertex. */
  positions: number[];
  /** Three indices per triangle. */
  indices: number[];
  /** r, g, b per vertex, 0 to 1. */
  colors: number[];
}

/** One flat ribbon of the given width along a line, at height `y`. Joins are the average of the two neighbouring directions. */
export function ribbon(line: readonly Spot[], width: number, y: number, rgb: readonly [number, number, number]): Strip {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const half = width / 2;
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const nx = -tz;
    const nz = tx;
    const p = line[i];
    positions.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
    colors.push(...rgb, ...rgb);
    if (i > 0) {
      const v = (i - 1) * 2;
      indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  return { positions, indices, colors };
}

/** A flat rectangle (a field, or a furrow) from four corners, at height `y`. */
export function quad(corners: readonly Spot[], y: number, rgb: readonly [number, number, number]): Strip {
  return {
    positions: corners.flatMap((p) => [p.x, y, p.z]),
    colors: corners.flatMap(() => [...rgb]),
    indices: [0, 1, 2, 0, 2, 3],
  };
}

/** Several strips as one, so the whole countryside is a single mesh and a single draw call. */
export function mergeStrips(strips: readonly Strip[]): Strip {
  const out: Strip = { positions: [], indices: [], colors: [] };
  for (const s of strips) {
    const base = out.positions.length / 3;
    out.positions.push(...s.positions);
    out.colors.push(...s.colors);
    out.indices.push(...s.indices.map((i) => i + base));
  }
  return out;
}

/** Colours as 0 to 1 triples. Earth and water only: no red and no green, so no colour here can read as a verdict. */
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const COUNTRYSIDE_COLORS = {
  bank: hex("#9a8566"),
  water: hex("#3f86c4"),
  flow: hex("#8fc3ea"),
  track: hex("#b8a888"),
  soil: hex("#8a7050"),
  furrow: hex("#6b573b"),
};

/** The countryside as one flat mesh's data. Layers sit a hair above each other so they never fight in the depth buffer. */
export function countrysideMesh(): Strip {
  const river = riverLine();
  const strips: Strip[] = [
    ribbon(river, RIVER_WIDTH + 2 * RIVER_BANK, 0.04, COUNTRYSIDE_COLORS.bank),
    ribbon(river, RIVER_WIDTH, 0.065, COUNTRYSIDE_COLORS.water),
    ribbon(river, 1.4, 0.09, COUNTRYSIDE_COLORS.flow),
  ];
  for (const t of tracks()) strips.push(ribbon(t.points, t.width, 0.05, COUNTRYSIDE_COLORS.track));
  for (const f of FIELDS) {
    strips.push(quad(fieldCorners(f), 0.05, COUNTRYSIDE_COLORS.soil));
    // Furrows: thin darker strips along the long side, evenly spaced.
    const c = Math.cos(f.yaw);
    const s = Math.sin(f.yaw);
    for (let i = 0; i < f.furrows; i++) {
      const lz = -f.d / 2 + ((i + 0.5) / f.furrows) * f.d;
      const a = { x: f.x + (-f.w / 2 + 0.4) * c + lz * s, z: f.z - (-f.w / 2 + 0.4) * s + lz * c };
      const b = { x: f.x + (f.w / 2 - 0.4) * c + lz * s, z: f.z - (f.w / 2 - 0.4) * s + lz * c };
      strips.push(ribbon([a, b], 0.28, 0.07, COUNTRYSIDE_COLORS.furrow));
    }
  }
  return mergeStrips(strips);
}

/* ---------------------------------------------------------------- thinning the grove */

/** How far a tree or a boulder's crown or body reaches, from its scale (its solid base is only the trunk). */
const crownReach = (p: HorizonPiece): number => Math.max(p.solid, p.scale * 0.45);
/** Open ground kept between a piece and the river, a track, a field or a plot. */
export const THIN_MARGIN = 1.5;

/** True where the countryside needs the ground a grove piece stands on: the piece is dropped, never moved. */
export function inTheWay(p: HorizonPiece): boolean {
  if (p.ring !== "grove" && p.ring !== "rock") return false;
  const at = { x: p.x, z: p.z };
  const reach = crownReach(p) + THIN_MARGIN;
  if (distToPolyline(at, riverLine()) < RIVER_HALF + reach) return true;
  for (const t of tracks()) if (distToPolyline(at, t.points) < t.width / 2 + reach) return true;
  for (const f of FIELDS) if (Math.hypot(p.x - f.x, p.z - f.z) < fieldReach(f) + reach) return true;
  for (const zone of OUTDOOR_ZONES) for (const s of OUTDOOR_SPOTS[zone]) if (Math.hypot(p.x - s.x, p.z - s.z) < PLOT_FOOTPRINT_MAX + reach) return true;
  return false;
}

let thinned: HorizonPiece[] | null = null;

/** The horizon with the pieces in the way dropped. Same seed, same horizon: only fewer pieces. Computed once. */
export function thinnedHorizon(): HorizonPiece[] {
  thinned ??= HORIZON.filter((p) => !inTheWay(p));
  return thinned;
}

/** The hard limits the countryside keeps, for the tests: clear of the wall and inside the meadow. */
export const WALL_OUTER = WALL_RADIUS + WALL_THICKNESS / 2;
export const MEADOW_EDGE = HORIZON_LIMIT;
export const GATE_ROAD_END_Z = ROAD_END_Z;
