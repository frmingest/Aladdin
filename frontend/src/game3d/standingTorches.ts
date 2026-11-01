/**
 * The four Standing torches (Standing 1, fourth added in Standing 3): one stands lit per level you hold, on the road ahead.
 * Pure data, no three.js. Decoration that shows one real fact (your level), so it is narrow:
 * the same warm flame for every level (never red or green), and only the count differs.
 * Level 0, or a Standing that could not be read, burns none: unknown never lights a torch.
 */
export interface StandingTorch {
  id: string;
  x: number;
  z: number;
}

/** West edge of the way from the spawn to the fountain, in view as you set off, clear of the camp and the gate road. */
export const STANDING_TORCHES: readonly StandingTorch[] = [
  { id: "standing-torch-1", x: -4.2, z: 30.6 },
  { id: "standing-torch-2", x: -4.2, z: 27.6 },
  { id: "standing-torch-3", x: -4.2, z: 24.6 },
  { id: "standing-torch-4", x: -4.2, z: 21.6 },
];

/** Radius of the post you walk round. */
export const STANDING_TORCH_SOLID = 0.3;

/** How many of the torches burn for a level. Anything unreadable burns none. */
export function litTorches(level: number | null | undefined): number {
  if (typeof level !== "number" || !Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(STANDING_TORCHES.length, Math.floor(level)));
}
