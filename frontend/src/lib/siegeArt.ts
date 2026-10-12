import { damageWidth } from "./siege";
import { siegeCamp } from "./fortress";
import { siegeCampSprites, type SpriteRect } from "./sceneArt";
import { OBJECT_ART } from "./stitchArt";
import { placeTowerArt, towerArtId, type TowerArtPlacement } from "./towerArt";
import type { FortressSiegeLevel, FortressSize, SiegeSimHolding } from "./types";

/**
 * The Siege Simulator's towers as pictures (Design Master Sprint 14). Pure placement, no React.
 * The picture carries no fact: which tower, how big, how much of the wall is lost, which towers are not
 * modelled and how big the besieging camp is are all decided by code from the backend's numbers and drawn
 * over or around the picture. Damage is read from shape (a dark scorched band that rises with the loss,
 * and cracks that grow with it), never from colour alone.
 */

/** Most towers drawn; the page says when there are more (the backend sorts worst-hit first). */
export const MAX_TOWERS = 18;
/** Width of one tower slot, scene px. */
export const SLOT_W = 64;
export const SIDE_PAD = 28;
/** Minimum scene width; the camp's tents and engines are laid out inside it. */
export const MIN_SCENE_W = 960;
export const GROUND_Y = 246;
/** Where the camp stands: on the far hill crest behind the towers. */
export const CAMP_Y = GROUND_Y - 44;
export const SCENE_H = 316;
/** Distance from the ground line down to the tower labels. */
export const LABEL_DY = 46;
/** Towers grow up to this much on a roomy strip and shrink on a crowded one. */
const MAX_SCALE = 1.5;
const MIN_SCALE = 0.85;

const BOX: Record<FortressSize, { w: number; h: number }> = {
  great: { w: 50, h: 92 },
  medium: { w: 46, h: 78 },
  small: { w: 40, h: 62 },
  tiny: { w: 34, h: 50 },
  unknown: { w: 38, h: 56 },
};

export function sceneWidth(count: number): number {
  return Math.max(MIN_SCENE_W, SIDE_PAD * 2 + Math.min(count, MAX_TOWERS) * SLOT_W);
}

export interface SiegeTowerArt {
  holdingId: string;
  placement: TowerArtPlacement | null;
  /** Slot centre x and the label's text. */
  cx: number;
  /** Share (0-100) of the wall lost, 0 for a gain or a tower that is not modelled. */
  damagePct: number;
  /** Height of the scorched band in scene px, measured from the foot of the wall. */
  scorchPx: number;
  /** Cracks to draw: 0 when untouched, up to 3 as the loss deepens. Shape, not colour, says "hurt". */
  cracks: number;
  /** Exposure is the backend's "wall at risk of breach": drawn as a broken hole (shape, not colour). */
  breach: boolean;
  /** Picture scale against the base size, so rubble, cracks and arrows scale with the tower. */
  scale: number;
  modelled: boolean;
}

/** How many cracks a loss earns: none below 10%, then one per 20% up to three. */
export function crackCount(damagePct: number): number {
  if (damagePct < 10) return 0;
  return Math.min(3, 1 + Math.floor((damagePct - 10) / 20));
}

export function siegeTowers(rows: SiegeSimHolding[], sceneW: number = sceneWidth(rows.length)): SiegeTowerArt[] {
  const shown = rows.slice(0, MAX_TOWERS);
  const span = sceneW - SIDE_PAD * 2;
  const slot = shown.length > 0 ? span / shown.length : SLOT_W;
  return shown.map((h, i) => {
    const cx = SIDE_PAD + slot * i + slot / 2;
    const id = towerArtId(h);
    const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, slot / 64));
    const base = BOX[h.size_class];
    const box = { w: base.w * k, h: base.h * k };
    const placement = id && OBJECT_ART[id] ? placeTowerArt(id, { x: cx - box.w / 2, y: GROUND_Y, w: box.w, h: box.h }) : null;
    const damagePct = h.modelled ? damageWidth(h.shock_pct) : 0;
    const body = placement?.body;
    const wallH = body ? placement.ground - body.top : 0;
    return {
      holdingId: h.holding_id,
      placement,
      cx,
      damagePct,
      scorchPx: Math.round((damagePct / 100) * wallH),
      cracks: crackCount(damagePct),
      breach: h.modelled && h.exposure === "breach_risk",
      scale: k,
      modelled: h.modelled,
    };
  });
}

