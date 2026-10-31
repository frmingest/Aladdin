/**
 * Fitting a generated 3D model into the courtyard (game3d). Pure maths, no three.js.
 * AI-made models arrive in any size, off-centre and facing any way, so each one is scaled to a
 * set height, centred on its spot and stood on the ground. Which way it faces is a per-slot
 * setting (MODEL_YAW) that you set by looking, because generators do not agree on "front".
 */

/** The places a real model can replace a shape figure. */
export type ModelId = "hero" | "oracle" | "partner" | "fountain" | "lamp" | "board" | "perch";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Turn, in radians, so the model's front faces +z (toward the gate). Set per slot after a first look. */
export const MODEL_YAW: Partial<Record<ModelId, number>> = {};

export interface Fit {
  scale: number;
  /** Where to put the (already scaled) model so its feet touch the ground at the middle of its spot. */
  offset: [number, number, number];
}

/** Scale to `height`, centre on x and z, feet at y = 0. An empty or flat box fits as "leave alone". */
export function fitToHeight(min: Vec3, max: Vec3, height: number): Fit {
  const h = max.y - min.y;
  if (!Number.isFinite(h) || h <= 1e-6 || height <= 0) return { scale: 1, offset: [0, 0, 0] };
  const scale = height / h;
  return {
    scale,
    offset: [(-(min.x + max.x) / 2) * scale, -min.y * scale, (-(min.z + max.z) / 2) * scale],
  };
}
