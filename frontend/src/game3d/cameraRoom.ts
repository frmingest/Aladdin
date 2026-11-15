/**
 * The camera stops at walls (#411). Pure maths, no three.js and no React.
 *
 * Indoors the follow camera used to drift out through the wall behind you and look back in. Now, in a room, it is
 * pulled in along its own line of sight until it sits just inside the walls and under the ceiling: the same view,
 * only closer. Outdoors nothing changes.
 */
import type { AreaId } from "./areas";
import { INTERIOR_BOX } from "./interiorBox";
import { ARCHIVE } from "./recordsHallRoom";
import { TOWER } from "./weatherTowerRoom";

/** The inside of a room: its walls, its floor at 0 and its ceiling at `height`. */
export interface CameraRoom {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** The rooms with walls round them. Every other place is open ground and leaves the camera alone. */
export const CAMERA_ROOMS: Partial<Record<AreaId, CameraRoom>> = {
  townhall: INTERIOR_BOX,
  records: ARCHIVE,
  weather: TOWER,
};

export function cameraRoomOf(area: AreaId): CameraRoom | null {
  return CAMERA_ROOMS[area] ?? null;
}

/**
 * How far the camera stays off a wall, the floor and the ceiling. Just under the hero's own half-width (0.35), so the
 * point it looks at is always inside; and clear of the door leaves, which stand 0.23 into the room.
 */
export const CAMERA_WALL_GAP = 0.34;
/** With her back flat against a wall the camera comes in to her own head, never past it (and never to exactly nothing, so it still knows which way it looks). */
const LEAST_PULL = 0.001;

/** Closer than this the hero would fill the view (or the camera would sit inside her), so she is not drawn: you see the room over her shoulder instead. */
export const CAMERA_HIDE_HERO_WITHIN = 1.2;

type Vec3 = readonly [number, number, number];

/**
 * How much of the way out to its usual spot the camera may go: 1 when that spot is inside the room, less when a wall,
 * the floor or the ceiling is in the way. `focus` is the point on the hero the camera looks at; `offset` is the
 * camera's usual place measured from it.
 */
export function cameraPull(focus: Vec3, offset: Vec3, room: CameraRoom, gap: number = CAMERA_WALL_GAP): number {
  const lo: Vec3 = [room.minX + gap, gap, room.minZ + gap];
  const hi: Vec3 = [room.maxX - gap, room.height - gap, room.maxZ - gap];
  let t = 1;
  for (let i = 0; i < 3; i++) {
    const o = offset[i];
    if (o > 0) t = Math.min(t, (hi[i] - focus[i]) / o);
    else if (o < 0) t = Math.min(t, (lo[i] - focus[i]) / o);
  }
  return Math.max(LEAST_PULL, Math.min(1, t));
}
