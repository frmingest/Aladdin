/**
 * The mill dressings (S26 PR 2): windmill and watermill. Pure data and maths, no three.js and no React.
 *
 * The plan says WHICH pieces stand WHERE for a given condition. Condition comes from the ladder (`LandCondition`) alone:
 * how many fence slats are missing, how far things lean, how many props, loose boards and fallen stones. Nothing here reads
 * the sector, the weight, the value or the verdict. The scenery (sacks, a barrel, a crate, a wheelbarrow) is the same on
 * every rung and never grows with any value. The windmill stands still (decision G1: its sails are not a separate piece).
 * Ghost and neutral are drawn by the centre slot, so this file only ever sees the five rungs (and tolerates neutral).
 */
import type { LandCondition } from "./landCondition";

export type MillTheme = "windmill" | "watermill";

/** Which file a piece is read from, by its short name. */
export type MillFile = "holding-windmill" | "holding-watermill";
export const MILL_FILE_URL: Record<MillFile, string> = {
  "holding-windmill": "/models/holding-windmill.glb",
  "holding-watermill": "/models/holding-watermill.glb",
};

export interface MillPiece {
  file: MillFile;
  node: string;
  /** Position relative to the land's centre (x, z) and the lean of this one piece in degrees (about z). */
  x: number;
  z: number;
  yaw: number;
  lean: number;
  scale: number;
  /** "base": the piece's lowest point sits on y; "top": its highest point sits on y (for the sunk water tile). */
  anchor: "base" | "top";
  y: number;
}

/** Everything the dressing draws in code (shape only): the stone footing, patches, the crack. */
export interface MillCode {
  footing: number; // 0 none, 0.5 half, 1 full (the ladder's `trim`)
  patches: number;
  crack: boolean;
}

export interface MillPlan {
  theme: MillTheme;
  pieces: MillPiece[];
  /** The whole building tilts by this many degrees. */
  buildingLean: number;
  code: MillCode;
}

const BUILDING_SCALE = 2.6;
const PROP_SCALE = 4;
const FENCE_SCALE = 0.7;
/** Fence slats stand on a half ring round the front (+z); the first `gaps` of GAP_ORDER are missing. */
const FENCE_COUNT = 9;
const FENCE_RADIUS = 2.15;
const GAP_ORDER = [4, 1, 7, 3, 5, 0, 8] as const;
const RUBBLE_SPOTS: readonly [number, number][] = [[-1.1, 1.8], [0.3, 2.0], [1.2, 1.5], [-0.3, 2.3], [0.9, 2.2]];
const PROP_SPOTS: readonly [number, number][] = [[1.55, 0.2], [1.55, -0.6], [-1.55, 0.2]];

/** How many pieces a plan may place at most (the draw budget; a land is limited to 120 draw calls in all). */
export const MILL_MAX_PIECES = 40;

const piece = (file: MillFile, node: string, x: number, z: number, scale: number, o: Partial<MillPiece> = {}): MillPiece => ({
  file, node, x, z, yaw: 0, lean: 0, scale, anchor: "base", y: 0, ...o,
});

export function millPlan(theme: MillTheme, c: LandCondition): MillPlan {
  const file: MillFile = theme === "windmill" ? "holding-windmill" : "holding-watermill";
  const out: MillPiece[] = [];
  // The building itself. The watermill sits a little back so the water tile fits in front of it.
  out.push(piece(file, theme, 0, theme === "watermill" ? -0.5 : 0, BUILDING_SCALE));
  if (theme === "watermill") {
    // Real water inside the scene: scenery only. It never carries the moat fact (the stream band does).
    out.push(piece(file, "water_tile", 0.2, 0.9, 1.1, { anchor: "top", y: 0.08 }));
  }
  // The fence: a half ring in front. Missing slats are the gaps; the ones left lean as far as the rung says.
  const missing = new Set<number>(GAP_ORDER.slice(0, c.gaps));
  for (let i = 0; i < FENCE_COUNT; i++) {
    if (missing.has(i)) continue;
    const a = Math.PI * (0.12 + (0.76 * i) / (FENCE_COUNT - 1)); // 0..PI across the front
    out.push(
      piece(file, "fence_wood", Math.cos(a) * FENCE_RADIUS, Math.sin(a) * FENCE_RADIUS, FENCE_SCALE, {
        yaw: -a,
        lean: i % 2 ? c.lean : -c.lean,
      }),
    );
  }
  // Props: planks leaned against the low side. Broken ones are shorter and flatter.
  for (let i = 0; i < c.props; i++) {
    const broken = i < c.brokenProps;
    const [x, z] = PROP_SPOTS[i]!;
    out.push(piece(file, "planks_small", x, z, broken ? 1.0 : 1.7, { lean: broken ? 55 : 28, yaw: Math.PI / 2 }));
  }
  // Loose boards: single planks lying skewed at the foot of the wall.
  for (let i = 0; i < c.looseBoards; i++) {
    out.push(piece(file, "planks_small", -1.0 + i * 0.9, 1.2 + (i % 2) * 0.35, 0.8, { yaw: 0.6 + i * 0.5, lean: 8 }));
  }
  // Fallen stones in front.
  for (let i = 0; i < c.rubble; i++) {
    const [x, z] = RUBBLE_SPOTS[i]!;
    out.push(piece(file, theme === "windmill" ? "rock_B" : "rock_D", x, z, PROP_SCALE, { yaw: 0.8 * i }));
  }
  // Scenery: the same on every rung, fixed counts, never driven by a value.
  out.push(piece(file, "sack", -1.5, -1.2, PROP_SCALE, { yaw: 0.4 }));
  out.push(piece(file, "sack", -1.1, -1.5, PROP_SCALE, { yaw: -0.3 }));
  out.push(piece(file, "barrel", 1.4, -1.5, PROP_SCALE));
  if (theme === "windmill") {
    out.push(piece(file, "crate_A_big", 1.8, -0.9, PROP_SCALE, { yaw: 0.3 }));
    out.push(piece(file, "wheelbarrow", -1.9, 0.7, PROP_SCALE, { yaw: 1.2 }));
  } else {
    out.push(piece(file, "bucket_water", 1.85, -0.9, PROP_SCALE));
  }
  return { theme, pieces: out, buildingLean: c.lean, code: { footing: c.trim, patches: c.patches, crack: c.crack > 0 } };
}

/** Every file node a plan may ask for, so a test can check they exist. */
export const MILL_NODES: Record<MillTheme, readonly { file: MillFile; node: string }[]> = {
  windmill: ["windmill", "fence_wood", "planks_small", "rock_B", "sack", "barrel", "crate_A_big", "wheelbarrow"].map((node) => ({ file: "holding-windmill" as const, node })),
  watermill: ["watermill", "water_tile", "fence_wood", "planks_small", "rock_D", "sack", "barrel", "bucket_water"].map((node) => ({ file: "holding-watermill" as const, node })),
};
