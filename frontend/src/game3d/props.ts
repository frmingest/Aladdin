/**
 * Courtyard props (game3d, week 5): the fountain, lamps, quest board and raven perch.
 * Pure data and maths, no three.js. They are decoration: where they stand and how they
 * look never depends on any holding, and none of them carries a fact.
 */
import type { Art3dId } from "./artManifest3d";

export interface Prop {
  id: string;
  art: Art3dId;
  x: number;
  z: number;
  /** World height of the picture, in the same units as the walls (hero is about 1.8). */
  height: number;
  /** Radius of the solid base you walk round; 0 for no collider. */
  solid: number;
}

export const PROPS: readonly Prop[] = [
  // Middle of the courtyard, on the way from the gate to the keep.
  { id: "fountain", art: "fountain", x: 0, z: 2, height: 3.9, solid: 2.1 },
  // Beside the gate road, so the first thing you see is light.
  { id: "lamp-gate-w", art: "lamp", x: -4.5, z: 29, height: 4, solid: 0.35 },
  { id: "lamp-gate-e", art: "lamp", x: 4.5, z: 29, height: 4, solid: 0.35 },
  // Either side of the fountain.
  { id: "lamp-mid-w", art: "lamp", x: -7, z: -1, height: 4, solid: 0.35 },
  { id: "lamp-mid-e", art: "lamp", x: 7, z: -1, height: 4, solid: 0.35 },
  // Just in front of where you arrive. The quest log panel says what it is for; the board is blank.
  { id: "board", art: "board", x: 5.5, z: 19, height: 3.7, solid: 1.5 },
  // Where the ravens would land, east of the fountain.
  { id: "perch", art: "perch", x: 13, z: 12, height: 3.3, solid: 0.5 },
];

/** Smallest gap, in world units, a prop keeps from a pad, the keep, a person or the spawn point. */
export const PROP_CLEARANCE = 2.5;
