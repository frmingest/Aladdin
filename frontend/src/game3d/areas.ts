/**
 * The map of places (S21). Pure data and maths, no three.js and no React.
 *
 * Every place you can stand in (the courtyard, the Town, the Town Hall (its door is on the meadow outside the gate), the Hall of Records, the Weather Tower, a holding's land)
 * is one entry here: where you arrive, where its doors are, how it is lit and where "leave" takes you. The numbers
 * are NOT new: each entry points at the spawn, door and exit constants that already live in the room modules, so
 * adding this list moved nothing. `siege` is the Siege Field (asset plan A5) and `quarter` the Market Quarter (A6). A tower door now leads to that holding's
 * own land (S25); the shared library room it used to open is no longer a place.
 */
import { HORIZON_LIMIT } from "./horizonPieces";
import { INTERIOR_BOX } from "./interiorBox";
import { GATE_LEAVE_RANGE as LAND_GATE_LEAVE_RANGE, GATE_RANGE as LAND_GATE_RANGE, LAND_GATE, LAND_SPAWN, MIN_LAND_RADIUS } from "./holdingLand";
import { HALL_DOOR, HALL_DOOR_LEAVE_RANGE, HALL_DOOR_RANGE, HALL_SPAWN, HALL_YAW, hallExit } from "./townHallRoom";
import { TOWN_HALL_GATE, TOWN_HALL_GATE_LEAVE_RANGE, TOWN_HALL_GATE_RANGE } from "./townHallOutside";
import {
  ARCHIVE,
  ARCHIVE_DOOR,
  ARCHIVE_DOOR_LEAVE_RANGE,
  ARCHIVE_DOOR_RANGE,
  ARCHIVE_SPAWN,
  ARCHIVE_YAW,
  archiveExit,
} from "./recordsHallRoom";
import {
  TOWER,
  TOWER_DOOR,
  TOWER_DOOR_LEAVE_RANGE,
  TOWER_DOOR_RANGE,
  TOWER_SPAWN,
  TOWER_YAW,
  towerExit,
} from "./weatherTowerRoom";
import {
  BUILDINGS,
  DOOR_LEAVE_RANGE as BUILDING_DOOR_LEAVE_RANGE,
  DOOR_RANGE as BUILDING_DOOR_RANGE,
  EXIT_LEAVE_RANGE,
  EXIT_RANGE,
  GATE_LEAVE_RANGE,
  GATE_RANGE,
  GATE_RETURN,
  GATE_RETURN_YAW,
  GATE_SPOT,
  TOWN_EXIT,
  TOWN_RADIUS,
  TOWN_SPAWN,
  TOWN_YAW,
  doorSpot,
} from "./townPlan";
import { exitCameraYaw, exitSpot, outdoorExit } from "./towerDoor";
import {
  FIELD_EXIT,
  FIELD_EXIT_LEAVE_RANGE,
  FIELD_EXIT_RANGE,
  FIELD_RADIUS,
  FIELD_SPAWN,
  SIEGE_GATE,
  SIEGE_GATE_LEAVE_RANGE,
  SIEGE_GATE_RANGE,
  SIEGE_GATE_RETURN,
  SIEGE_GATE_RETURN_YAW,
} from "./siegeField";
import {
  QUARTER_EXIT,
  QUARTER_EXIT_LEAVE_RANGE,
  QUARTER_EXIT_RANGE,
  QUARTER_GATE,
  QUARTER_GATE_LEAVE_RANGE,
  QUARTER_GATE_RANGE,
  QUARTER_GATE_RETURN,
  QUARTER_GATE_RETURN_YAW,
  QUARTER_RADIUS,
  QUARTER_SPAWN,
} from "./quarterPlan";
import type { Enterable } from "./towerDoor";

/** Where the lights come from. Never from a verdict: nothing flatters a weak tower. */
export type LightingId = "outdoor" | "indoor";

/** The places that exist today. */
export type AreaRef =
  | { id: "courtyard" }
  | { id: "town" }
  | { id: "townhall" }
  | { id: "records" }
  | { id: "weather" }
  | { id: "siege" }
  | { id: "quarter" }
  | { id: "holding"; holdingId: string };

export type AreaId = AreaRef["id"];

/** Names held back for later sprints. None now: the Market Quarter became the place `quarter` (asset plan A6). */
export const RESERVED_AREA_IDS: readonly string[] = [];

export interface AreaBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AreaDoor {
  id: string;
  x: number;
  z: number;
  /** Near enough to be offered. */
  range: number;
  /** Still counted near once offered (wider, so standing on the edge does not flicker). */
  leaveRange: number;
  /** Where it leads: an area id, or "parent" for the way you came. */
  to: AreaId | "parent";
}

