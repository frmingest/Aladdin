/**
 * Fitting a character model into the courtyard (game3d). Pure maths, no three.js.
 * A model arrives in any size and off-centre, so each one is scaled to a set height, centred on its
 * spot and stood on the ground. Which way it faces is a per-slot setting (MODEL_YAW).
 */

/** The places a real model can replace a shape figure. */
export type ModelId = "hero" | "oracle" | "partner";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Turn, in radians, so the model's front faces +z. KayKit glTF characters already face +z. */
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
