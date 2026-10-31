/**
 * Courtyard scenery (game3d, S6): torches, banners and everyday clutter from the KayKit packs
 * (CC0, see public/models/CREDITS.md). Pure data, no three.js. It is decoration only: none of it
 * depends on a holding, none of it carries a fact, and it never replaces a prop or a tower.
 * If scenery.glb fails to load, the courtyard looks like it did before.
 */
export const SCENERY_URL = "/models/scenery.glb";

/** Node names inside scenery.glb. */
export type SceneryModel =
  | "torch_mounted"
  | "banner_blue"
  | "banner_white"
  | "banner_yellow"
  | "banner_patternA_blue"
  | "banner_shield_white"
  | "barrel"
  | "crate_A_big"
  | "crate_B_small"
  | "sack"
  | "tent"
  | "weaponrack"
  | "wheelbarrow"
  | "bucket_water"
  | "flag_blue"
  | "flag_yellow";

export interface SceneryPiece {
  id: string;
  model: SceneryModel;
  x: number;
  /** Height of the model's origin above the ground; above 0 means it hangs on a wall. */
  y: number;
  z: number;
  /** Turn about the vertical axis, radians. 0 faces south (towards the gate). */
  yaw: number;
  scale: number;
  /** Radius of the solid base you walk round; 0 for no collider. */
  solid: number;
}

/** The keep's south face and door, from layout.ts and Courtyard.tsx: the door is 3 wide and 4 tall. */
export const KEEP_FACE_Z = -19;

/** Gate-side torch: on the inner face of the first wall piece beside the gate. */
function gateTorch(id: string, side: 1 | -1): SceneryPiece {
  const angle = 0.34;
  const radius = 35.2; // inner face of the wall (36 minus half of 1.6 thickness)
  return {
    id,
    model: "torch_mounted",
    x: side * radius * Math.sin(angle),
    y: 3.6,
    z: radius * Math.cos(angle),
    yaw: side * angle + Math.PI, // back to the wall, front towards the middle
    scale: 1.6,
    solid: 0,
  };
}

export const SCENERY: readonly SceneryPiece[] = [
  // The keep door: a torch each side, banners either side of those.
  { id: "keep-torch-w", model: "torch_mounted", x: -2.7, y: 3.4, z: KEEP_FACE_Z + 0.05, yaw: 0, scale: 1.6, solid: 0 },
  { id: "keep-torch-e", model: "torch_mounted", x: 2.7, y: 3.4, z: KEEP_FACE_Z + 0.05, yaw: 0, scale: 1.6, solid: 0 },
  { id: "keep-banner-w1", model: "banner_white", x: -4.8, y: 3.4, z: KEEP_FACE_Z - 0.33, yaw: 0, scale: 1, solid: 0 },
  { id: "keep-banner-e1", model: "banner_white", x: 4.8, y: 3.4, z: KEEP_FACE_Z - 0.33, yaw: 0, scale: 1, solid: 0 },
  { id: "keep-banner-w2", model: "banner_blue", x: -6.6, y: 3.4, z: KEEP_FACE_Z - 0.33, yaw: 0, scale: 1, solid: 0 },
  { id: "keep-banner-e2", model: "banner_blue", x: 6.6, y: 3.4, z: KEEP_FACE_Z - 0.33, yaw: 0, scale: 1, solid: 0 },
  // The gate: light either side of the way in.
  gateTorch("gate-torch-w", -1),
  gateTorch("gate-torch-e", 1),
  // The Partner's corner (west, near the Partner): a camp of crates, barrels and a tent.
  { id: "tent", model: "tent", x: -13, y: 0, z: 20, yaw: 0.6, scale: 6, solid: 1.9 },
  { id: "weaponrack", model: "weaponrack", x: -11, y: 0, z: 13.5, yaw: 0.9, scale: 6, solid: 0.8 },
  { id: "barrel-camp", model: "barrel", x: -4, y: 0, z: 21.5, yaw: 0, scale: 6, solid: 0.65 },
  { id: "crate-camp", model: "crate_A_big", x: -10, y: 0, z: 23.5, yaw: 0.3, scale: 6, solid: 0.8 },
  { id: "crate-small", model: "crate_B_small", x: -8.5, y: 0, z: 24.5, yaw: -0.4, scale: 6, solid: 0.55 },
  { id: "sack-camp", model: "sack", x: -12.5, y: 0, z: 16, yaw: 0.2, scale: 8, solid: 0.4 },
  // Beside the quest board.
  { id: "barrel-board", model: "barrel", x: 9, y: 0, z: 20.5, yaw: 0.5, scale: 6, solid: 0.65 },
  { id: "bucket", model: "bucket_water", x: 9.4, y: 0, z: 18.3, yaw: 0, scale: 7, solid: 0.4 },
  // The gate road: a wheelbarrow and two flags.
  { id: "wheelbarrow", model: "wheelbarrow", x: 7.5, y: 0, z: 27.5, yaw: -0.5, scale: 6, solid: 0.9 },
  { id: "flag-w", model: "flag_blue", x: -7, y: 0, z: 27, yaw: 0, scale: 7, solid: 0.3 },
  { id: "flag-e", model: "flag_yellow", x: 11, y: 0, z: 25, yaw: 0, scale: 7, solid: 0.3 },
];

/** Smallest gap a standing piece keeps from a pad, the keep, a person or the spawn point. */
export const SCENERY_CLEARANCE = 2.5;
