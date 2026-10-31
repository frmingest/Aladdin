/**
 * Townsfolk (S8): two more people who just stand there. Pure data, no three.js.
 * They have no dialogue, no name tag and no role in the data; where they stand never depends on a holding.
 * They are not in NPCS, so walking up to them opens nothing.
 */
export type TownId = "guard" | "scout";

export interface Townsperson {
  id: TownId;
  x: number;
  z: number;
  /** Yaw so the front faces the way they look. */
  facing: number;
  height: number;
}

export const TOWNSFOLK: readonly Townsperson[] = [
  // Beside the gate road, west side, looking up the road toward the fountain.
  { id: "guard", x: -3.8, z: 26.5, facing: Math.atan2(3.8, -26.5), height: 2.1 },
  // Near the quest board, looking at it.
  { id: "scout", x: 7.8, z: 16.4, facing: Math.atan2(-2.3, 2.6), height: 1.9 },
];
