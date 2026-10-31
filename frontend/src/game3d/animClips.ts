/**
 * Which animation clip plays for what the character is doing. Pure, so it can be tested.
 * Clip names are from the KayKit Adventurers pack; a missing name falls back to Idle, then to the
 * first clip in the file, then to nothing.
 */

export interface Motion {
  moving: boolean;
  running: boolean;
}

export const CLIP = { idle: "Idle", walk: "Walking_A", run: "Running_A", cheer: "Cheer", cast: "Spellcasting" } as const;

/** The clip we want for this motion. With reduced motion the character holds Idle. */
export function wantedClip(motion: Motion, reducedMotion: boolean): string {
  if (reducedMotion || !motion.moving) return CLIP.idle;
  return motion.running ? CLIP.run : CLIP.walk;
}

/** The wanted clip if the file has it, else Idle, else the first clip, else null. */
export function resolveClip(wanted: string, available: readonly string[]): string | null {
  if (available.includes(wanted)) return wanted;
  if (available.includes(CLIP.idle)) return CLIP.idle;
  return available[0] ?? null;
}

/** Seconds to cross-fade between two clips. */
export const FADE_SECONDS = 0.2;

/** Seconds the quest-done cheer lasts. */
export const CHEER_SECONDS = 3;

/**
 * The clip for this moment. Reduced motion always holds Idle (no cheer, no casting).
 * Otherwise a cheer wins, then a held pose (the Oracle casting while he talks), then walk/run/idle.
 */
export function chooseClip(motion: Motion, reducedMotion: boolean, pose: string | null, cheering: boolean): string {
  if (reducedMotion) return CLIP.idle;
  if (cheering) return CLIP.cheer;
  if (pose) return pose;
  return wantedClip(motion, false);
}