export interface AreaDef {
  id: AreaId;
  /** Where "leave" goes. The courtyard has none. */
  parent: AreaId | null;
  kind: "outdoor" | "indoor";
  lighting: LightingId;
  /** The ground you can walk on. */
  bounds: AreaBox;
  /** Where you stand on arriving from the parent (or, for the courtyard, from the Town). */
  spawn: { x: number; z: number; yaw: number };
  doors: readonly AreaDoor[];
}

const circleBox = (r: number): AreaBox => ({ minX: -r, maxX: r, minZ: -r, maxZ: r });
const insideBox = (b: AreaBox): AreaBox => ({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ });

const buildingDoor = (id: "records" | "weather"): AreaDoor => {
  const b = BUILDINGS.find((x) => x.id === id);
  const s = b ? doorSpot(b) : { x: 0, z: 0 };
  return { id, x: s.x, z: s.z, range: BUILDING_DOOR_RANGE, leaveRange: BUILDING_DOOR_LEAVE_RANGE, to: id };
};

export const AREAS: Record<AreaId, AreaDef> = {
  courtyard: {
    id: "courtyard",
    parent: null,
    kind: "outdoor",
    lighting: "outdoor",
    // The walled courtyard and the meadow round it (the holdings and the Town Hall stand out there), out to where the horizon begins.
    bounds: circleBox(HORIZON_LIMIT),
    spawn: { x: GATE_RETURN.x, z: GATE_RETURN.z, yaw: GATE_RETURN_YAW },
    // Tower doors stand wherever the towers do (see towerDoor.ts); the gate is the one fixed door.
    doors: [
      { id: "gate", x: GATE_SPOT.x, z: GATE_SPOT.z, range: GATE_RANGE, leaveRange: GATE_LEAVE_RANGE, to: "town" },
      { id: "siege", x: SIEGE_GATE.x, z: SIEGE_GATE.z, range: SIEGE_GATE_RANGE, leaveRange: SIEGE_GATE_LEAVE_RANGE, to: "siege" },
      { id: "quarter", x: QUARTER_GATE.x, z: QUARTER_GATE.z, range: QUARTER_GATE_RANGE, leaveRange: QUARTER_GATE_LEAVE_RANGE, to: "quarter" },
      // The Town Hall stands on the meadow just outside the gate; its door leads straight in (2026-11-10).
      { id: "townhall", x: TOWN_HALL_GATE.x, z: TOWN_HALL_GATE.z, range: TOWN_HALL_GATE_RANGE, leaveRange: TOWN_HALL_GATE_LEAVE_RANGE, to: "townhall" },
    ],
  },
  town: {
    id: "town",
    parent: "courtyard",
    kind: "outdoor",
    lighting: "outdoor",
    bounds: circleBox(TOWN_RADIUS),
    spawn: { x: TOWN_SPAWN.x, z: TOWN_SPAWN.z, yaw: TOWN_YAW },
    doors: [
      { id: "exit", x: TOWN_EXIT.x, z: TOWN_EXIT.z, range: EXIT_RANGE, leaveRange: EXIT_LEAVE_RANGE, to: "parent" },
      buildingDoor("records"),
      buildingDoor("weather"),
    ],
  },
  townhall: {
    id: "townhall",
    parent: "courtyard",
    kind: "indoor",
    lighting: "indoor",
    bounds: insideBox(INTERIOR_BOX),
    spawn: { x: HALL_SPAWN.x, z: HALL_SPAWN.z, yaw: HALL_YAW },
    doors: [{ id: "door", x: HALL_DOOR.x, z: HALL_DOOR.z, range: HALL_DOOR_RANGE, leaveRange: HALL_DOOR_LEAVE_RANGE, to: "parent" }],
  },
  records: {
    id: "records",
    parent: "town",
    kind: "indoor",
    lighting: "indoor",
    bounds: insideBox(ARCHIVE),
    spawn: { x: ARCHIVE_SPAWN.x, z: ARCHIVE_SPAWN.z, yaw: ARCHIVE_YAW },
    doors: [
      { id: "door", x: ARCHIVE_DOOR.x, z: ARCHIVE_DOOR.z, range: ARCHIVE_DOOR_RANGE, leaveRange: ARCHIVE_DOOR_LEAVE_RANGE, to: "parent" },
    ],
  },
  weather: {
    id: "weather",
    parent: "town",
    kind: "indoor",
    lighting: "indoor",
    bounds: insideBox(TOWER),
    spawn: { x: TOWER_SPAWN.x, z: TOWER_SPAWN.z, yaw: TOWER_YAW },
    doors: [{ id: "door", x: TOWER_DOOR.x, z: TOWER_DOOR.z, range: TOWER_DOOR_RANGE, leaveRange: TOWER_DOOR_LEAVE_RANGE, to: "parent" }],
  },
  siege: {
    id: "siege",
    parent: "courtyard",
    kind: "outdoor",
    lighting: "outdoor",
    bounds: circleBox(FIELD_RADIUS),
    spawn: { x: FIELD_SPAWN.x, z: FIELD_SPAWN.z, yaw: FIELD_SPAWN.yaw },
    doors: [{ id: "exit", x: FIELD_EXIT.x, z: FIELD_EXIT.z, range: FIELD_EXIT_RANGE, leaveRange: FIELD_EXIT_LEAVE_RANGE, to: "parent" }],
  },
  quarter: {
    id: "quarter",
    parent: "courtyard",
    kind: "outdoor",
    lighting: "outdoor",
    bounds: circleBox(QUARTER_RADIUS),
    spawn: { x: QUARTER_SPAWN.x, z: QUARTER_SPAWN.z, yaw: QUARTER_SPAWN.yaw },
    doors: [{ id: "exit", x: QUARTER_EXIT.x, z: QUARTER_EXIT.z, range: QUARTER_EXIT_RANGE, leaveRange: QUARTER_EXIT_LEAVE_RANGE, to: "parent" }],
  },
  holding: {
    id: "holding",
    parent: "courtyard",
    kind: "outdoor",
    lighting: "outdoor",
    // The smallest land: every land is at least this big, and the ground only grows with the size class.
    bounds: circleBox(MIN_LAND_RADIUS),
    spawn: { x: LAND_SPAWN.x, z: LAND_SPAWN.z, yaw: LAND_SPAWN.yaw },
    doors: [{ id: "gate", x: LAND_GATE.x, z: LAND_GATE.z, range: LAND_GATE_RANGE, leaveRange: LAND_GATE_LEAVE_RANGE, to: "parent" }],
  },
};

