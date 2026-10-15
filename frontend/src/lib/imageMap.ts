/**
 * The Cartographer's map drawn on the painted Stitch picture (prototype, behind `?map=image`).
 *
 * The picture (assets/map/map-base.webp) is fixed land: 13 named regions, a small island for the Great
 * Keep and a dashed islet for holdings with no sector. Land carries no data. What the map says still
 * comes from the realm, exactly as in worldMap.ts:
 *
 *  - one settlement per holding, drawn in its sector's region; size follows weight (bounded);
 *  - a sector is always the same region (fixed table below, never decided by weight), so the map
 *    does not move when the book changes;
 *  - holdings with no sector sit on the dashed islet, named as such, and are never folded into a sector;
 *  - sectors that match none of the twelve go to the "Other sectors" region;
 *  - a holding is never drawn in a region other than its own: when a region is crowded the pictures
 *    shrink and sit closer (never spill into a neighbour).
 *
 * Pure functions only: no React, no randomness. The output is a worldMap `Realm`, so the map component
 * and the legend work unchanged. World units are the old 1000 x 720; the picture is fitted to the width.
 */
import { IMAGE_REGIONS, IMAGE_SIZE } from "./imageMapRegions";
import { NO_SECTOR_NAME, WORLD, pointInPolygon, provinceLines, spriteScale, type PlaceInput, type Province, type Pt, type Realm, type Settlement } from "./worldMap";

export type RegionId = "W1" | "W2" | "W3" | "W4" | "W5" | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8" | "ISLET";

/** The picture fitted to the world's width, centred in its height. */
export const IMAGE_K = WORLD.w / IMAGE_SIZE.w;
export const IMAGE_OFFSET_Y = (WORLD.h - IMAGE_SIZE.h * IMAGE_K) / 2;
export const IMAGE_RECT = { x: 0, y: IMAGE_OFFSET_Y, width: WORLD.w, height: IMAGE_SIZE.h * IMAGE_K } as const;

export function imageToWorld(p: Pt): Pt {
  return { x: p.x * IMAGE_K, y: p.y * IMAGE_K + IMAGE_OFFSET_Y };
}

/** Where the Great Keep stands: the small island in the strait. */
export const KEEP_AT: Pt = imageToWorld({ x: 689, y: 373 });

/** Region -> sector name, fixed (assignment agreed 2026-10-15; docs/game/map-image-prototype-2026-10-15.md). */
export const REGION_NAME: Record<Exclude<RegionId, "ISLET">, string> = {
  W1: "Industrials",
  W2: "Energy",
  W3: "Consumer Staples",
  W4: "Consumer Discretionary",
  W5: "Materials",
  E1: "Real Estate",
  E2: "Information Technology",
  E3: "Health Care",
  E4: "Financials",
  E5: "Communication Services",
  E6: "Utilities",
  E7: "Diversified Fund",
  E8: "Other sectors",
};

/** Loose sector wording (the app's own, Yahoo-style and GICS-style) -> region. Order matters: the first match wins. */
const SECTOR_RULES: ReadonlyArray<readonly [RegExp, RegionId]> = [
  [/real\s*estate|reit|propert/, "E1"],
  [/utilit/, "E6"],
  [/communic|telecom|media|entertain/, "E5"],
  [/health|pharma|biotech|medic/, "E3"],
  [/fund|etf|diversif|index/, "E7"],
  [/financ|bank|insur/, "E4"],
  [/technolog|software|semicond|information/, "E2"],
  [/staple|defensive|food|bever|agri|seafood|aquacult/, "W3"],
  [/industrial|aerospace|defen[cs]e|transport|machiner/, "W1"],
  [/discretion|cyclical|retail|auto|leisure|consumer/, "W4"],
  [/energy|oil|gas|petrol/, "W2"],
  [/material|mining|metal|gold|chemic|steel/, "W5"],
];

/** The region a sector lives in. No sector at all is the dashed islet; a sector that matches none is "Other sectors". */
export function regionForSector(sector: string | null | undefined): RegionId {
  const s = (sector ?? "").trim().toLowerCase();
  if (s === "") return "ISLET";
  for (const [re, id] of SECTOR_RULES) if (re.test(s)) return id;
  return "E8";
}

