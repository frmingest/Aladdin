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

type PictureWall = Exclude<FortressWall, "unsurveyed" | "not_applicable">;

/**
 * The picture for a tower, or null when the SVG must draw it: not a keep
 * (outposts, granaries and gold stores are Sprint 2), or the walls were never
 * surveyed (always the code ghost keep, never a guessed material).
 * `not_applicable` uses granite, as the plan says.
 */
export function towerArtId(t: Pick<GameTower, "structure" | "size_class" | "wall">): ObjectArtId | null {
  if (t.structure !== ("keep" satisfies FortressStructure)) return null;
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
/** Allowed overhang past the layout box, as the old parapet had. */
const OVERHANG = 14;
const GROUND_DROP = 2;

export function placeTowerArt(
  id: ObjectArtId,
  box: { x: number; y: number; w: number; h: number },
  art: ObjectArt = OBJECT_ART[id],
): TowerArtPlacement {
  const aspect = art.width / art.height;
  const wantH = box.h + roofHeight(box.w) + OVERHANG;
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
