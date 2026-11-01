/**
 * The Town beyond the gate (3D sprint S15). Pure data and maths, no three.js and no React.
 *
 * A second zone, entered like a tower door: stand at the gate road, press E, and the courtyard gives way to the
 * Town (the courtyard is not drawn while you are there, so its 60 fps and its budget stay as they were). Four
 * finished KayKit Builder buildings (CC0, S9) stand round a plaza, each one the door to flat pages that are not
 * stores: Records, Map, Codex, and the plumbing pages. The buildings are decoration; the facts stay in the
 * panels, which are the flat pages themselves (S13).
 *
 * Local coordinates: x east, z south, y up, the plaza at the origin. A building's yaw 0 faces south (like the
 * market pieces); its front is local +z. Buildings are centred on their own origin (measured, S15).
 */
import { REGISTER } from "./parity3d";
import type { Door, PlaceId } from "./parity3d";
import { TOWN_SCALE } from "./townPieces";
import { WALL_RADIUS } from "./layout";

/** Where the hero stands in the courtyard to take the road out, and how near counts. */
export const GATE_SPOT = { x: 0, z: WALL_RADIUS - 4 } as const;
export const GATE_RANGE = 4.5;
export const GATE_LEAVE_RANGE = 6;
/** Where the hero comes back out in the courtyard: inside the gate, out of the gate prompt's reach. */
export const GATE_RETURN = { x: 0, z: GATE_SPOT.z - GATE_LEAVE_RANGE - 1 } as const;
/** Camera yaw 0 looks north into the courtyard. */
export const GATE_RETURN_YAW = 0;

/** The north end of the Town: where you arrive, and where the road back stands. */
export const TOWN_EXIT = { x: 0, z: -30 } as const;
export const TOWN_SPAWN = { x: 0, y: 1.5, z: -21 } as const;
/** Camera yaw PI looks south, down the Town road. */
export const TOWN_YAW = Math.PI;
export const EXIT_RANGE = 4.5;
export const EXIT_LEAVE_RANGE = 6;

/** The ground the Town may use: nothing stands outside this radius. */
export const TOWN_RADIUS = 46;

export type BuildingId = "records" | "cartographer" | "archive" | "workshop";

export interface Building {
  id: BuildingId;
  /** Node name inside town-buildings.glb. */
  model: "castle" | "watchtower" | "house" | "lumbermill";
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
} as const;

const K = TOWN_SCALE.builder;

function building(
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
 * The first four buildings, round a plaza and all facing it. Proposed models; a look decides (the plan's gate).
 * Records: the castle, the big one at the far end. Cartographer: the watchtower, west. Archive: the house, east.
 * Workshop: the lumber mill, north-east. A well stands in the middle of the plaza.
 */
export const BUILDINGS: readonly Building[] = [
  building("records", "castle", "Hall of Records", 0, 26, Math.PI, { route: "/fortress/records" }),
  building("cartographer", "watchtower", "Cartographer", -26, 4, Math.PI / 2, { route: "/fortress/map" }),
  building("archive", "house", "Archive", 26, 4, -Math.PI / 2, { route: "/glossary" }),
  building("workshop", "lumbermill", "Workshop", 26, -17, -Math.PI / 2, { place: "workshop" }),
];

/** The well in the middle of the plaza: decoration with a round base. */
export const WELL = { x: 0, z: 2, scale: K, r: 2.9 } as const;

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

export function nearGate(pos: { x: number; z: number }, range: number = GATE_RANGE): boolean {
  return Math.hypot(GATE_SPOT.x - pos.x, GATE_SPOT.z - pos.z) <= range;
}

export function nearTownExit(pos: { x: number; z: number }, range: number = EXIT_RANGE): boolean {
  return Math.hypot(TOWN_EXIT.x - pos.x, TOWN_EXIT.z - pos.z) <= range;
}

/** What E does at a building: open one page's register row, or open the menu of a place. */
export type DoorAction = { kind: "page"; door: Door } | { kind: "place"; place: PlaceId } | null;

export function doorAction(b: Building, register: readonly Door[] = REGISTER): DoorAction {
  if ("place" in b.opens) return { kind: "place", place: b.opens.place };
  const route = b.opens.route;
  const door = register.find((d) => d.route === route);
  return door ? { kind: "page", door } : null;
}

export const gatePrompt = "Press E to walk on to the Town";
export const exitPrompt = "Press E to walk back to the courtyard";
export const buildingPrompt = (b: Building): string => `Press E to go into the ${b.label}`;
