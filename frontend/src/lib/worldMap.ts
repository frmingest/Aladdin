/**
 * The Cartographer's world (game mode, identity pass 2). A fantasy continent generated from a fixed
 * seed, so it is the same land on every visit and for every reader. The land itself is scenery and
 * carries no data. What the map says comes from the realm:
 *
 *  - one settlement per holding; its size follows the holding's weight (bounded, like the home scene);
 *  - one province per sector, so holdings of one sector are neighbours; holdings with no sector set sit
 *    in their own province, named as such, and are never folded into a real sector;
 *  - the five fog patches on each settlement are the survey, drawn by the same code as before;
 *  - the Great Keep stands at the capital. It is not a holding; the cash commission plants its flag there.
 *
 * Truth rules kept here, each under test: terrain never encodes a state (no good or bad land, nothing
 * drawn greener, richer or safer because a tower is clear), every holding is placed exactly once and
 * never on top of another, and unknown stays visible (no sector -> its own labelled province).
 * Pure functions only: no React, no randomness beyond the seed.
 */

export const WORLD = { w: 1000, h: 720 } as const;
export const CAPITAL = { x: 500, y: 372 } as const;

export interface Pt {
  x: number;
  y: number;
}

// --- Seeded randomness -----------------------------------------------------------------------------

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// --- Geometry ----------------------------------------------------------------------------------------

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A closed smooth path through the points (Catmull-Rom to cubic Bezier). */
export function smoothClosedPath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return `${d} Z`;
}

/** An open smooth path through the points. */
export function smoothOpenPath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 2) return "";
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

/** Clip a convex polygon to the half plane of points closer to `a` than to `b`. */
export function clipHalfPlane(poly: readonly Pt[], a: Pt, b: Pt): Pt[] {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const nx = b.x - a.x;
  const ny = b.y - a.y;
  const side = (p: Pt) => (p.x - mx) * nx + (p.y - my) * ny; // < 0: on a's side
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if (sp < 0 !== sq < 0) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

/** The Voronoi cell of each anchor inside the world rectangle. */
export function voronoiCells(anchors: readonly Pt[], pad = 400): Pt[][] {
  const box: Pt[] = [
    { x: -pad, y: -pad },
    { x: WORLD.w + pad, y: -pad },
    { x: WORLD.w + pad, y: WORLD.h + pad },
    { x: -pad, y: WORLD.h + pad },
  ];
  return anchors.map((a, i) => {
    let cell = box;
    anchors.forEach((b, j) => {
      if (i !== j && cell.length > 0) cell = clipHalfPlane(cell, a, b);
    });
    return cell;
  });
}

// --- The land ------------------------------------------------------------------------------------------

/** Change this and the whole world changes. It is a fixed string on purpose: the realm is one place. */
export const WORLD_SEED = "aladdin-realm-3";

export interface Glyph {
  x: number;
  y: number;
  /** 0.7 to 1.3 */
  s: number;
  /** a second random number for the drawing (which variant, which lean) */
  v: number;
}

export interface World {
  coast: Pt[];
  landPath: string;
  islands: { pts: Pt[]; path: string }[];
  /** A path round the coast, a little way out to sea, for the ships. */
  shipLoops: string[];
  sites: Pt[];
  spacing: number;
  mountains: Glyph[];
  forests: Glyph[];
  hills: Glyph[];
  rivers: string[];
  waves: Pt[];
  /** Open water for the compass rose and the sea serpent. */
  compass: Pt;
  serpent: Pt;
}

export function isLand(w: Pick<World, "coast" | "islands">, p: Pt): boolean {
  return pointInPolygon(p, w.coast) || w.islands.some((i) => pointInPolygon(p, i.pts));
}

export function coastDistance(w: Pick<World, "coast" | "islands">, p: Pt): number {
  let best = Infinity;
  for (const poly of [w.coast, ...w.islands.map((i) => i.pts)]) {
    for (const c of poly) best = Math.min(best, dist(p, c));
  }
  return best;
}

function blob(rng: () => number, cx: number, cy: number, rx: number, ry: number, n: number, wobble: number): Pt[] {
  const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const rr =
      1 +
      wobble * 0.95 * Math.sin(2 * a + ph[0]) +
      wobble * 0.7 * Math.sin(3 * a + ph[1]) +
      wobble * 0.42 * Math.sin(5 * a + ph[2]) +
      wobble * 0.22 * Math.sin(9 * a + ph[3]);
    const k2 = Math.max(0.5, rr);
    return { x: cx + rx * k2 * Math.cos(a), y: cy + ry * k2 * Math.sin(a) };
  });
}

