/**
 * The key-hint line at the bottom of the courtyard (C2, Clear the screen). It teaches the controls, so it
 * shows on the first few visits only; after that the scene stays clear. Pure helpers, no React. Storage can be
 * missing or throw (private windows), so every read and write is guarded: with no storage the hint simply
 * shows, as it did before.
 */

/** How many visits show the hint. The fourth visit onward is clear. */
export const HINT_VISITS = 3;

const STORAGE_KEY = "aladdin.game3d.visits.v1";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** True while the hint should still show for this visit number (1 for the first). */
export function hintWanted(visit: number): boolean {
  return visit <= HINT_VISITS;
}

/** Count this visit and return its number. Without storage every visit counts as the first. */
export function countVisit(store: Store | null = browserStore()): number {
  try {
    const raw = Number(store?.getItem(STORAGE_KEY));
    const visit = (Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0) + 1;
    store?.setItem(STORAGE_KEY, String(visit));
    return visit;
  } catch {
    return 1;
  }
}

/** The controls the toolbar does not already show. (Q, T and G are on the toolbar buttons.) */
export const HINT_TEXT = "Click to look around · W A S D walk · Shift run · Space jump · Wheel zoom · Esc frees the mouse";