/** Small deterministic pseudo-random in [0, 1): the same tower always breaks the same way. */
export function rand(seed: number, i: number): number {
  let h = Math.imul(seed + 1, 2654435761) ^ Math.imul(i + 7, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface CrackShape {
  /** The fissure itself, and a branch off it. */
  main: string;
  branch: string;
  /** The same fissure shifted by a pixel: the pale chiselled edge beside it. */
  edge: string;
}

/**
 * One crack in the stone, in scene px: an irregular fissure that starts inside the scorched band and runs
 * part of the way down, with one short branch. Deterministic from the tower's index and the crack number.
 */
export function crackShape(body: { x: number; w: number }, topY: number, footY: number, seed: number, n: number): CrackShape {
  const band = Math.max(8, footY - topY);
  const x0 = body.x + body.w * (0.2 + 0.6 * rand(seed, n * 5 + 1));
  const y0 = topY + band * (0.05 + 0.2 * rand(seed, n * 5 + 2));
  const len = band * (0.4 + 0.35 * rand(seed, n * 5 + 3));
  const steps = 5;
  const pts: [number, number][] = [[x0, y0]];
  let x = x0;
  for (let i = 1; i <= steps; i += 1) {
    x += (rand(seed, n * 31 + i) - 0.5) * body.w * 0.22;
    x = Math.min(body.x + body.w * 0.92, Math.max(body.x + body.w * 0.08, x));
    pts.push([x, y0 + (len * i) / steps + (rand(seed, n * 17 + i) - 0.5) * 2]);
  }
  const path = (shift: number) => pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${(px + shift).toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const [bx, by] = pts[2];
  const dir = rand(seed, n * 9 + 4) < 0.5 ? -1 : 1;
  const branch = `M${bx.toFixed(1)} ${by.toFixed(1)} L${(bx + dir * body.w * 0.14).toFixed(1)} ${(by + len * 0.16).toFixed(1)} L${(bx + dir * body.w * 0.1).toFixed(1)} ${(by + len * 0.3).toFixed(1)}`;
  return { main: path(0), branch, edge: path(0.9) };
}

/** Stones fallen at the foot of a wall: none under 10% lost, then three and one more per 10%, at most 12. */
export function rubbleCount(damagePct: number): number {
  if (damagePct < 10) return 0;
  return Math.min(12, 3 + Math.floor(damagePct / 10));
}

export interface Stone {
  points: string;
  tone: 0 | 1 | 2;
}

/** The fallen stones as small polygons around the foot of the tower (scene px), sized with the tower. */
export function rubbleStones(body: { x: number; w: number }, footY: number, damagePct: number, seed: number, scale: number): Stone[] {
  const out: Stone[] = [];
  const n = rubbleCount(damagePct);
  for (let i = 0; i < n; i += 1) {
    const cx = body.x + body.w * (-0.18 + 1.36 * rand(seed, i * 3 + 1));
    const r = (2.2 + 3.2 * rand(seed, i * 3 + 2)) * Math.max(0.9, scale * 0.9);
    const cy = footY - r * 0.4 + 1 + 3 * rand(seed, i * 3 + 3);
    const pts = [
      [cx - r, cy],
      [cx - r * 0.55, cy - r * 0.95],
      [cx + r * 0.5, cy - r],
      [cx + r, cy - r * 0.1],
      [cx + r * 0.7, cy + r * 0.35],
      [cx - r * 0.6, cy + r * 0.4],
    ];
    out.push({ points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "), tone: (i % 3) as 0 | 1 | 2 });
  }
  return out;
}

/** A ragged hole knocked through the wall: where it is, drawn as a jagged polygon (scene px). */
export function breachHole(body: { x: number; w: number }, topY: number, footY: number, seed: number): { points: string; cx: number; cy: number; r: number } {
  const band = Math.max(8, footY - topY);
  const cx = body.x + body.w * (0.35 + 0.3 * rand(seed, 91));
  const cy = footY - band * 0.52;
  const r = Math.min(body.w * 0.24, band * 0.3);
  const verts = 12;
  const pts: string[] = [];
  for (let i = 0; i < verts; i += 1) {
    const a = (Math.PI * 2 * i) / verts;
    // Alternate near and far points, with noise, so the edge reads as broken stone rather than a round hole.
    const j = (i % 2 === 0 ? 1.05 : 0.6) + 0.3 * rand(seed, 100 + i);
    pts.push(`${(cx + Math.cos(a) * r * j * 0.9).toFixed(1)},${(cy + Math.sin(a) * r * j * 1.1).toFixed(1)}`);
  }
  return { points: pts.join(" "), cx, cy, r };
}

/** Fire arrows stuck in the wall: one from 25% lost, two from 45%. Hit point, in scene px, and rotation. */
export function arrowHits(
  body: { x: number; w: number },
  topY: number,
  footY: number,
  damagePct: number,
  seed: number,
): { x: number; y: number; rotate: number }[] {
  const n = damagePct >= 45 ? 2 : damagePct >= 25 ? 1 : 0;
  const band = Math.max(8, footY - topY);
  return Array.from({ length: n }, (_, i) => ({
    x: body.x + body.w * (0.25 + 0.5 * rand(seed, 200 + i)),
    y: topY + band * (0.15 + 0.5 * rand(seed, 210 + i)),
    rotate: 165 + 30 * rand(seed, 220 + i),
  }));
}

/**
 * The besieging camp for the strip: exactly the Fortress's own camp for the same siege level (`siegeCamp`),
 * so calm and unsurveyed draw no enemy and the picture never adds or removes one. No fire arrows: their
 * targets are fixed to the Fortress scene.
 */
export function siegeStripCamp(level: FortressSiegeLevel | null | undefined): SpriteRect[] {
  return siegeCampSprites(siegeCamp(level), CAMP_Y);
}

/** Rampart tiles along the foot of the towers: the wall picture repeated across the scene. */
export function rampartTiles(sceneW: number, height = 30): { left: number; width: number; top: number; height: number }[] {
  const art = OBJECT_ART["wall-segment"];
  const width = (height * art.width) / art.height;
  const out: { left: number; width: number; top: number; height: number }[] = [];
  for (let x = 0; x < sceneW; x += width) out.push({ left: x, width, top: GROUND_Y - 2, height });
  return out;
}