function poissonSites(w: Pick<World, "coast" | "islands">, spacing: number, seed: string, avoid: readonly Pt[]): Pt[] {
  const rng = mulberry32(hashString(`${seed}:sites:${spacing}`));
  const out: Pt[] = [];
  for (let tries = 0; tries < 9000; tries++) {
    const p = { x: 40 + rng() * (WORLD.w - 80), y: 40 + rng() * (WORLD.h - 80) };
    if (!isLand(w, p) || coastDistance(w, p) < 34) continue;
    if (avoid.some((a) => dist(a, p) < spacing * 0.95)) continue;
    if (out.some((o) => dist(o, p) < spacing)) continue;
    out.push(p);
  }
  return out;
}

let cached: World | null = null;

/** Build the world. Deterministic; memoised, since it is the same every time. */
export function buildWorld(seed: string = WORLD_SEED): World {
  if (cached && seed === WORLD_SEED) return cached;
  const rng = mulberry32(hashString(seed));
  const coast = blob(rng, 500, 366, 372, 262, 112, 0.17);
  const islands = [
    { cx: 118, cy: 120, rx: 52, ry: 36 },
    { cx: 905, cy: 118, rx: 40, ry: 46 },
    { cx: 90, cy: 612, rx: 46, ry: 32 },
    { cx: 930, cy: 640, rx: 34, ry: 26 },
    { cx: 760, cy: 40, rx: 24, ry: 14 },
  ].map((i) => {
    const pts = blob(rng, i.cx, i.cy, i.rx, i.ry, 28, 0.2);
    return { pts, path: smoothClosedPath(pts) };
  });
  const base: Pick<World, "coast" | "islands"> = { coast, islands };

  const loop = (k: number) =>
    smoothClosedPath(
      coast.map((p) => ({
        x: Math.min(985, Math.max(15, CAPITAL.x + (p.x - CAPITAL.x) * k)),
        y: Math.min(705, Math.max(15, CAPITAL.y + (p.y - CAPITAL.y) * k)),
      })),
    );
  const shipLoops = [loop(1.12), loop(1.2)];

  const spacing = 86;
  const sites = poissonSites(base, spacing, seed, [CAPITAL]);

  // Scenery. Elevation is a smooth field; it only decides where mountains and forests are drawn.
  const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28];
  const elev = (p: Pt) => 0.5 + 0.22 * Math.sin(p.x / 83 + ph[0]) + 0.2 * Math.sin(p.y / 71 + ph[1]) + 0.12 * Math.sin((p.x + p.y) / 57 + ph[2]);
  const scatter = (count: number, ok: (p: Pt) => boolean, minSep: number): Glyph[] => {
    const out: Glyph[] = [];
    for (let t = 0; t < count * 40 && out.length < count; t++) {
      const p = { x: 30 + rng() * (WORLD.w - 60), y: 30 + rng() * (WORLD.h - 60) };
      if (!isLand(base, p) || coastDistance(base, p) < 14 || !ok(p)) continue;
      if (out.some((o) => dist(o, p) < minSep)) continue;
      out.push({ x: r1(p.x), y: r1(p.y), s: 0.7 + rng() * 0.6, v: rng() });
    }
    return out;
  };
  const mountains = scatter(78, (p) => elev(p) > 0.66, 30);
  const hills = scatter(46, (p) => elev(p) > 0.5 && elev(p) <= 0.66, 36);
  const forests: Glyph[] = [];
  for (let c = 0; c < 20; c++) {
    const cp = { x: 60 + rng() * (WORLD.w - 120), y: 60 + rng() * (WORLD.h - 120) };
    if (!isLand(base, cp) || elev(cp) > 0.66) continue;
    const n = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const p = { x: cp.x + (rng() - 0.5) * 54, y: cp.y + (rng() - 0.5) * 38 };
      if (isLand(base, p) && coastDistance(base, p) > 12) forests.push({ x: r1(p.x), y: r1(p.y), s: 0.75 + rng() * 0.5, v: rng() });
    }
  }

  // Rivers run from high ground to the nearest shore.
  const rivers: string[] = [];
  const peaks = [...mountains].sort((a, b) => elev(b) - elev(a)).slice(0, 5);
  const shore = coast;
  for (let i = 0; i < peaks.length && rivers.length < 3; i++) {
    const from = peaks[i * 2 % peaks.length];
    let nearest = shore[0];
    for (const c of shore) if (dist(c, from) < dist(nearest, from)) nearest = c;
    const steps = Math.max(4, Math.round(dist(from, nearest) / 34));
    const pts: Pt[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const wob = Math.sin(t * Math.PI * 3 + i) * 16 * Math.sin(t * Math.PI);
      const dx = nearest.x - from.x;
      const dy = nearest.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      pts.push({ x: from.x + dx * t - (dy / len) * wob, y: from.y + dy * t + (dx / len) * wob });
    }
    rivers.push(smoothOpenPath(pts));
  }

  // Wave marks on open water.
  const waves: Pt[] = [];
  for (let t = 0; t < 4000 && waves.length < 150; t++) {
    const p = { x: 14 + rng() * (WORLD.w - 28), y: 14 + rng() * (WORLD.h - 28) };
    if (isLand(base, p) || coastDistance(base, p) < 22) continue;
    if (waves.some((o) => dist(o, p) < 30)) continue;
    waves.push({ x: r1(p.x), y: r1(p.y) });
  }

  // The open water furthest from any shore in two corners.
  const seaSpot = (ok: (p: Pt) => boolean): Pt => {
    let best: Pt = { x: 900, y: 640 };
    let bd = -1;
    for (let x = 40; x < WORLD.w - 40; x += 16) {
      for (let y = 40; y < WORLD.h - 40; y += 16) {
        const p = { x, y };
        if (!ok(p) || isLand(base, p)) continue;
        const d = coastDistance(base, p);
        if (d > bd) {
          bd = d;
          best = p;
        }
      }
    }
    return best;
  };
  const compass = seaSpot((p) => p.x > 720 && p.y > 480);
  const serpent = seaSpot((p) => p.x < 300 && p.y > 440 && dist(p, compass) > 300);

  const world: World = { coast, landPath: smoothClosedPath(coast), islands, shipLoops, sites, spacing, mountains, forests, hills, rivers, waves, compass, serpent };
  if (seed === WORLD_SEED) cached = world;
  return world;
}

