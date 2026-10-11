import { OBJECT_ART, type ObjectArt, type ObjectArtId } from "./stitchArt";
import type { FortressSize, FortressStructure, FortressWall, GameTower } from "./types";

/**
 * Tower kit (Design Master Sprint 1): which Stitch picture stands for a keep,
 * and where it goes. Pure functions, no React. The picture carries NO fact:
 * wall material and size class are already decided by the backend and shown
 * by the picture's silhouette and stone; freshness, cracks, ivy, ladders and
 * the like stay code drawn over it.
 */

/** Spire for the two bigger size classes, bastion for the rest. Size class is
 * already a fact a tower shows by its size, so the silhouette adds no meaning. */
const SPIRE_SIZES: ReadonlySet<FortressSize> = new Set<FortressSize>(["great", "medium"]);

const VAULT_BY_SIZE: Record<FortressSize, ObjectArtId> = {
  great: "vault-3",
  medium: "vault-2",
  small: "vault-1",
  tiny: "vault-1",
  unknown: "vault-1",
};

type PictureWall = Exclude<FortressWall, "unsurveyed" | "not_applicable">;

/**
 * The picture for a tower, or null when the SVG must draw it: a keep whose
 * walls were never surveyed (always the code ghost keep, never a guessed
 * material). `not_applicable` uses granite, as the plan says. Sprint 2 adds the
 * other structures: a fund is the outpost, a cash-like fund the granary, a gold
 * store one of three vaults by size class (a fuller hoard for a bigger holding;
 * size is already a fact the tower shows).
 */
export function towerArtId(t: Pick<GameTower, "structure" | "size_class" | "wall">): ObjectArtId | null {
  switch (t.structure satisfies FortressStructure) {
    case "outpost":
      return "outpost";
    case "granary":
      return "granary";
    case "bullion":
      return VAULT_BY_SIZE[t.size_class];
    case "keep":
      break;
  }
  if (t.wall === "unsurveyed") return null;
  const wall: PictureWall = t.wall === "not_applicable" ? "granite" : t.wall;
  return `${SPIRE_SIZES.has(t.size_class) ? "spire" : "bastion"}-${wall}` as ObjectArtId;
}

/** Where the picture and its overlay anchors land on the scene, in scene px. */
export interface TowerArtPlacement {
  id: ObjectArtId;
  src: string;
  /** Picture rectangle. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Ground line the picture stands on (its bottom edge). */
  ground: number;
  /** The tower's walls, for overlays that were drawn against the old body box. */
  body: { x: number; w: number; top: number };
  door: { cx: number; bottom: number; w: number; h: number } | null;
  /** Window centres and size; empty for a picture with no readable windows. */
  windows: { cx: number; cy: number; w: number; h: number }[];
}

/** Keep roof height the old SVG used for a body of width w; sizes the picture. */
const roofHeight = (w: number) => Math.min(66, Math.round(w * 0.62));
/** Picture height as a multiple of the layout box height, for the low
 * structures (their boxes are drawn shorter than a keep of the same size). */
const LOW_HEIGHT: Partial<Record<ObjectArtId, number>> = {
  outpost: 1.35,
  granary: 1.25,
  "vault-1": 1.7,
  "vault-2": 1.7,
  "vault-3": 1.7,
};
/** Allowed overhang past the layout box, as the old parapet had. */
const OVERHANG = 14;
const GROUND_DROP = 2;

export function placeTowerArt(
  id: ObjectArtId,
  box: { x: number; y: number; w: number; h: number },
  art: ObjectArt = OBJECT_ART[id],
): TowerArtPlacement {
  const aspect = art.width / art.height;
  const low = LOW_HEIGHT[id];
  const wantH = low ? box.h * low : box.h + roofHeight(box.w) + OVERHANG;
  const width = Math.min(box.w + OVERHANG, wantH * aspect);
  const height = width / aspect;
  const cx = box.x + box.w / 2;
  const left = cx - width / 2;
  const ground = box.y + GROUND_DROP;
  const top = ground - height;
  const a = art.anchors ?? {};
  const px = (f: readonly [number, number]) => ({ x: left + f[0] * width, y: top + f[1] * height });
  const tl = a["body-tl"] ? px(a["body-tl"]) : { x: left, y: top + height * 0.3 };
  const br = a["body-br"] ? px(a["body-br"]) : { x: left + width, y: ground };
  const winSize = a["window-size"] ?? [0.1, 0.06];
  const windows = Object.keys(a)
    .filter((k) => /^w\d+$/.test(k))
    .sort()
    .map((k) => {
      const c = px(a[k]);
      return { cx: c.x, cy: c.y, w: winSize[0] * width, h: winSize[1] * height };
    });
  const door = a.door && a["door-size"]
    ? { cx: px(a.door).x, bottom: px(a.door).y, w: a["door-size"][0] * width, h: a["door-size"][1] * height }
    : null;
  return {
    id,
    src: art.src,
    left,
    top,
    width,
    height,
    ground,
    body: { x: tl.x, w: br.x - tl.x, top: tl.y },
    door,
    windows,
  };
}

/** The tower as the old overlays expect it: x, w, h of the walls and y the ground. */
export function overlayBox(
  p: TowerArtPlacement,
  item: { y: number },
): { x: number; y: number; w: number; h: number } {
  return { x: p.body.x, y: item.y, w: p.body.w, h: item.y - p.body.top };
}

/** The Great Keep picture: wider than its layout box (the old drawing had
 * turrets and a donjon), standing on the keep's ground line. */
const KEEP_PICTURE_WIDTH = 236;

export interface GreatKeepPlacement {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  ground: number;
  door: { cx: number; bottom: number; w: number; h: number } | null;
}

export function placeGreatKeep(
  keep: { x: number; y: number; w: number },
  art: ObjectArt = OBJECT_ART["keep-granite"],
): GreatKeepPlacement {
  const aspect = art.width / art.height;
  const width = KEEP_PICTURE_WIDTH;
  const height = width / aspect;
  const left = keep.x + keep.w / 2 - width / 2;
  const top = keep.y + GROUND_DROP - height;
  const a = art.anchors ?? {};
  const door =
    a.door && a["door-size"]
      ? {
          cx: left + a.door[0] * width,
          bottom: top + a.door[1] * height,
          w: a["door-size"][0] * width,
          h: a["door-size"][1] * height,
        }
      : null;
  return { src: art.src, left, top, width, height, ground: keep.y + GROUND_DROP, door };
}
