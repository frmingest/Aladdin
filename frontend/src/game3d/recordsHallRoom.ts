/**
 * The inside of the Hall of Records (3D sprint S18, last piece). Pure data and maths, no three.js and no React.
 *
 * One archive room: three bookcases on the north wall, one same-size book for each decision in the journal, and a
 * door in the south wall. A book's leather and letter come from the flat Hall's own `tomeFor` (so an "add" is the
 * same tan book in both places); a bookmark ribbon hangs from it when a review is owed; two small seals on its spine
 * show the 6- and 12-month reviews by SHAPE (whole disc = sealed, split disc = owed, empty ring = written), never by
 * colour alone. Nothing here grades a decision: a book looks the same whatever the price did since. Standing at the
 * shelves and pressing E opens the flat Hall of Records page in the world panel, which holds every fact in words.
 *
 * Local coordinates: x east, z south, y up, the room centred near the origin. The Town is not drawn while you are in
 * here, so the room sits at the origin without touching anything (like the Town Hall and the tower library).
 */
import { tomeFor } from "../lib/hall";
import type { Tome } from "../lib/hall";
import type { CapsuleState } from "../lib/capsules";
import type { DecisionRecord } from "../lib/types";
import type { Spot } from "./layout";
import { BUILDINGS, doorSpot } from "./townPlan";

export const ARCHIVE = { minX: -9, maxX: 9, minZ: -8, maxZ: 8, height: 6 } as const;
/** A closed pair of doors in the south wall; E beside it leads back out into the Town. */
export const ARCHIVE_DOOR = { x: 0, z: ARCHIVE.maxZ, width: 3.2 } as const;
/** Far enough in that the follow camera (about 6 behind) is still inside the south wall. */
export const ARCHIVE_SPAWN = { x: 0, y: 1.5, z: 3 } as const;
/** Camera yaw 0 puts the hero looking north, toward the shelves. */
export const ARCHIVE_YAW = 0;

/** The register route this room opens (a Town door, S15). */
export const RECORDS_ROUTE = "/fortress/records";

/** Every book is the same size: a decision is a decision, a big one is not a bigger book. */
export const BOOK = { w: 0.46, h: 0.74, d: 0.34 } as const;
export const BOOKCASE = { w: 5.2, h: 3.4, d: 0.7, z: ARCHIVE.minZ + 0.5 } as const;
/** Three bookcases side by side on the north wall. */
export const BOOKCASE_XS = [-6, 0, 6] as const;
/** Two rows of books in each case, low then high. */
export const ROW_YS = [1.0, 2.2] as const;
export const BOOKS_PER_ROW = 6;
export const CAPACITY = BOOKCASE_XS.length * ROW_YS.length * BOOKS_PER_ROW;

export const SHELF_RANGE = 3.6;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const SHELF_LEAVE_RANGE = 4.8;
export const ARCHIVE_DOOR_RANGE = 3.4;
export const ARCHIVE_DOOR_LEAVE_RANGE = 4.6;
/** Where you stand to read the shelves: in front of the middle case. */
export const SHELF_SPOT: Spot = { x: 0, z: ARCHIVE.minZ + 4 };

export const shelfPrompt = "Press E at the shelves to read the Hall of Records";
export const archiveDoorPrompt = "Press E to go back out into the Town";

export interface BookPlan {
  id: string;
  /** Position of the book's centre, in the room. */
  x: number;
  y: number;
  z: number;
  tome: Tome;
}

/** Where book number `i` (0 = first) stands: case by case, low row then high row, left to right. */
export function bookSlot(i: number): { x: number; y: number; z: number } {
  const perCase = ROW_YS.length * BOOKS_PER_ROW;
  const c = Math.floor(i / perCase);
  const inCase = i % perCase;
  const row = Math.floor(inCase / BOOKS_PER_ROW);
  const col = inCase % BOOKS_PER_ROW;
  const gap = 0.06;
  const rowW = BOOKS_PER_ROW * BOOK.w + (BOOKS_PER_ROW - 1) * gap;
  const x = BOOKCASE_XS[c] - rowW / 2 + BOOK.w / 2 + col * (BOOK.w + gap);
  return { x, y: ROW_YS[row] + BOOK.h / 2, z: BOOKCASE.z + 0.05 };
}

/** One same-size book for each record, in the flat Hall's own order, as many as the shelves hold. */
export function bookPlans(records: readonly DecisionRecord[], capacity: number = CAPACITY): BookPlan[] {
  return records.slice(0, capacity).map((r, i) => ({ id: r.id, ...bookSlot(i), tome: tomeFor(r) }));
}

export interface ShelfFacts {
  /** All decisions in the journal. */
  total: number;
  /** Books on the shelves. */
  shown: number;
  /** Decisions that did not fit: counted, not drawn. */
  more: number;
  /** Books wearing a ribbon (a review is owed). */
  owed: number;
}

export function shelfFacts(records: readonly DecisionRecord[], capacity: number = CAPACITY): ShelfFacts {
  const shown = Math.min(records.length, capacity);
  return {
    total: records.length,
    shown,
    more: records.length - shown,
    owed: records.slice(0, shown).filter((r) => tomeFor(r).owed).length,
  };
}

/** The words on the plate over the shelves: short and playful, numbers exact. Unknown (not read yet) says nothing extra. */
export function shelfPlate(facts: ShelfFacts | null): string[] {
  if (facts === null) return ["The Hall of Records"];
  if (facts.total === 0) return ["The Hall of Records", "No books yet. Write a decision at the desk."];
  const lines = ["The Hall of Records", `${facts.total} ${facts.total === 1 ? "decision" : "decisions"} on the shelves`];
  if (facts.owed > 0) lines.push(`${facts.owed} ${facts.owed === 1 ? "book wears" : "books wear"} a ribbon: a look-back is owed`);
  if (facts.more > 0) lines.push(`${facts.more} more in the page`);
  return lines;
}

/** The shape of a seal, in words, for the plate and the tests: the same three words the flat Hall prints. */
export const SEAL_SHAPE_OF: Record<CapsuleState, "disc" | "split" | "ring"> = { sealed: "disc", unsealed: "split", opened: "ring" };

export function nearShelves(pos: { x: number; z: number }, range: number = SHELF_RANGE): boolean {
  return Math.hypot(SHELF_SPOT.x - pos.x, SHELF_SPOT.z - pos.z) <= range;
}

export function nearArchiveDoor(pos: { x: number; z: number }, range: number = ARCHIVE_DOOR_RANGE): boolean {
  return Math.hypot(ARCHIVE_DOOR.x - pos.x, ARCHIVE_DOOR.z - pos.z) <= range;
}

/** Where the hero stands in the Town, and the camera yaw, when stepping out of the Hall of Records door. */
export function archiveExit(): { x: number; z: number; yaw: number } {
  const b = BUILDINGS.find((x) => x.id === "records");
  if (!b) return { x: 0, z: 0, yaw: 0 };
  const s = doorSpot(b);
  // Same convention as stepping out of a tower: the camera sits on the building's side, so the hero looks away from it.
  return { x: s.x, z: s.z, yaw: Math.atan2(b.x - s.x, b.z - s.z) };
}
