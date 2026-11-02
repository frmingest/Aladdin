/**
 * The tower library room (game3d, 2026-11-01). Pure data and maths, no three.js and no React.
 *
 * One hall, the same for every holding: furniture never depends on a fact. Seven shelf bays stand against
 * the walls, a closed door is in the south wall. Local coordinates: x east, z south, y up, the hall
 * centred near the origin. The courtyard is not drawn while you are in here, so the room can sit at the
 * origin without touching anything.
 */
import type { Spot } from "./layout";
import { SHELF_ORDER, type ShelfId } from "./libraryShelves";

export const HALL = { minX: -11, maxX: 11, minZ: -10, maxZ: 9, height: 7 } as const;
/** The door is a closed pair of doors in the south wall; E beside it leads back out. */
export const HALL_DOOR = { x: 0, z: HALL.maxZ, width: 3.2 } as const;
/** Far enough into the hall that the follow camera (about 6 behind) is still inside the south wall. */
export const ROOM_SPAWN = { x: -3.4, y: 1.5, z: 2.2 } as const;

/** The reading table in the middle: you stand on its south side to open the latest report. */
export const TABLE = { x: 0, z: -1, hx: 1.15, hz: 0.6 } as const;
export const TABLE_SPOT = { x: 0, z: 0.9 } as const;
export const TABLE_RANGE = 2.4;
export const TABLE_LEAVE_RANGE = 3.4;
/** Camera yaw that puts the hero looking north (toward the shelves) on arrival. */
export const ROOM_YAW = 0;

export interface ShelfSlot {
  id: ShelfId;
  /** Centre of the bay on the floor. */
  x: number;
  z: number;
  /** Yaw so the bay's front (local +z) faces into the room. */
  yaw: number;
}

const BAY_DEPTH_CENTRE = 0.55;
const NORTH_Z = HALL.minZ + BAY_DEPTH_CENTRE;
const WEST_X = HALL.minX + BAY_DEPTH_CENTRE;
const EAST_X = HALL.maxX - BAY_DEPTH_CENTRE;

/** Three bays on the north wall (the Council's words in the middle), two on each side wall. Order matches SHELF_ORDER. */
export const SHELF_SLOTS: readonly ShelfSlot[] = [
  { id: SHELF_ORDER[0], x: -5.5, z: NORTH_Z, yaw: 0 },
  { id: SHELF_ORDER[1], x: 5.5, z: NORTH_Z, yaw: 0 },
  { id: SHELF_ORDER[2], x: WEST_X, z: -4, yaw: Math.PI / 2 },
  { id: SHELF_ORDER[3], x: EAST_X, z: -4, yaw: -Math.PI / 2 },
  { id: SHELF_ORDER[4], x: WEST_X, z: 3, yaw: Math.PI / 2 },
  { id: SHELF_ORDER[5], x: EAST_X, z: 3, yaw: -Math.PI / 2 },
  { id: SHELF_ORDER[6], x: 0, z: NORTH_Z, yaw: 0 },
];

export const SHELF_RANGE = 3.2;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const SHELF_LEAVE_RANGE = 4.4;
export const DOOR_RANGE = 3.4;
export const DOOR_LEAVE_RANGE = 4.6;

/** Where you stand to read a bay: 1.6 in front of it. */
export function readingSpot(s: ShelfSlot): Spot {
  return { x: s.x + Math.sin(s.yaw) * 1.6, z: s.z + Math.cos(s.yaw) * 1.6 };
}

export function nearestShelf(
  pos: { x: number; z: number },
  slots: readonly ShelfSlot[] = SHELF_SLOTS,
  range: number = SHELF_RANGE,
): ShelfSlot | null {
  let best: ShelfSlot | null = null;
  let bestD = Infinity;
  for (const s of slots) {
    const p = readingSpot(s);
    const d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d <= range && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function nearTable(pos: { x: number; z: number }, range: number = TABLE_RANGE): boolean {
  return Math.hypot(TABLE_SPOT.x - pos.x, TABLE_SPOT.z - pos.z) <= range;
}

export function nearDoor(pos: { x: number; z: number }, range: number = DOOR_RANGE): boolean {
  return Math.hypot(HALL_DOOR.x - pos.x, HALL_DOOR.z - pos.z) <= range;
}
