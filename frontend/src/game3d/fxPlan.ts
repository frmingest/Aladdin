/**
 * Chimney smoke and forge sparks (polish pass PR 2). Pure maths, no three.js and no React: where a puff or a spark is
 * at a given time. Decoration only: it carries no fact, and nothing here reads data.
 */

export interface FxSpec {
  /** How many sprites rise together. */
  count: number;
  /** Seconds one sprite lives before it starts again. */
  life: number;
  /** How high it travels, in world units. */
  rise: number;
  /** Sideways wander at the top. */
  drift: number;
  /** Sprite size at birth and at the end. */
  from: number;
  to: number;
  /** Peak opacity. */
  alpha: number;
}

export const SMOKE: FxSpec = { count: 7, life: 5, rise: 5, drift: 1.2, from: 0.6, to: 2.2, alpha: 0.5 };
export const SPARKS: FxSpec = { count: 10, life: 1.1, rise: 1.3, drift: 0.7, from: 0.14, to: 0.04, alpha: 1 };

/** A tall, thin column: the smoke mark of a wire that fired and is not yet looked at (marks.ts). Taller than any chimney plume. */
export const THIN_SMOKE: FxSpec = { count: 12, life: 8, rise: 14, drift: 0.5, from: 1.2, to: 2.6, alpha: 0.9 };

/** Smoke grey and lantern flame: one place, shared by the chimney plume, the lantern post, the smoke mark and the stall lamp. */
export const SMOKE_COLOUR = "#c9c4bb";
export const FLAME_COLOUR = "#f4c35a";
/** A brighter bronze for the bell, so it reads at yard distance. */
export const BRONZE_COLOUR = "#d89a3c";

/** The time a frozen column (reduced motion) is drawn at. Sprites are spread through the cycle, so it still reads as a column. */
export const FROZEN_T = 3.5;

/** Cheap fixed hash in 0..1, so the same sprite always has the same wobble and tests stay stable. */
export function jitter(i: number, salt = 0): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface FxState {
  /** 0 at birth, 1 at the end of its life. */
  age: number;
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
}

/** The two sideways wander factors of sprite `i` (-1..1), worked out once so a frame loop need not hash again. */
export function fxSide(i: number): [number, number] {
  return [(jitter(i) - 0.5) * 2, (jitter(i, 1) - 0.5) * 2];
}

/**
 * Sprite `i` of `spec` at time `t`, written into `out` (no allocation: for frame loops). `side` and `side2` may be passed
 * from `fxSide` when they were worked out once. Sprites are spread evenly through the cycle, so the stream never pulses.
 */
export function fxStateInto(out: FxState, spec: FxSpec, i: number, t: number, side?: number, side2?: number): FxState {
  const phase = (t / spec.life + i / spec.count) % 1;
  const age = phase < 0 ? phase + 1 : phase;
  const s1 = side ?? (jitter(i) - 0.5) * 2;
  const s2 = side2 ?? (jitter(i, 1) - 0.5) * 2;
  // Fade in over the first fifth and out over the last half, so a sprite never pops.
  const fade = Math.min(age / 0.2, 1) * (1 - Math.max(0, (age - 0.5) / 0.5));
  out.age = age;
  out.x = s1 * spec.drift * age;
  out.y = spec.rise * age;
  out.z = s2 * spec.drift * age;
  out.size = spec.from + (spec.to - spec.from) * age;
  out.alpha = spec.alpha * fade;
  return out;
}

/** Sprite `i` of `spec` at time `t` seconds (a new object; frame loops use `fxStateInto`). */
export function fxState(spec: FxSpec, i: number, t: number): FxState {
  return fxStateInto({ age: 0, x: 0, y: 0, z: 0, size: 0, alpha: 0 }, spec, i, t);
}

/** A smoking chimney: which town model, and where its top is in the model's own units (before scale). */
export interface ChimneySpot {
  model: "house" | "lumbermill";
  x: number;
  y: number;
  z: number;
}

/**
 * ESTIMATED from the roof geometry of town-buildings.glb, not seen on screen: the mesh has no separate chimney node.
 * A look decides; nudge these two lines if the smoke does not leave a chimney.
 */
export const CHIMNEYS: readonly ChimneySpot[] = [
  { model: "house", x: 0.3, y: 0.9, z: -0.3 },
  { model: "lumbermill", x: -0.2, y: 1.45, z: -0.3 },
];

/** Where the forge's fire is, above the forge's own origin in the workshop land. */
export const FORGE_FIRE_HEIGHT = 0.9;

/** Sprite `i` of `spec` at the one fixed time, for reduced motion: the same for any clock. */
export function fxFrozen(spec: FxSpec, i: number): FxState {
  return fxState(spec, i, FROZEN_T);
}
