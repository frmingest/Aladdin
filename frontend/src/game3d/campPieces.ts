/**
 * The Storm Drill camp of the 3D courtyard (S10, 2026-11-01): two catapults, ladders, targets, a tent, a weapon
 * rack and two flags in the south-west, on the ground that was held for the siege simulator. KayKit Medieval
 * Hexagon pieces (CC0, see public/models/CREDITS.md). Pure data, no three.js.
 *
 * It only stands while a drill is open (you start one at the drill post), so a calm fortress never looks besieged
 * and a drill never looks like a real attack. It is the SAME size whatever fall you set: no piece carries a fact
 * (decision of 2026-10-31, version 1). Blue, yellow and neutral pieces only; no red or green. If camp.glb fails to
 * load, the drill still works and there is simply no camp.
 */
export const CAMP_URL = "/models/camp.glb";

/** Node names inside camp.glb. */
export type CampModel =
  | "catapult"
  | "catapult_yellow"
  | "catapult_ball"
  | "ladder"
  | "target"
  | "tent"
  | "weaponrack"
  | "flag_blue"
  | "flag_yellow";

export interface CampPiece {
  id: string;
  model: CampModel;
  x: number;
  z: number;
  /** Turn about the vertical axis, radians. 0 faces south (towards the gate). */
  yaw: number;
  scale: number;
  /** Radius of the solid base you walk round; 0 for no collider (small or thin things). */
  solid: number;
}

/** The middle of the camp. The old reserved zone was centred at (-31.5, 13.5). */
export const CAMP_CENTER = { x: -33, z: 13 } as const;
export const CAMP_REACH = 8;

const EAST = Math.PI / 2;

export const CAMP: readonly CampPiece[] = [
  // Two catapults, one blue and one yellow, aimed east at the courtyard.
  { id: "camp-catapult-blue", model: "catapult", x: -31, z: 9.8, yaw: EAST, scale: 1.8, solid: 1.1 },
  { id: "camp-catapult-yellow", model: "catapult_yellow", x: -31, z: 16.8, yaw: EAST, scale: 1.8, solid: 1.1 },
  { id: "camp-ball-a", model: "catapult_ball", x: -29.7, z: 10.9, yaw: 0, scale: 4, solid: 0 },
  { id: "camp-ball-b", model: "catapult_ball", x: -29.5, z: 15.6, yaw: 0, scale: 4, solid: 0 },
  // Two ladders stood ready between them.
  { id: "camp-ladder-a", model: "ladder", x: -28.6, z: 11.6, yaw: 1.2, scale: 3.6, solid: 0.5 },
  { id: "camp-ladder-b", model: "ladder", x: -28.2, z: 14.6, yaw: 1.9, scale: 3.6, solid: 0.5 },
  // Three targets behind the catapults, facing them.
  { id: "camp-target-a", model: "target", x: -35.5, z: 10.2, yaw: EAST, scale: 4, solid: 0.5 },
  { id: "camp-target-b", model: "target", x: -36.5, z: 13, yaw: EAST, scale: 4, solid: 0.5 },
  { id: "camp-target-c", model: "target", x: -35.5, z: 15.8, yaw: EAST, scale: 4, solid: 0.5 },
  // Where the crew sleeps and keeps its spears.
  { id: "camp-tent", model: "tent", x: -38.5, z: 8.5, yaw: 0.4, scale: 4.2, solid: 1.3 },
  { id: "camp-rack", model: "weaponrack", x: -37, z: 17.6, yaw: 0.2, scale: 4, solid: 0.6 },
  { id: "camp-flag-blue", model: "flag_blue", x: -29.4, z: 8.2, yaw: 0, scale: 5, solid: 0 },
  { id: "camp-flag-yellow", model: "flag_yellow", x: -29.4, z: 17.8, yaw: 0, scale: 5, solid: 0 },
];
