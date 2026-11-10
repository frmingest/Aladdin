/**
 * The Town (3D sprint S15; moved outside the gate 2026-11-10). Pure data and maths, no three.js and no React.
 *
 * It used to be a second zone behind a teleport: stand at the gate, press E, and the courtyard gave way to the Town. Now the
 * Town stands on the meadow just outside the gate: six finished KayKit Builder buildings (CC0, S9) in two rows either side of
 * the gate road, all facing it. Each one is the door to flat pages that are not stores: Records, Map, Codex, the Workshop's
 * pages, the Weather Tower (macro dials), and (Town Hall, S18) the big-picture pages of the main app. The buildings are
 * decoration; the facts stay in the panels, which are the flat pages themselves (S13). The Town Hall, the Hall of Records and
 * the Weather Tower open their own rooms (areas whose parent is the courtyard); the rest open a page in the world panel.
 *
 * Coordinates are the courtyard's: x east, z south, y up, the gate road at x 0 (6 wide, from the gate south). A building's yaw 0
 * faces south (like the market pieces); its front is local +z. Buildings are centred on their own origin (measured, S15).
 */
import { REGISTER } from "./parity3d";
import type { Door, PlaceId } from "./parity3d";
import { TOWN_SCALE } from "./townPieces";
import { WALL_RADIUS } from "./layout";

/** The gate road inside the wall: the courtyard spawn is just in from it, out of every reach. */
export const GATE_SPOT = { x: 0, z: WALL_RADIUS - 4 } as const;
export const GATE_RANGE = 4.5;
export const GATE_LEAVE_RANGE = 6;
/** Where the hero comes back out in the courtyard: inside the gate, out of the gate road's reach. */
export const GATE_RETURN = { x: 0, z: GATE_SPOT.z - GATE_LEAVE_RANGE - 1 } as const;
/** Camera yaw 0 looks north into the courtyard. */
export const GATE_RETURN_YAW = 0;

export type BuildingId = "records" | "cartographer" | "archive" | "workshop" | "townhall" | "weather";

export interface Building {
  id: BuildingId;
  /** Node name inside town-buildings.glb. */
  model: "castle" | "watchtower" | "house" | "lumbermill" | "market";
  /** The word on the sign over the door. */
  label: string;
  x: number;
  z: number;
  yaw: number;
  /** Half the drawn footprint in the building's own frame (so it turns with the yaw), already scaled and trimmed. */
  hx: number;
  hz: number;
  /** Drawn height, for the sign. */
  height: number;
  /** One page: its route in the register. Several pages: the place whose menu opens. */
  opens: { route: string } | { place: PlaceId };
}

/** Native sizes of the four models (width, height, depth), measured from town-buildings.glb. */
const NATIVE = {
  castle: { w: 1.8, h: 2.53, d: 1.85 },
  watchtower: { w: 0.97, h: 1.98, d: 1.71 },
  house: { w: 1.69, h: 0.91, d: 1.66 },
  lumbermill: { w: 1.82, h: 1.47, d: 1.66 },
  market: { w: 1.47, h: 0.86, d: 1.67 },
} as const;

const K = TOWN_SCALE.builder;

/** One building's record: its footprint comes from the model's measured size. Exported so the Town Hall outside the gate is made the same way. */
export function building(
  id: BuildingId,
  model: Building["model"],
  label: string,
  x: number,
  z: number,
  yaw: number,
  opens: Building["opens"],
): Building {
  const n = NATIVE[model];
  return { id, model, label, x, z, yaw, hx: (n.w * K * 0.92) / 2, hz: (n.d * K * 0.92) / 2, height: n.h * K, opens };
}

/**
 * The six buildings, in two rows of three either side of the gate road, all facing it (rows at z 66, 79 and 92). West side,
 * from the gate out: Town Hall (the market hall), Cartographer (the watchtower), Weather Tower (a watchtower, macro dials). East
 * side: Archive (the house), Workshop (the lumber mill), Hall of Records (the castle, the big one at the far end). Proposed
 * models; a look decides (the plan's gate). The Town Hall's door stands where it first stood outside the gate (2026-11-10).
 */
export const BUILDINGS: readonly Building[] = [
  building("townhall", "market", "Town Hall", -12.5, 66, Math.PI / 2, { place: "townhall" }),
  building("cartographer", "watchtower", "Cartographer", -12.5, 79, Math.PI / 2, { route: "/fortress/map" }),
  // The Weather Tower opens as its own place (the Game page intercepts it, like the Hall of Records; the route is the fallback).
  building("weather", "watchtower", "Weather Tower", -12.5, 92, Math.PI / 2, { route: "/macro" }),
  building("archive", "house", "Archive", 12.5, 66, -Math.PI / 2, { route: "/glossary" }),
  building("workshop", "lumbermill", "Workshop", 12.5, 79, -Math.PI / 2, { place: "workshop" }),
  building("records", "castle", "Hall of Records", 12.5, 92, -Math.PI / 2, { route: "/fortress/records" }),
];

/** Extra clear ground round a building, so the door mat in front of it is not planted over. */
export const VILLAGE_MARGIN = 2.5;

/** How far a building's ground reaches from its middle (half the diagonal of its footprint): trees and plants keep off it. */
export const buildingReach = (b: Building): number => Math.hypot(b.hx, b.hz);

export const DOOR_RANGE = 3.4;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const DOOR_LEAVE_RANGE = 4.6;
/** How far in front of the wall the door spot is (past the footprint). */
const DOOR_OUT = 2.4;

/** Where you stand to knock: in front of the building, on the plaza side. */
export function doorSpot(b: Building): { x: number; z: number } {
  const out = b.hz + DOOR_OUT;
  return { x: b.x + Math.sin(b.yaw) * out, z: b.z + Math.cos(b.yaw) * out };
}

/** The building whose door you can reach: the nearest one inside `range`, or null. */
export function nearestBuilding(
  pos: { x: number; z: number },
  buildings: readonly Building[] = BUILDINGS,
  range: number = DOOR_RANGE,
): BuildingId | null {
  let best: BuildingId | null = null;
  let bestD = range;
  for (const b of buildings) {
    const s = doorSpot(b);
    const d = Math.hypot(s.x - pos.x, s.z - pos.z);
    if (d <= bestD) {
      best = b.id;
      bestD = d;
    }
  }
  return best;
}

/** Where the hero stands, and the camera yaw, on stepping back out of a building's door: a few steps out on the road side, facing it. */
export function stepOutOf(b: Building): { x: number; z: number; yaw: number } {
  const s = doorSpot(b);
  const out = DOOR_LEAVE_RANGE + 1.8;
  const x = s.x + Math.sin(b.yaw) * out;
  const z = s.z + Math.cos(b.yaw) * out;
  return { x, z, yaw: Math.atan2(s.x - x, s.z - z) };
}

/** What E does at a building: open one page's register row, or open the menu of a place. */
export type DoorAction = { kind: "page"; door: Door } | { kind: "place"; place: PlaceId } | null;

export function doorAction(b: Building, register: readonly Door[] = REGISTER): DoorAction {
  if ("place" in b.opens) return { kind: "place", place: b.opens.place };
  const route = b.opens.route;
  const door = register.find((d) => d.route === route);
  return door ? { kind: "page", door } : null;
}

export const buildingPrompt = (b: Building): string => `Press E to go into the ${b.label}`;
