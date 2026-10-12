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
      modelled: h.modelled,
    };
  });
}

/**
 * A crack as a zigzag path from the top of the scorched band downward, in scene px. Deterministic from the
 * tower's index and the crack number so a tower never changes its cracks between renders.
 */
export function crackPath(body: { x: number; w: number }, topY: number, footY: number, seed: number, n: number): string {
  const x0 = body.x + body.w * (0.22 + 0.28 * ((seed * 3 + n * 2) % 3));
  const steps = 4;
  const dy = Math.max(2, (footY - topY) / steps);
  let d = `M${x0.toFixed(1)} ${topY.toFixed(1)}`;
  for (let s = 1; s <= steps; s += 1) {
    const x = x0 + (s % 2 === 0 ? -1 : 1) * (2 + ((seed + n + s) % 3));
    d += ` L${x.toFixed(1)} ${(topY + dy * s).toFixed(1)}`;
  }
  return d;
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
