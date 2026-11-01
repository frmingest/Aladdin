/**
 * The keep and the four corner towers as KayKit models (game3d, keep + towers sprint). Pure data, no three.js.
 * Decoration with a collider: none of it depends on a holding or carries a fact. If keep.glb fails to load,
 * the plain-shape keep and towers from Courtyard.tsx are drawn instead, exactly as before.
 * Source: KayKit Medieval Hexagon Pack, blue set only (CC0, see public/models/CREDITS.md).
 */
export const KEEP_URL = "/models/keep.glb";

/** Node names inside keep.glb, with the size of each model at scale 1 (measured with scripts/pack-keep.mjs). */
export const KEEP_MODEL = { node: "keep", width: 1.98, depth: 2.26, height: 3.98 } as const;
export const CORNER_TOWER_MODEL = { node: "corner_tower", width: 1.2, depth: 1.38, height: 2.49 } as const;

/** Uniform scale of the keep model, and where it stands: its south face sits on the old keep face (z = -19). */
export const KEEP_MODEL_SCALE = 5.6;
export const KEEP_FACE_Z_MODEL = -19;

export function keepModelFootprint() {
  const width = KEEP_MODEL.width * KEEP_MODEL_SCALE;
  const depth = KEEP_MODEL.depth * KEEP_MODEL_SCALE;
  const height = KEEP_MODEL.height * KEEP_MODEL_SCALE;
  return { width, depth, height, centerZ: KEEP_FACE_Z_MODEL - depth / 2 };
}

/** Uniform scale of a corner tower model, so it is a little taller than the curtain wall. */
export const CORNER_TOWER_SCALE = 4.8;

export function cornerTowerFootprint() {
  return {
    radius: (Math.max(CORNER_TOWER_MODEL.width, CORNER_TOWER_MODEL.depth) / 2) * CORNER_TOWER_SCALE,
    height: CORNER_TOWER_MODEL.height * CORNER_TOWER_SCALE,
  };
}
