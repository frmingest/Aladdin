import { TOWER_BOX } from "./realmMap";
import { OBJECT_ART, type ObjectArt, type ObjectArtId } from "./stitchArt";
import type { FortressSize, FortressStructure } from "./types";
import { CAPITAL, PROV_CHAR_EM, WORLD, dist, isLand, pointInPolygon, provinceLines, type Glyph, type Pt, type Realm, type World } from "./worldMap";

/**
 * The Cartographer's map as pictures (Design Master Sprint 4). Pure placement
 * and choice, no React. The land stays scenery and the picture carries NO fact:
 * what a settlement stands for is already decided by the holding (structure and
 * size class, as on the Fortress), and the five survey patches are still drawn
 * by code over the picture, so an unknown fact stays fog.
 *
 * Decision 5 (2026-10-11): a stock is a town, or a citadel when it is a great
 * (heavy) position; a fund is the outpost, gold the vault, cash or bonds the
 * granary. The port and the island sanctuary are scenery, not holdings.
 */

export type SettlementKind = { structure: FortressStructure; size_class: FortressSize };

/** Gold store pictures by size class, as on the Fortress (a fuller hoard for a bigger holding). */
const VAULT_BY_SIZE: Record<FortressSize, ObjectArtId> = {
  great: "vault-3",
  medium: "vault-2",
  small: "vault-1",
  tiny: "vault-1",
  unknown: "vault-1",
};

/** The picture for a settlement. Never null: a map settlement has no "unsurveyed" body, since the
 * survey is drawn on top as fog. Unknown size is not heavy, so it is a plain town. */
export function settlementArtId(k: SettlementKind): ObjectArtId {
  switch (k.structure satisfies FortressStructure) {
    case "outpost":
      return "outpost";
    case "granary":
      return "granary";
    case "bullion":
      return VAULT_BY_SIZE[k.size_class];
    case "keep":
      return k.size_class === "great" ? "map-citadel" : "map-town";
  }
}

export interface ArtRect {
  id: ObjectArtId;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The biggest a settlement picture may be, in the tower figure's own units (the figure is 120 wide;
 * its box is TOWER_BOX). A little wider than the old tower so a town reads as a town. */
export const SETTLEMENT_MAX = { w: 80, h: 88 } as const;

/**
 * A settlement picture inside the tower figure's coordinates: fitted to SETTLEMENT_MAX, centred on the
 * old tower box and standing on its bottom edge. The survey patches use the same box, so they land where
 * they always did.
 */
export function placeSettlementArt(id: ObjectArtId, art: ObjectArt = OBJECT_ART[id]): ArtRect {
  const k = Math.min(SETTLEMENT_MAX.w / art.width, SETTLEMENT_MAX.h / art.height);
  const width = art.width * k;
  const height = art.height * k;
  const cx = TOWER_BOX.x + TOWER_BOX.w / 2;
  return { id, src: art.src, x: cx - width / 2, y: TOWER_BOX.y + TOWER_BOX.h - height, width, height };
}

/** Height of the Great Keep picture on the map, in world units. */
export const MAP_KEEP_H = 78;

/** The Great Keep at the capital: centred on it, standing on its ground. */
export function placeMapKeep(at: Pt = CAPITAL, art: ObjectArt = OBJECT_ART["keep-granite"]): ArtRect {
  const width = (MAP_KEEP_H * art.width) / art.height;
  return { id: "keep-granite", src: art.src, x: at.x - width / 2, y: at.y + 6 - MAP_KEEP_H, width, height: MAP_KEEP_H };
}

/** A picture of height h standing with its bottom centre on (x, y). */
export function propOnGround(id: ObjectArtId, x: number, y: number, h: number): ArtRect {
  const art = OBJECT_ART[id];
  const width = (h * art.width) / art.height;
  return { id, src: art.src, x: x - width / 2, y: y - h, width, height: h };
}

/** Scenery heights in world units. A settlement is about 45 tall, so every prop is smaller. */
const PINES_H = 20;
const ROCKS_H = 11;
const PALM_H = 24;
const SHIP_H = 26;
const MOUNTAIN_H = 20;
const HILL_H = 11;
const SERPENT_H = 36;
/** The compass rose picture is round: its diameter in world units (the old drawing was 88 across). */
export const COMPASS_SIZE = 84;
const PORT_H = 40;
const ISLAND_H = 36;

/** One pine clump per forest glyph, sized by the glyph's own scale. */
export function pineRect(g: Glyph): ArtRect {
  return propOnGround("prop-pines", g.x, g.y + 6, PINES_H * g.s);
}

/** Rocks stand for the low hills. */
export function rockRect(g: Glyph): ArtRect {
  return propOnGround("prop-rocks", g.x, g.y + 4, ROCKS_H * g.s);
}

/** Four mountain pictures (two bare, two snow-capped), chosen by the glyph's own random number so the
 * same mountain is always the same picture. Scenery only. */
