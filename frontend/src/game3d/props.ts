/**
 * Courtyard props (game3d, week 5): the fountain, lamps, quest board and raven perch.
 * Pure data and maths, no three.js. They are decoration: where they stand and how they
 * look never depends on any holding, and none of them carries a fact.
 */
export type PropKind = "fountain" | "lamp" | "board" | "perch";

export interface Prop {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  /** Nominal height of the model, in the same units as the walls (hero is about 1.8). */
  height: number;
  /** Radius of the solid base you walk round; 0 for no collider. */
  solid: number;
}

export const PROPS: readonly Prop[] = [
  // Middle of the courtyard, on the way from the gate to the keep.
  { id: "fountain", kind: "fountain", x: 0, z: 3, height: 2.4, solid: 2.1 },
  // Beside the gate road, so the first thing you see is light.
  { id: "lamp-gate-w", kind: "lamp", x: -6.75, z: 43.5, height: 4, solid: 0.35 },
  { id: "lamp-gate-e", kind: "lamp", x: 6.75, z: 43.5, height: 4, solid: 0.35 },
  // Either side of the fountain.
  { id: "lamp-mid-w", kind: "lamp", x: -10.5, z: -1.5, height: 4, solid: 0.35 },
  { id: "lamp-mid-e", kind: "lamp", x: 10.5, z: -1.5, height: 4, solid: 0.35 },
  // Just in front of where you arrive. The quest log panel says what it is for; the board is blank.
  { id: "board", kind: "board", x: 8.25, z: 28.5, height: 3.4, solid: 1.5 },
  // Where the ravens would land, east of the fountain.
  { id: "perch", kind: "perch", x: 19.5, z: 18, height: 3.3, solid: 0.5 },
];

/** Smallest gap, in world units, a prop keeps from a pad, the keep, a person or the spawn point. */
export const PROP_CLEARANCE = 2.5;
