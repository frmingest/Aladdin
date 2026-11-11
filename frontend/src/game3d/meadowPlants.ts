/**
 * The meadow plants (asset sprint A4): trees, bushes, grass tufts and rocks from the KayKit Forest Nature pack (CC0, see
 * public/models/CREDITS.md) on the open ground outside the wall. Pure data and maths, no three.js and no React.
 * `MeadowPlants.tsx` draws them.
 *
 * THE RULE: the landscape may not carry a fact. Every plant is a fixed number from a fixed seed: the same plants for every
 * portfolio, verdict and day. Nothing here takes a holding, a theme, a wall tier or a moat tier, so nothing can lean on
 * one, and the leaf green is scenery (no status colour is ever drawn in it).
 *
 * Coordinates are the courtyard's: x east, z south, the gate at the south (z positive). Plants only stand on open ground:
 * off every plot, track, field, the river, the gate road and every grove tree or boulder of the horizon.
 */
import type { Spot } from "./layout";
import { WALL_RADIUS, WALL_THICKNESS } from "./layout";
import { HORIZON_LIMIT, onGateRoad, seeded } from "./horizonPieces";
import { FIELDS, RIVER_HALF, THIN_MARGIN, distToPolyline, fieldReach, riverLine, thinnedHorizon, tracks } from "./countryside";
import { BUILDINGS, VILLAGE_MARGIN, buildingReach } from "./townPlan";

export const FOREST_URL = "/models/forest.glb";

/** Node names inside forest.glb. */
export type PlantModel =
  | "tree_1_a" | "tree_1_b" | "tree_2_a" | "tree_2_b" | "tree_3_a" | "tree_4_a"
  | "bush_1_a" | "bush_2_a" | "bush_3_a" | "bush_4_a"
  | "grass_1_a" | "grass_2_a"
  | "rock_1_a" | "rock_2_a" | "rock_3_a";

export type PlantKind = "tree" | "bush" | "grass" | "rock";

export interface Plant {
  id: string;
  kind: PlantKind;
  model: PlantModel;
  x: number;
  z: number;
  /** Turn about the vertical axis, radians. */
  yaw: number;
  scale: number;
  /** Radius of the solid trunk or boulder you walk round; 0 for bushes and grass (you walk through them). */
  solid: number;
  /** How far the plant spreads on the ground, for keeping clear of things. */
  reach: number;
}

/** Plants stand between the lane round the wall and the invisible edge of the meadow. */
export const PLANT_INNER = WALL_RADIUS + WALL_THICKNESS / 2 + 5;
export const PLANT_OUTER = HORIZON_LIMIT - 4;

/** Hard ceilings the tests hold: instances in total, the number of separate models (= draw calls) and trunk colliders. */
export const PLANTS_MAX = 180;
export const PLANT_MODELS_MAX = 15;
export const PLANT_SOLIDS_MAX = 40;

/** How each model is drawn: the scale range, the share of its scale that spreads on the ground, and that which stops you. */
interface Look {
  kind: PlantKind;
  scale: readonly [number, number];
  spread: number;
  solid: number;
}
export const LOOK: Readonly<Record<PlantModel, Look>> = {
  tree_1_a: { kind: "tree", scale: [1.5, 2.1], spread: 1.7, solid: 0.2 },
  tree_1_b: { kind: "tree", scale: [1.5, 2.1], spread: 1.8, solid: 0.2 },
  tree_2_a: { kind: "tree", scale: [1.6, 2.2], spread: 1.3, solid: 0.14 },
  tree_2_b: { kind: "tree", scale: [1.4, 1.9], spread: 1.4, solid: 0.14 },
  tree_3_a: { kind: "tree", scale: [1.6, 2.2], spread: 1.6, solid: 0.22 },
  tree_4_a: { kind: "tree", scale: [1.7, 2.3], spread: 1.1, solid: 0.14 },
  bush_1_a: { kind: "bush", scale: [6, 9], spread: 0.15, solid: 0 },
  bush_2_a: { kind: "bush", scale: [4, 6], spread: 0.27, solid: 0 },
  bush_3_a: { kind: "bush", scale: [2.4, 3.6], spread: 0.55, solid: 0 },
  bush_4_a: { kind: "bush", scale: [3.5, 5], spread: 0.3, solid: 0 },
  grass_1_a: { kind: "grass", scale: [3, 5], spread: 0.18, solid: 0 },
  grass_2_a: { kind: "grass", scale: [3, 5], spread: 0.18, solid: 0 },
  rock_1_a: { kind: "rock", scale: [4, 6.5], spread: 0.32, solid: 0.26 },
  rock_2_a: { kind: "rock", scale: [8, 12], spread: 0.12, solid: 0.12 },
  rock_3_a: { kind: "rock", scale: [3.5, 5.5], spread: 0.52, solid: 0.38 },
};

export const MODELS_OF: Readonly<Record<PlantKind, readonly PlantModel[]>> = {
  tree: ["tree_1_a", "tree_1_b", "tree_2_a", "tree_2_b", "tree_3_a", "tree_4_a"],
  bush: ["bush_1_a", "bush_2_a", "bush_3_a", "bush_4_a"],
  grass: ["grass_1_a", "grass_2_a"],
  rock: ["rock_1_a", "rock_2_a", "rock_3_a"],
};