const MOUNTAIN_IDS = ["map-mountain-bare-a", "map-mountain-bare-b", "map-mountain-snow-a", "map-mountain-snow-b"] as const satisfies readonly ObjectArtId[];

export function mountainArtId(g: Glyph): (typeof MOUNTAIN_IDS)[number] {
  return MOUNTAIN_IDS[Math.min(MOUNTAIN_IDS.length - 1, Math.floor(g.v * MOUNTAIN_IDS.length))]!;
}

export function mountainRect(g: Glyph): ArtRect {
  return propOnGround(mountainArtId(g), g.x, g.y + 7, MOUNTAIN_H * g.s);
}

/** Rocks or a grassy mound for a low hill: the mound for about 60% of them, by the glyph's random number. */
export function hillArtId(g: Glyph): "map-hill" | "prop-rocks" {
  return g.v > 0.4 ? "map-hill" : "prop-rocks";
}

export function hillRect(g: Glyph): ArtRect {
  return hillArtId(g) === "map-hill" ? propOnGround("map-hill", g.x, g.y + 5, HILL_H * g.s) : rockRect(g);
}

/** The sea serpent, its coils on the water at (x, y). */
export function serpentRect(at: Pt): ArtRect {
  return propOnGround("map-serpent", at.x, at.y + 10, SERPENT_H);
}

/** The compass rose, centred on the open-water spot. It carries no letters: the "N" is drawn by code. */
export function compassRect(at: Pt): ArtRect {
  const art = OBJECT_ART["map-compass"];
  const height = (COMPASS_SIZE * art.height) / art.width;
  return { id: "map-compass", src: art.src, x: at.x - COMPASS_SIZE / 2, y: at.y - height / 2, width: COMPASS_SIZE, height };
}

/** A ship afloat with its keel on (0, 0), for the sailing and the resting ship alike. */
export function shipRect(): ArtRect {
  return propOnGround("prop-ship", 0, 4, SHIP_H);
}

function centroid(pts: readonly Pt[]): Pt {
  const n = pts.length || 1;
  return { x: pts.reduce((a, p) => a + p.x, 0) / n, y: pts.reduce((a, p) => a + p.y, 0) / n };
}

export interface Landmarks {
  /** The trading port, on the mainland coast furthest from every settlement. */
  port: ArtRect | null;
  /** The island sanctuary, on the first islet. Scenery, not a holding. */
  island: ArtRect | null;
  /** One palm on each of the other islets. */
  palms: ArtRect[];
}

/**
 * Landmarks and island palms. All scenery: no name, no button, no fog, so none of them can be read as a
 * holding. The port goes to the mainland shore point that keeps the most distance from the capital and
 * every settlement (so it never covers a holding), nudged a few units inland so it stands on the land.
 */
