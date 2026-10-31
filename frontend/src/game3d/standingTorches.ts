/**
 * The three Standing torches (Standing 1): one stands lit per level you hold, by the gate road.
 * Pure data, no three.js. Decoration that shows one real fact (your level), so it is narrow:
 * the same warm flame for every level (never red or green), and only the count differs.
 * Level 0, or a Standing that could not be read, burns none: unknown never lights a torch.
 */
export interface StandingTorch {
  id: string;
  x: number;
  z: number;
}

/** East side of the gate road, a few steps in front of the spawn point, clear of the gate lamp. */
export const STANDING_TORCHES: readonly StandingTorch[] = [
  { id: "standing-torch-1", x: 4.3, z: 24.2 },
  { id: "standing-torch-2", x: 4.3, z: 25.8 },
  { id: "standing-torch-3", x: 4.3, z: 27.4 },
];

/** Radius of the post you walk round. */
export const STANDING_TORCH_SOLID = 0.3;

/** How many of the torches burn for a level. Anything unreadable burns none. */
export function litTorches(level: number | null | undefined): number {
  if (typeof level !== "number" || !Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(STANDING_TORCHES.length, Math.floor(level)));
}