// --- Placing the realm ---------------------------------------------------------------------------------

export const MAX_PROVINCES = 8;
export const NO_SECTOR_NAME = "No sector set";
export const SECTOR_UNKNOWN_NAME = "Sector unknown";
export const OTHER_SECTORS_NAME = "Other sectors";

export interface PlaceInput {
  id: string;
  weightPct: number | null;
  /** The holding's sector, or null when none is set (or it could not be read). */
  sector: string | null;
}

export interface Settlement {
  id: string;
  x: number;
  y: number;
  /** Drawing scale of the 120-wide tower picture. */
  scale: number;
  province: number;
}

export interface Province {
  index: number;
  name: string;
  /** True for the province that holds holdings with no sector: it is drawn dashed, as unknown. */
  unsorted: boolean;
  cell: Pt[];
  path: string;
  label: Pt;
  anchor: Pt;
  towerIds: string[];
}

export interface Realm {
  settlements: Settlement[];
  provinces: Province[];
  keep: Pt;
  roads: string[];
  mountains: Glyph[];
  forests: Glyph[];
  hills: Glyph[];
  rivers: string[];
}

/** Drawing scale from weight: bounded, like the home scene's weightScale; unknown draws at the middle. */
export function spriteScale(weightPct: number | null, spacing: number): number {
  const cap = (spacing * 0.8) / 120;
  const t = weightPct === null || !Number.isFinite(weightPct) ? 0.5 : Math.min(1, Math.max(0, weightPct / 12));
  return cap * (0.78 + 0.22 * t);
}

function rayToCoast(world: World, from: Pt, angle: number): number {
  let d = 0;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  while (d < 700) {
    d += 6;
    if (!isLand(world, { x: from.x + dx * d, y: from.y + dy * d })) return d;
  }
  return d;
}

