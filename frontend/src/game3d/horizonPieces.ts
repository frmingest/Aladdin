/**
 * The horizon shell of the 3D courtyard (game3d, S7): a grove and boulders outside the walls, foothills
 * beyond them and mountains at the rim, all from the KayKit Medieval Hexagon nature set (CC0, see
 * public/models/CREDITS.md). Pure data and maths, no three.js.
 *
 * It is scenery only: nothing here depends on a holding, carries a fact or stands for anything.
 * The same seed gives the same horizon on every machine and every load, so it never "changes" and
 * nobody can read a meaning into where a tree stands. If horizon.glb fails to load, the courtyard
 * looks like it did before (the painted backdrop is still behind it).
 */
export const HORIZON_URL = "/models/horizon.glb";

/** Node names inside horizon.glb. */
export type HorizonModel =
  | "tree_single_A"
  | "tree_single_B"
  | "trees_A_small"
  | "trees_A_medium"
  | "trees_B_large"
  | "rock_single_C"
  | "rock_single_E"
  | "hills_A"
  | "hills_B"
  | "hills_C"
  | "hills_A_trees"
  | "hills_C_trees"
  | "mountain_A"
  | "mountain_B"
  | "mountain_C"
  | "mountain_A_grass_trees"
  | "mountain_B_grass";

export type HorizonRing = "grove" | "rock" | "hill" | "mountain";

export interface HorizonPiece {
  id: string;
  ring: HorizonRing;
  model: HorizonModel;
  x: number;
  z: number;
  /** Turn about the vertical axis, radians. */
  yaw: number;
  scale: number;
  /** Radius of the solid base you walk round; 0 for no collider (hills and mountains are out of reach). */
  solid: number;
}

/** The meadow you can walk on ends here (an invisible wall), so hills and mountains stay out of reach. */
export const HORIZON_LIMIT = 104;
/** Grove and boulders stand between these two radii: past the curtain wall (54), short of the limit. */
export const GROVE_INNER = 66;
export const GROVE_OUTER = 96;
/** Half-width kept free either side of the gate road, and how far the road runs (see Courtyard.tsx). */
export const ROAD_HALF_WIDTH = 8;
export const ROAD_END_Z = 94;

/** Hard ceilings the tests hold: instances in total and the number of separate models (= draw calls). */
export const HORIZON_MAX_PIECES = 120;
export const HORIZON_MAX_MODELS = 17;

/** Wall height is 6, so only pieces taller than that can be seen over the wall from inside. */
const SINGLE_TREES: HorizonModel[] = ["tree_single_A", "tree_single_B"];
const CLUMPS: HorizonModel[] = ["trees_A_small", "trees_A_medium", "trees_B_large"];
const ROCKS: HorizonModel[] = ["rock_single_C", "rock_single_E"];
const HILLS: HorizonModel[] = ["hills_A", "hills_A_trees", "hills_B", "hills_C", "hills_C_trees"];
const MOUNTAINS: HorizonModel[] = ["mountain_B", "mountain_A_grass_trees", "mountain_C", "mountain_B_grass", "mountain_A"];

/** Trunk-cluster radius as a share of the model's size: what stops you, not the leaves. */
const SOLID_PER_SCALE: Partial<Record<HorizonModel, number>> = {
  tree_single_A: 0.12,
  tree_single_B: 0.14,
  trees_A_small: 0.4,
  trees_A_medium: 0.45,
  trees_B_large: 0.5,
  rock_single_C: 0.17,
  rock_single_E: 0.22,
};

/** Small deterministic random numbers (mulberry32), so the horizon is the same every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True where a grove piece may not stand: on or beside the road out of the gate. */
export function onGateRoad(x: number, z: number, margin = ROAD_HALF_WIDTH): boolean {
  return z > 30 && z < ROAD_END_Z + margin && Math.abs(x) < margin;
}

export function buildHorizon(seed = 7): HorizonPiece[] {
  const rand = seeded(seed);
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length) % list.length];
  const pieces: HorizonPiece[] = [];
  const GOLDEN = 2.399963229728653;

  // Grove and boulders: a golden-angle spread (even, no rows), skipping the road and anything too close.
  const placeRing = (ring: "grove" | "rock", attempts: number, kinds: () => HorizonModel, scaleOf: (m: HorizonModel) => number) => {
    let n = 0;
    for (let i = 0; i < attempts; i++) {
      const angle = (ring === "grove" ? 0.4 : 1.9) + i * GOLDEN + (rand() - 0.5) * 0.35;
      const r = GROVE_INNER + (GROVE_OUTER - GROVE_INNER) * ((i * 0.61803398875 + rand() * 0.25) % 1);
      const x = r * Math.sin(angle);
      const z = r * Math.cos(angle);
      const model = kinds();
      const scale = scaleOf(model);
      const solid = (SOLID_PER_SCALE[model] ?? 0) * scale;
      if (onGateRoad(x, z, ROAD_HALF_WIDTH + solid)) continue;
      const clear = pieces.every((p) => Math.hypot(p.x - x, p.z - z) > p.solid + solid + 2.5);
      if (!clear) continue;
      pieces.push({ id: `${ring}-${n++}`, ring, model, x, z, yaw: rand() * Math.PI * 2, scale, solid });
    }
  };
  placeRing("grove", 70, () => (rand() < 0.45 ? pick(SINGLE_TREES) : pick(CLUMPS)), (m) => (SINGLE_TREES.includes(m) ? 6 + rand() * 3 : 5 + rand() * 2.5));
  placeRing("rock", 26, () => pick(ROCKS), () => 7 + rand() * 6);

  // Foothills and mountains: evenly round the whole horizon with a little jitter, no colliders.
  const band = (ring: "hill" | "mountain", count: number, radius: [number, number], scale: [number, number], list: HorizonModel[], phase: number) => {
    for (let i = 0; i < count; i++) {
      const angle = phase + (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const r = radius[0] + rand() * (radius[1] - radius[0]);
      pieces.push({
        id: `${ring}-${i}`,
        ring,
        model: list[i % list.length],
        x: r * Math.sin(angle),
        z: r * Math.cos(angle),
        yaw: rand() * Math.PI * 2,
        scale: scale[0] + rand() * (scale[1] - scale[0]),
        solid: 0,
      });
    }
  };
  band("hill", 16, [125, 135], [11, 15], HILLS, 0.1);
  band("mountain", 14, [140, 150], [21, 27], MOUNTAINS, 0.3);
  return pieces;
}

export const HORIZON: HorizonPiece[] = buildHorizon();