export function placeLandmarks(world: Pick<World, "coast" | "islands">, settlements: readonly Pt[]): Landmarks {
  const others: Pt[] = [CAPITAL, ...settlements];
  let best: Pt | null = null;
  let bestD = -1;
  for (const p of world.coast) {
    const d = others.reduce((m, o) => Math.min(m, dist(p, o)), Infinity);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  let port: ArtRect | null = null;
  if (best) {
    const k = 8 / (dist(best, CAPITAL) || 1);
    const inland = { x: best.x + (CAPITAL.x - best.x) * k, y: best.y + (CAPITAL.y - best.y) * k };
    port = propOnGround("map-port", inland.x, inland.y + 4, PORT_H);
  }
  const [first, ...rest] = world.islands;
  const c0 = first ? centroid(first.pts) : null;
  const island = c0 ? propOnGround("map-island", c0.x, c0.y + 10, ISLAND_H) : null;
  const palms = rest.map((i) => {
    const c = centroid(i.pts);
    return propOnGround("prop-palms", c.x, c.y + 8, PALM_H);
  });
  return { port, island, palms };
}

// --- Sector landmarks (2026-10-14) ----------------------------------------------------------------------
//
// One or more scenery pictures in each sector's province that say what the sector is: a gold mine for
// Materials, a farmhouse for Consumer Staples, a bank vault for Financials and so on. Like the port and
// the island they are scenery: no name, no button, no fog and no state. They repeat the province's own
// label (the sector name already printed on the land) and nothing else, so they never carry a fact that
// the holding's survey, weight or verdict decides. A province with no sector set, an unknown sector, the
// "Other sectors" fold, or a sector with no theme here gets no landmark.

export interface SectorTheme {
  match: RegExp;
  /** Pictures for the sector, most telling first. */
  ids: readonly ObjectArtId[];
}

/** First match wins. Names are matched loosely (case-insensitive), since the sector comes from the user's own data. */
export const SECTOR_THEMES: readonly SectorTheme[] = [
  { match: /diversif|fund|etf/i, ids: ["map-fountain-square"] },
  { match: /energy|oil|petrol|gas\b/i, ids: ["map-windmill", "map-watermill"] },
  { match: /utilit|power|electric/i, ids: ["map-watermill", "map-windmill"] },
  { match: /financ|bank|insur/i, ids: ["map-bank-vault"] },
  { match: /industr|manufactur|transport/i, ids: ["map-factory"] },
  { match: /staple|food|agri|beverage/i, ids: ["map-farmhouse", "map-market-stall"] },
  { match: /discretionary|retail|consumer/i, ids: ["map-market-stall"] },
  { match: /material|mining|metal|gold|commodit/i, ids: ["map-gold-mine", "map-gold-ingots", "map-quarry"] },
];

/** The landmark pictures for a sector name, or none when the sector has no theme. */
export function sectorLandmarkIds(sector: string): readonly ObjectArtId[] {
  return SECTOR_THEMES.find((t) => t.match.test(sector))?.ids ?? [];
}

/** Heights in world units (a settlement is about 45 tall, the keep 78): small enough that a landmark never
 * reads as a holding. Wide, low pictures are drawn shorter so their width stays in proportion. */
const LANDMARK_H: Partial<Record<ObjectArtId, number>> = {
  "map-gold-ingots": 18,
  "map-farmhouse": 27,
  "map-fountain-square": 27,
  "map-quarry": 27,
  "map-market-stall": 29,
};
const LANDMARK_DEFAULT_H = 34;
/** At most this many landmarks in one province. */
export const MAX_LANDMARKS_PER_PROVINCE = 3;

/** Keep-out radii (world units) round things already on the land, measured from a landmark's centre. */
const KEEP_OUT = { capital: 80, settlement: 52, label: 30, landmark: 54 } as const;
const GRID = 12;

export function landmarkRect(id: ObjectArtId, foot: Pt): ArtRect {
  return propOnGround(id, foot.x, foot.y, LANDMARK_H[id] ?? LANDMARK_DEFAULT_H);
}

/**
 * Where each province's landmarks stand. Deterministic: candidates come from a fixed grid over the
 * province, a spot must be on the mainland with a margin to the shore, inside its own province, and clear
 * of the capital, every settlement (and the name under it), every province name and every landmark already
 * placed (`extra`: the port and island pictures). The best spot is the one with the most room, pulled
 * toward the province's heart. A province that has no free spot simply gets fewer landmarks (or none): a
 * holding is never covered.
 */
export function placeSectorLandmarks(world: Pick<World, "coast" | "islands">, realm: Pick<Realm, "provinces" | "settlements">, extra: readonly ArtRect[] = []): ArtRect[] {
  const avoid: { at: Pt; r: number }[] = [{ at: CAPITAL, r: KEEP_OUT.capital }];
  for (const s of realm.settlements) {
    for (const dy of [-22, 0, 16]) avoid.push({ at: { x: s.x, y: s.y + dy }, r: KEEP_OUT.settlement });
  }
  for (const p of realm.provinces) {
    const half = (Math.max(...provinceLines(p.name).map((l) => l.length)) * p.labelFs * PROV_CHAR_EM) / 2;
    for (const dx of [-half, 0, half]) avoid.push({ at: { x: p.label.x + dx, y: p.label.y }, r: KEEP_OUT.label });
  }
  for (const e of extra) avoid.push({ at: { x: e.x + e.width / 2, y: e.y + e.height / 2 }, r: KEEP_OUT.landmark });

  const out: ArtRect[] = [];
  for (const prov of realm.provinces) {
    if (prov.unsorted) continue;
    const ids = sectorLandmarkIds(prov.name).slice(0, MAX_LANDMARKS_PER_PROVINCE);
    const xs = prov.cell.map((p) => p.x);
    const ys = prov.cell.map((p) => p.y);
    const x0 = Math.max(12, Math.min(...xs));
    const x1 = Math.min(WORLD.w - 12, Math.max(...xs));
    const y0 = Math.max(12, Math.min(...ys));
    const y1 = Math.min(WORLD.h - 12, Math.max(...ys));
    for (const id of ids) {
      const h = LANDMARK_H[id] ?? LANDMARK_DEFAULT_H;
      let best: { foot: Pt; score: number } | null = null;
      for (let y = y0; y <= y1; y += GRID) {
        for (let x = x0; x <= x1; x += GRID) {
          const foot = { x, y };
          // Inside this province, on the mainland, with a margin to the shore on every side.
          if (!pointInPolygon(foot, prov.cell)) continue;
          if (![foot, { x: x - 14, y }, { x: x + 14, y }, { x, y: y - 10 }, { x, y: y + 8 }].every((q) => isLand(world, q))) continue;
          const centre = { x, y: y - h / 2 };
          const room = avoid.reduce((m, a) => Math.min(m, dist(centre, a.at) - a.r), Infinity);
          if (room < 0) continue;
          const score = Math.min(room, 30) - 0.12 * dist(foot, prov.anchor);
          if (!best || score > best.score) best = { foot, score };
        }
      }
      if (!best) continue;
      const r = landmarkRect(id, best.foot);
      out.push(r);
      avoid.push({ at: { x: best.foot.x, y: best.foot.y - h / 2 }, r: KEEP_OUT.landmark });
    }
  }
  return out;
}