/** Group holdings into provinces: the heaviest sectors first, the rest folded into "Other sectors". */
export function groupSectors(
  items: readonly PlaceInput[],
  nullName: string = NO_SECTOR_NAME,
): { name: string; unsorted: boolean; ids: string[]; weight: number }[] {
  const by = new Map<string, { ids: string[]; weight: number }>();
  const none: { ids: string[]; weight: number } = { ids: [], weight: 0 };
  for (const it of items) {
    const w = it.weightPct ?? 0;
    if (it.sector === null || it.sector.trim() === "") {
      none.ids.push(it.id);
      none.weight += w;
    } else {
      const g = by.get(it.sector) ?? { ids: [], weight: 0 };
      g.ids.push(it.id);
      g.weight += w;
      by.set(it.sector, g);
    }
  }
  const named = [...by.entries()].map(([name, g]) => ({ name, unsorted: false, ...g })).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  const cap = MAX_PROVINCES - (none.ids.length > 0 ? 1 : 0);
  let out = named;
  if (named.length > cap) {
    const rest = named.slice(cap - 1);
    out = [...named.slice(0, cap - 1), { name: OTHER_SECTORS_NAME, unsorted: false, ids: rest.flatMap((g) => g.ids), weight: rest.reduce((a, g) => a + g.weight, 0) }];
  }
  if (none.ids.length > 0) out = [...out, { name: nullName, unsorted: true, ...none }];
  return out;
}

/** Where a province's name goes: the open land of its cell furthest from every building and from the
 * names already placed. Distances are stretched sideways because a name is wide. */
