import type { SiegeCamp } from "./fortress";
import { OBJECT_ART, type ObjectArtId } from "./stitchArt";

/**
 * Siege camp and scene life as pictures (Design Master Sprint 3). Pure
 * placement, no React. The camp is built from the same counts as the SVG
 * camp (`siegeCamp()`), so a picture never adds or removes an enemy: calm or
 * unsurveyed weather still draws nothing, gathering draws 3 tents and 7
 * soldiers, besieged 7 tents, 20 soldiers, 3 engines and 5 fire arrows.
 */

export interface SpriteRect {
  id: ObjectArtId;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Degrees about the picture centre; 0 = as drawn. */
  rotate: number;
}

/** A picture of height h centred on cx, its bottom edge on the ground line. */
export function spriteOnGround(id: ObjectArtId, cx: number, ground: number, h: number): SpriteRect {
  const art = OBJECT_ART[id];
  const width = (h * art.width) / art.height;
  return { id, src: art.src, left: cx - width / 2, top: ground - h, width, height: h, rotate: 0 };
}

/** Heights on the far hills, where everything is small. */
const TENT_H = 26;
const SOLDIER_H = 15;
const ENGINE_H = 38;
const ARROW_H = 20;

const TENT_XS = [96, 214, 330, 566, 690, 812, 902];
const ENGINES: [ObjectArtId, number][] = [
  ["siege-trebuchet", 150],
  ["siege-ram", 450],
  ["siege-tower", 760],
];
/** [target x, target y, launch x]: where each fire arrow lands on the towers. */
const ARROW_TARGETS: readonly [number, number, number][] = [
  [236, 300, 120], [410, 292, 330], [560, 286, 590], [700, 292, 790], [820, 300, 880],
];
/** The arrow picture points up and to the left (its flame is the tip). */
const ARROW_TIP_DEG = -135;

export function siegeCampSprites(camp: SiegeCamp, y: number): SpriteRect[] {
  const out: SpriteRect[] = [];
  TENT_XS.slice(0, camp.tents).forEach((x) => out.push(spriteOnGround("siege-tent", x, y + 8, TENT_H)));
  for (let i = 0; i < camp.soldiers; i += 1) {
    const x = 40 + ((i * 53) % 900) + (i % 3) * 5;
    out.push(spriteOnGround("siege-soldier", x, y + 14 + (i % 4) * 3, SOLDIER_H));
  }
  ENGINES.slice(0, camp.engines).forEach(([id, x]) => out.push(spriteOnGround(id, x, y + 16, ENGINE_H)));
  return out;
}

/** The arrows in flight: each lands at its target pointing along the arc's last stretch. */
export function fireArrowSprites(camp: SiegeCamp, y: number): SpriteRect[] {
  return ARROW_TARGETS.slice(0, camp.arrows).map(([tx, ty, sx]) => {
    const art = OBJECT_ART["siege-arrow"];
    const width = (ARROW_H * art.width) / art.height;
    // Control point of the dotted arc is (mid x, y - 70); the arrow ends on its last tangent.
    const dx = tx - (sx + tx) / 2;
    const dy = ty - (y - 70);
    const heading = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      id: "siege-arrow" as const,
      src: art.src,
      left: tx - width / 2,
      top: ty - ARROW_H / 2,
      width,
      height: ARROW_H,
      rotate: heading - ARROW_TIP_DEG,
    };
  });
}

/** A raven perched with its feet at (x, y); a bird about 22 px tall. */
export const RAVEN_H = 22;
export function ravenSprite(x: number, y: number): SpriteRect {
  return spriteOnGround("raven", x, y + 4, RAVEN_H);
}
