/**
 * The writing desk (Standing 2, 2026-10-31). Pure data and maths, no three.js and no React.
 * An open-air desk and a shelf stand west of the keep door. They are furniture: where they
 * stand never depends on a holding. The ONLY fact they carry is the number of books on the
 * shelf, and that comes from the journal, worked out fresh (one book per holding that has both
 * a reason and a wrong-if line). Nothing is stored.
 */
import { yawToward } from "./npcs";

/**
 * West of the keep door, a little nearer the door than the Vault chest (x = 6), because its reach is wider. It used to stand at x = -11.5, 4.6 from the tower pad at
 * (-15, -13.5): standing at its front put you inside that tower's door reach, so E took you into the library instead of
 * opening the desk (found in a browser, 2026-11-01). `desk.test.ts` now checks every door's reach.
 */
export const DESK = { x: -5.5, z: -16.5 } as const;
/** The desk faces the middle of the courtyard, like the people do. */
export const DESK_FACING = yawToward(DESK, { x: 0, z: 0 });
/** The shelf stands a little behind the desk, against the keep side. */
export const SHELF = { x: -8.2, z: -18.8 } as const;

export const DESK_RANGE = 4.2;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const DESK_LEAVE_RANGE = 5.6;

/** The shelf holds one book per pad, never more: eight. */
export const MAX_BOOKS = 8;
export const BOOKS_PER_ROW = 4;

export function nearDesk(pos: { x: number; z: number }, range: number = DESK_RANGE): boolean {
  return Math.hypot(DESK.x - pos.x, DESK.z - pos.z) <= range;
}

/** How many books stand on the shelf: one per written holding, capped at the shelf. */
export function bookCount(written: number): number {
  if (!Number.isFinite(written) || written <= 0) return 0;
  return Math.min(MAX_BOOKS, Math.floor(written));
}

export interface BookSlot {
  /** Position on the shelf: x across the front, y is the top of the board the book stands on. */
  x: number;
  y: number;
  /** A little height difference so the row reads as books, not blocks. Fixed per slot, never data. */
  h: number;
}

/** Fixed slots, filled from the bottom-left. */
export function bookSlots(count: number): BookSlot[] {
  const n = bookCount(count);
  const heights = [0.62, 0.7, 0.58, 0.66];
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / BOOKS_PER_ROW);
    const col = i % BOOKS_PER_ROW;
    return { x: -0.66 + col * 0.44, y: 0.25 + row * 1.0, h: heights[col] };
  });
}
