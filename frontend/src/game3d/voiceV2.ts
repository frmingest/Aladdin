/**
 * Shared game-voice words (version 2, 2026-11-03), from the 3D text review (`docs/game/game3d-text-review-2026-11-03.md`).
 * One phrase per idea, used by every 3D panel. A wording that could be shown for real changes in a NEW version file.
 */

/** One phrase for a failed save, in every panel. The server's own message goes in a hover, never on the face. */
export const SAVE_FAILED = "Couldn't save that.";

/** One phrase for a failed read: "Can't read your journal right now." */
export const readFailed = (what: string): string => `Can't read ${what} right now.`;

/** Adds the closing full stop only when the text has none (backend facts often end with one already). */
export function withStop(text: string): string {
  const t = text.trimEnd();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}
