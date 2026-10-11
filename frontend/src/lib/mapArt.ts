import { TOWER_BOX } from "./realmMap";
import { OBJECT_ART, type ObjectArt, type ObjectArtId } from "./stitchArt";
import type { FortressSize, FortressStructure } from "./types";
import { CAPITAL, dist, type Glyph, type Pt, type World } from "./worldMap";

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