/** How many of each, at most. Fixed. */
export const COUNTS: Readonly<Record<PlantKind, number>> = { tree: 26, bush: 44, grass: 80, rock: 14 };

/** Open ground kept between a plant's spread and the river, a track, a field, a plot or a horizon tree. */
export const PLANT_MARGIN = THIN_MARGIN;

/* ---------------------------------------------------------------- what is in the way (computed once) */

let cache: { river: Spot[]; tracks: ReturnType<typeof tracks>; grove: { x: number; z: number; r: number }[] } | null = null;
function obstacles() {
  cache ??= {
    river: riverLine(),
    tracks: tracks(),
    grove: thinnedHorizon()
      .filter((p) => p.ring === "grove" || p.ring === "rock")
      .map((p) => ({ x: p.x, z: p.z, r: Math.max(p.solid, p.scale * 0.45) })),
  };
  return cache;
}

/** True where the ground is taken by the river, a track, a field, a plot, the gate road or a horizon tree. */
export function blocked(x: number, z: number, reach: number): boolean {
  const at = { x, z };
  const o = obstacles();
  const r = reach + PLANT_MARGIN;
  if (onGateRoad(x, z, 8 + reach)) return true;
  if (distToPolyline(at, o.river) < RIVER_HALF + r) return true;
  for (const t of o.tracks) if (distToPolyline(at, t.points) < t.width / 2 + r) return true;
  for (const f of FIELDS) if (Math.hypot(x - f.x, z - f.z) < fieldReach(f) + r) return true;
  for (const b of BUILDINGS) if (Math.hypot(x - b.x, z - b.z) < buildingReach(b) + VILLAGE_MARGIN + r) return true;
  for (const g of o.grove) if (Math.hypot(x - g.x, z - g.z) < g.r + reach + 0.5) return true;
  return false;
}

/* ---------------------------------------------------------------- the plan */

const GOLDEN = 2.399963229728653;

export function buildPlants(seed = 11): Plant[] {
  const rand = seeded(seed);
  const plants: Plant[] = [];
  const counts: Record<PlantKind, number> = { tree: 0, bush: 0, grass: 0, rock: 0 };
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length) % list.length];

  const tryPlace = (kind: PlantKind, x: number, z: number): Plant | null => {
    if (counts[kind] >= COUNTS[kind]) return null;
    const r = Math.hypot(x, z);
    if (r < PLANT_INNER || r > PLANT_OUTER) return null;
    const model = pick(MODELS_OF[kind]);
    const look = LOOK[model];
    const scale = look.scale[0] + rand() * (look.scale[1] - look.scale[0]);
    const reach = look.spread * scale;
    if (blocked(x, z, reach)) return null;
    // Trees and boulders keep apart from each other; low plants may overlap each other and sit under a crown.
    if (kind === "tree" || kind === "rock") {
      const crowded = plants.some((p) => (p.kind === "tree" || p.kind === "rock") && Math.hypot(p.x - x, p.z - z) < p.reach + reach);
      if (crowded) return null;
    }
    const plant: Plant = { id: `${kind}-${counts[kind]}`, kind, model, x, z, yaw: rand() * Math.PI * 2, scale, solid: look.solid * scale, reach };
    counts[kind]++;
    plants.push(plant);
    return plant;
  };

  // Copses: a golden-angle spread of trees (even, no rows), and round each a few bushes and tufts.
  const trees: Plant[] = [];
  for (let i = 0; i < 300 && counts.tree < COUNTS.tree; i++) {
    const angle = 0.9 + i * GOLDEN + (rand() - 0.5) * 0.3;
    const r = PLANT_INNER + (PLANT_OUTER - PLANT_INNER) * ((i * 0.61803398875 + rand() * 0.2) % 1);
    const t = tryPlace("tree", r * Math.sin(angle), r * Math.cos(angle));
    if (t) trees.push(t);
  }
  for (const t of trees) {
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2;
      const d = t.reach * (0.9 + rand() * 0.8) + 1;
      tryPlace("bush", t.x + d * Math.sin(a), t.z + d * Math.cos(a));
    }
  }
  // Leftover bushes and all tufts and boulders: the same even spread, so the open meadow is not bare.
  const scatter = (kind: PlantKind, attempts: number, phase: number) => {
    for (let i = 0; i < attempts && counts[kind] < COUNTS[kind]; i++) {
      const angle = phase + i * GOLDEN + (rand() - 0.5) * 0.4;
      const r = PLANT_INNER + (PLANT_OUTER - PLANT_INNER) * ((i * 0.61803398875 + rand() * 0.3) % 1);
      tryPlace(kind, r * Math.sin(angle), r * Math.cos(angle));
    }
  };
  scatter("bush", 200, 2.2);
  scatter("rock", 200, 4.1);
  scatter("grass", 700, 5.3);
  return plants;
}

export const PLANTS: Plant[] = buildPlants();