export const COURTYARD: AreaRef = { id: "courtyard" };

export function areaDef(ref: AreaRef): AreaDef {
  return AREAS[ref.id];
}

export function sameArea(a: AreaRef, b: AreaRef): boolean {
  if (a.id !== b.id) return false;
  return a.id === "holding" && b.id === "holding" ? a.holdingId === b.holdingId : true;
}

/** The place "leave" takes you to, or null at the courtyard. A holding's land has the courtyard as its parent. */
export function parentOf(ref: AreaRef): AreaRef | null {
  const p = AREAS[ref.id].parent;
  return p === null ? null : { id: p as Exclude<AreaId, "holding"> };
}

export interface Arrival {
  x: number;
  z: number;
  yaw: number;
}

/** Where the hero stands on stepping back out of `from` into `to` (its parent). Null when it cannot be worked out. */
export function returnSpot(from: AreaRef, to: AreaRef, towers: readonly Enterable[]): Arrival | null {
  if (from.id === "holding" && to.id === "courtyard") {
    const t = towers.find((w) => w.holdingId === from.holdingId);
    if (!t) return null;
    const out = t.outdoorDoorYaw !== undefined ? outdoorExit(t.spot, t.outdoorDoorYaw, t.radius) : exitSpot(t.spot, t.radius);
    return { x: out.x, z: out.z, yaw: exitCameraYaw(t.spot, out) };
  }
  if (from.id === "town" && to.id === "courtyard") return { x: GATE_RETURN.x, z: GATE_RETURN.z, yaw: GATE_RETURN_YAW };
  if (from.id === "siege" && to.id === "courtyard") return { x: SIEGE_GATE_RETURN.x, z: SIEGE_GATE_RETURN.z, yaw: SIEGE_GATE_RETURN_YAW };
  if (from.id === "quarter" && to.id === "courtyard") return { x: QUARTER_GATE_RETURN.x, z: QUARTER_GATE_RETURN.z, yaw: QUARTER_GATE_RETURN_YAW };
  if (from.id === "townhall" && to.id === "courtyard") return hallExit();
  if (from.id === "records" && to.id === "town") return archiveExit();
  if (from.id === "weather" && to.id === "town") return towerExit();
  return null;
}

/** Where the hero is put when the area changes from `from` to `to`: out through the parent door, or in at the spawn. */
export function transitionSpot(from: AreaRef, to: AreaRef, towers: readonly Enterable[]): Arrival | null {
  if (sameArea(from, to)) return null;
  if (AREAS[from.id].parent === to.id) return returnSpot(from, to, towers);
  return { ...AREAS[to.id].spawn };
}

/** Every area can walk back to the courtyard through its parents (no loops, no orphans). */
export function pathToCourtyard(id: AreaId): AreaId[] {
  const path: AreaId[] = [id];
  while (path[path.length - 1] !== "courtyard") {
    const p = AREAS[path[path.length - 1]].parent;
    if (p === null || path.includes(p)) return path;
    path.push(p);
  }
  return path;
}