function labelSpot(world: World, cell: Pt[], anchor: Pt, avoid: readonly Pt[]): Pt {
  let best = anchor;
  let bestScore = -1;
  for (let x = 40; x < WORLD.w - 40; x += 12) {
    for (let y = 40; y < WORLD.h - 40; y += 12) {
      const p = { x, y };
      if (!pointInPolygon(p, world.coast) || coastDistance(world, p) < 26 || !pointInPolygon(p, cell)) continue;
      let near = 999;
      for (const q of avoid) near = Math.min(near, Math.hypot((p.x - q.x) / 1.7, p.y - q.y));
      const score = near + Math.min(coastDistance(world, p), 40) * 0.3 - dist(p, anchor) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
  }
  return best;
}

/**
 * Place the realm on the world. Provinces are wedges round the capital, one per sector; each holding
 * takes the nearest free settlement site in its own province (the heaviest nearest the province's
 * heart), spilling to the nearest free site anywhere when its province is full. If the land is too small
 * the sites are re-cut closer together, never dropped: every holding is placed exactly once.
 */
export function placeRealm(items: readonly PlaceInput[], nullName: string = NO_SECTOR_NAME): Realm {
  const world = buildWorld();
  const groups = groupSectors(items, nullName);
  const K = Math.max(1, groups.length);

  // Wedge anchors round the capital, with a stable start angle.
  const anchors: Pt[] = Array.from({ length: K }, (_, k) => {
    const a = -Math.PI / 2 + ((k + 0.5) / K) * Math.PI * 2 + 0.35;
    const reach = rayToCoast(world, CAPITAL, a);
    const d = K === 1 ? 0 : reach * 0.58;
    return { x: CAPITAL.x + Math.cos(a) * d, y: CAPITAL.y + Math.sin(a) * d };
  });
  // The heaviest sector takes the anchor nearest the capital (richest in sites), the unsorted one the farthest.
  const order = anchors.map((p, i) => ({ i, d: dist(p, CAPITAL) })).sort((a, b) => a.d - b.d).map((o) => o.i);
  const sectorOrder = groups.map((g, i) => ({ g, i })).sort((a, b) => (a.g.unsorted === b.g.unsorted ? a.i - b.i : a.g.unsorted ? 1 : -1));
  const anchorOf = new Map<number, Pt>();
  sectorOrder.forEach((s, rank) => anchorOf.set(s.i, anchors[order[rank]]));
  const finalAnchors = groups.map((_, i) => anchorOf.get(i) as Pt);
  const cells = K === 1 ? [[{ x: -400, y: -400 }, { x: WORLD.w + 400, y: -400 }, { x: WORLD.w + 400, y: WORLD.h + 400 }, { x: -400, y: WORLD.h + 400 }]] : voronoiCells(finalAnchors);

  // Sites, re-cut closer if the land is too small.
  let sites = world.sites;
  let spacing = world.spacing;
  while (sites.length < items.length && spacing > 40) {
    spacing -= 8;
    sites = poissonSites(world, spacing, WORLD_SEED, [CAPITAL]);
  }
  const used = new Set<number>();
  const placed = new Map<string, Settlement>();
  const byWeight = (a: PlaceInput, b: PlaceInput) => (b.weightPct ?? -1) - (a.weightPct ?? -1) || a.id.localeCompare(b.id);
  const inputOf = new Map(items.map((i) => [i.id, i]));

  const provinces: Province[] = [];
  const takeFor = (g: (typeof groups)[number], gi: number) => {
    const anchor = finalAnchors[gi];
    const cell = cells[gi];
    const members = g.ids.map((id) => inputOf.get(id) as PlaceInput).sort(byWeight);
    for (const m of members) {
      let best = -1;
      let bestInCell = -1;
      sites.forEach((s, si) => {
        if (used.has(si)) return;
        const d = dist(s, anchor);
        if (pointInPolygon(s, cell) && (bestInCell < 0 || d < dist(sites[bestInCell], anchor))) bestInCell = si;
        if (best < 0 || d < dist(sites[best], anchor)) best = si;
      });
      const pick = bestInCell >= 0 ? bestInCell : best;
      if (pick < 0) continue;
      used.add(pick);
      placed.set(m.id, { id: m.id, x: r1(sites[pick].x), y: r1(sites[pick].y), scale: r1(spriteScale(m.weightPct, spacing) * 1000) / 1000, province: gi });
    }
  };
  // Heavier provinces choose first, so a light one never takes the best sites.
  groups
    .map((g, gi) => ({ g, gi }))
    .sort((a, b) => b.g.weight - a.g.weight)
    .forEach(({ g, gi }) => takeFor(g, gi));

  const settlements = items.map((i) => placed.get(i.id)).filter((s): s is Settlement => !!s);
  const avoidPts: Pt[] = [CAPITAL as Pt, ...settlements, ...settlements.map((q) => ({ x: q.x, y: q.y + 20 }))];
  groups.forEach((g, gi) => {
    const label = labelSpot(world, cells[gi], finalAnchors[gi], avoidPts);
    avoidPts.push(label, { x: label.x - 50, y: label.y }, { x: label.x + 50, y: label.y });
    provinces.push({
      index: gi,
      name: g.name,
      unsorted: g.unsorted,
      cell: cells[gi],
      path: `${cells[gi].map((p, k) => `${k === 0 ? "M" : "L"}${r1(p.x)} ${r1(p.y)}`).join(" ")} Z`,
      label,
      anchor: finalAnchors[gi],
      towerIds: g.ids,
    });
  });

  // Roads: a minimum spanning tree from the capital through every settlement. Decoration only.
  const nodes: Pt[] = [CAPITAL, ...settlements];
  const inTree = new Set<number>([0]);
  const roads: string[] = [];
  while (inTree.size < nodes.length) {
    let bi = -1;
    let bj = -1;
    let bd = Infinity;
    inTree.forEach((i) => {
      nodes.forEach((n, j) => {
        if (inTree.has(j)) return;
        const d = dist(nodes[i], n);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      });
    });
    if (bj < 0) break;
    inTree.add(bj);
    const a = nodes[bi];
    const b = nodes[bj];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const bend = ((hashString(`${bi}-${bj}`) % 21) - 10) * 1.4;
    const nx = -(b.y - a.y) / (bd || 1);
    const ny = (b.x - a.x) / (bd || 1);
    roads.push(`M${r1(a.x)} ${r1(a.y)} Q${r1(mx + nx * bend)} ${r1(my + ny * bend)} ${r1(b.x)} ${r1(b.y)}`);
  }

  // Keep scenery clear of the buildings (a roof is not a forest).
  const clear = (g: Glyph) => [CAPITAL as Pt, ...settlements].every((p) => dist(p, g) > 46);
  return {
    settlements,
    provinces,
    keep: { x: CAPITAL.x, y: CAPITAL.y },
    roads,
    mountains: world.mountains.filter(clear),
    forests: world.forests.filter(clear),
    hills: world.hills.filter(clear),
    rivers: world.rivers,
  };
}

// --- Camera --------------------------------------------------------------------------------------------

export interface View {
  cx: number;
  cy: number;
  /** Zoom on top of the fit scale. 1 shows the whole world. */
  z: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4.5;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Pixels per world unit when the whole world just fits the box. */
export function fitScale(cw: number, ch: number): number {
  return Math.min(cw / WORLD.w, ch / WORLD.h);
}

export function clampView(v: View): View {
  return { cx: clamp(v.cx, 0, WORLD.w), cy: clamp(v.cy, 0, WORLD.h), z: clamp(v.z, MIN_ZOOM, MAX_ZOOM) };
}

/** The world rectangle on screen for a view in a box. */
export function viewBox(v: View, cw: number, ch: number): { x: number; y: number; w: number; h: number; s: number } {
  const s = fitScale(cw, ch) * v.z;
  const w = cw / s;
  const h = ch / s;
  return { x: v.cx - w / 2, y: v.cy - h / 2, w, h, s };
}

export function toScreen(p: Pt, v: View, cw: number, ch: number): Pt {
  const b = viewBox(v, cw, ch);
  return { x: (p.x - b.x) * b.s, y: (p.y - b.y) * b.s };
}

export function toWorld(sp: Pt, v: View, cw: number, ch: number): Pt {
  const b = viewBox(v, cw, ch);
  return { x: sp.x / b.s + b.x, y: sp.y / b.s + b.y };
}

/** Zoom by `factor`, keeping the world point under the screen point `at` where it is. */
export function zoomAt(v: View, factor: number, at: Pt, cw: number, ch: number): View {
  const before = toWorld(at, v, cw, ch);
  const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
  const s = fitScale(cw, ch) * z;
  return clampView({ z, cx: before.x - (at.x - cw / 2) / s, cy: before.y - (at.y - ch / 2) / s });
}

/** Move the camera by a screen-space drag. */
export function panBy(v: View, dxPx: number, dyPx: number, cw: number, ch: number): View {
  const s = fitScale(cw, ch) * v.z;
  return clampView({ ...v, cx: v.cx - dxPx / s, cy: v.cy - dyPx / s });
}

/** The view that shows a point, if it is not already comfortably on screen. */
export function ensureVisible(v: View, p: Pt, cw: number, ch: number, margin = 0.14): View {
  const sp = toScreen(p, v, cw, ch);
  const inside = sp.x > cw * margin && sp.x < cw * (1 - margin) && sp.y > ch * margin && sp.y < ch * (1 - margin);
  return inside ? v : clampView({ ...v, cx: p.x, cy: p.y });
}

export function initialView(cw: number): View {
  return cw < 640 ? { cx: CAPITAL.x, cy: CAPITAL.y, z: 2 } : { cx: WORLD.w / 2, cy: WORLD.h / 2, z: 1 };
}

// --- Keyboard: one tab stop, arrows move to the nearest tower in that direction ---------------------

export type DirKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function isDirKey(k: string): k is DirKey {
  return k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown";
}

/** Index of the nearest point lying in the direction of the key (within a 60 degree cone, widening to
 * any point in that half plane if the cone is empty); stays put when nothing lies that way. */
export function nearestInDirection(from: number, key: DirKey, pts: readonly Pt[]): number {
  const o = pts[from];
  const dir = key === "ArrowLeft" ? { x: -1, y: 0 } : key === "ArrowRight" ? { x: 1, y: 0 } : key === "ArrowUp" ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const pick = (minCos: number) => {
    let best = -1;
    let bd = Infinity;
    pts.forEach((p, i) => {
      if (i === from) return;
      const d = dist(o, p);
      if (d === 0) return;
      const cos = ((p.x - o.x) * dir.x + (p.y - o.y) * dir.y) / d;
      if (cos >= minCos && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  const cone = pick(0.5);
  if (cone >= 0) return cone;
  const half = pick(0.05);
  return half >= 0 ? half : from;
}

// --- Labels: show as many names as fit, heaviest first --------------------------------------------

export interface LabelBox {
  id: string;
  /** Screen position of the label's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function labelWidth(text: string): number {
  return Math.round(text.length * 6.4 + 14);
}

/** Choose which names to print: pinned ones always, then the rest heaviest first, each only if it does
 * not cover a name already printed. `anchors` are the screen points the labels hang below. */
export function chooseLabels(
  items: readonly { id: string; text: string; sx: number; sy: number; weight: number }[],
  pinned: ReadonlySet<string>,
  cw: number,
  ch: number,
  offsetY: number,
): LabelBox[] {
  const boxes: LabelBox[] = [];
  const mk = (it: (typeof items)[number]): LabelBox => {
    const w = labelWidth(it.text);
    return { id: it.id, x: it.sx - w / 2, y: it.sy + offsetY, w, h: 17 };
  };
  const hit = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const sorted = [...items].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)) || b.weight - a.weight || a.id.localeCompare(b.id));
  for (const it of sorted) {
    const box = mk(it);
    const onScreen = box.x + box.w > 0 && box.x < cw && box.y + box.h > 0 && box.y < ch;
    if (!onScreen && !pinned.has(it.id)) continue;
    if (pinned.has(it.id) || !boxes.some((b) => hit(b, box))) boxes.push(box);
  }
  return boxes;
}