const polyOf = (id: string): Pt[] => {
  const flat = IMAGE_REGIONS[id]?.poly ?? [];
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]!, y: flat[i + 1]! });
  return out;
};

/** A region's outline in world units. */
export function regionCell(id: RegionId): Pt[] {
  return polyOf(id).map(imageToWorld);
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Candidate sites for a region, in picture pixels: inside and clear of the border. */
const candidateCache = new Map<string, Pt[]>();
function candidates(id: RegionId): Pt[] {
  const hit = candidateCache.get(id);
  if (hit) return hit;
  const poly = polyOf(id);
  const pole = IMAGE_REGIONS[id]?.pole ?? [0, 0];
  const margin = id === "ISLET" ? 9 : 13;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const out: Pt[] = [];
  for (let y = Math.ceil(y0); y <= y1; y += 5) {
    for (let x = Math.ceil(x0); x <= x1; x += 5) {
      const p = { x, y };
      if (!pointInPolygon(p, poly)) continue;
      let near = Infinity;
      for (let i = 0; i < poly.length; i++) near = Math.min(near, segDist(p, poly[i]!, poly[(i + 1) % poly.length]!));
      if (near >= margin) out.push(p);
    }
  }
  if (out.length === 0) out.push({ x: pole[0], y: pole[1] });
  candidateCache.set(id, out);
  return out;
}

/** n sites inside a region, as spread out as a greedy farthest-point pick makes them; first = nearest the heart. */
export function regionSites(id: RegionId, n: number): { sites: Pt[]; spacing: number } {
  const cand = candidates(id);
  const pole = IMAGE_REGIONS[id]?.pole ?? [0, 0];
  const picked: Pt[] = [];
  const first = cand.reduce((b, c) => (Math.hypot(c.x - pole[0], c.y - pole[1]) < Math.hypot(b.x - pole[0], b.y - pole[1]) ? c : b), cand[0]!);
  picked.push(first);
  const minD = cand.map((c) => Math.hypot(c.x - first.x, c.y - first.y));
  while (picked.length < n) {
    let bi = 0;
    for (let i = 1; i < cand.length; i++) if (minD[i]! > minD[bi]!) bi = i;
    const p = cand[bi]!;
    picked.push(p);
    for (let i = 0; i < cand.length; i++) minD[i] = Math.min(minD[i]!, Math.hypot(cand[i]!.x - p.x, cand[i]!.y - p.y));
  }
  let spacing = Infinity;
  for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) spacing = Math.min(spacing, Math.hypot(picked[i]!.x - picked[j]!.x, picked[i]!.y - picked[j]!.y));
  return { sites: picked, spacing: Number.isFinite(spacing) ? spacing : 118 };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Spacing the pictures are drawn for, in world units: a lone holding is not drawn bigger than a region can carry. */
export const SPACING_MAX = 62;
export const SPACING_MIN = 36;
/** A settlement stands on its base line; its picture is about this tall (times the scale), centred on the site. */
export const SPRITE_H = 106;
export const SPRITE_W = 80;
/** The site is the middle of the picture, so the base line is this far below it (times the scale). */
export const BASE_DY = 48;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Where a region's name goes: the spot (inside the region) that overlaps the pictures least, nearest the heart. */
function nameSpot(id: RegionId, cell: Pt[], sprites: Box[], halfW: number, halfH: number): Pt {
  const pole = imageToWorld({ x: IMAGE_REGIONS[id]?.pole[0] ?? 0, y: IMAGE_REGIONS[id]?.pole[1] ?? 0 });
  let best = pole;
  let bestScore = Infinity;
  for (const c of candidates(id)) {
    const p = imageToWorld(c);
    const box = { x0: p.x - halfW, y0: p.y - halfH, x1: p.x + halfW, y1: p.y + halfH };
    const outside = [
      { x: box.x0, y: box.y0 },
      { x: box.x1, y: box.y0 },
      { x: box.x0, y: box.y1 },
      { x: box.x1, y: box.y1 },
    ].filter((q) => !pointInPolygon(q, cell)).length;
    const score = sprites.reduce((a, b) => a + overlap(box, b), 0) * 10 + outside * 1e5 + Math.hypot(p.x - pole.x, p.y - pole.y) * 0.01;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** The name's font size (world units): 12, smaller when the longest line would not fit across the region. */
function nameSize(lines: string[], cell: Pt[]): number {
  const xs = cell.map((p) => p.x);
  const width = Math.max(...xs) - Math.min(...xs);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  return Math.round(Math.max(8, Math.min(12, (0.8 * width) / (longest * 0.95))) * 10) / 10;
}
const byWeight = (a: PlaceInput, b: PlaceInput) => (b.weightPct ?? -1) - (a.weightPct ?? -1) || a.id.localeCompare(b.id);

/** Place the realm on the picture. Same output shape as `placeRealm`, so the map and its legend work unchanged. */
export function placeImageRealm(items: readonly PlaceInput[], nullName: string = NO_SECTOR_NAME): Realm {
  const groups = new Map<RegionId, PlaceInput[]>();
  for (const it of items) {
    const id = regionForSector(it.sector);
    groups.set(id, [...(groups.get(id) ?? []), it]);
  }
  const weightOf = (m: PlaceInput[]) => m.reduce((a, i) => a + (i.weightPct ?? 0), 0);
  const order = [...groups.entries()].sort(([ai, am], [bi, bm]) => (ai === "ISLET" ? 1 : 0) - (bi === "ISLET" ? 1 : 0) || weightOf(bm) - weightOf(am) || ai.localeCompare(bi));

  const settlements: Settlement[] = [];
  const provinces: Province[] = [];
  order.forEach(([id, members], gi) => {
    const sorted = [...members].sort(byWeight);
    const { sites, spacing } = regionSites(id, sorted.length);
    const spacingWorld = Math.min(SPACING_MAX, Math.max(SPACING_MIN, spacing * IMAGE_K));
    const mine: Settlement[] = sorted.map((m, k) => {
      const w = imageToWorld(sites[k]!);
      const scale = Math.round(spriteScale(m.weightPct, spacingWorld) * 1000) / 1000;
      return { id: m.id, x: r1(w.x), y: r1(w.y + BASE_DY * scale), scale, province: gi };
    });
    settlements.push(...mine);
    const cell = regionCell(id);
    const name = id === "ISLET" ? nullName : REGION_NAME[id];
    const lines = provinceLines(name);
    const fs = nameSize(lines, cell);
    const sprites = mine.map((st) => ({ x0: st.x - (SPRITE_W / 2) * st.scale, x1: st.x + (SPRITE_W / 2) * st.scale, y0: st.y - SPRITE_H * st.scale, y1: st.y + 14 }));
    const halfW = (Math.max(...lines.map((l) => l.length)) * fs * 0.78) / 2;
    const halfH = (lines.length * fs * 1.1) / 2;
    const heart = nameSpot(id, cell, sprites, halfW, halfH);
    provinces.push({
      index: gi,
      name,
      unsorted: id === "ISLET",
      cell,
      path: `${cell.map((p, i) => `${i === 0 ? "M" : "L"}${r1(p.x)} ${r1(p.y)}`).join(" ")} Z`,
      label: heart,
      labelFs: fs,
      anchor: heart,
      towerIds: sorted.map((m) => m.id),
      weightPct: weightOf(members),
      weightComplete: members.every((m) => m.weightPct !== null),
    });
  });
  const byInput = new Map(settlements.map((s) => [s.id, s]));
  return { settlements: items.map((i) => byInput.get(i.id)).filter((s): s is Settlement => !!s), provinces, keep: KEEP_AT, roads: [], mountains: [], forests: [], hills: [], rivers: [] };
}

/** The painted map is the default; `?map=classic` on the Map tab's address brings the old drawn one back. */
export function imageMapEnabled(search: string): boolean {
  return new URLSearchParams(search).get("map") !== "classic";
}
