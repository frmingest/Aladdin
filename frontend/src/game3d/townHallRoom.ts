/**
 * The inside of the Town Hall (3D sprint S18, PR 2). Pure data and maths, no three.js and no React.
 *
 * One hall with six boards on the walls and a door in the south wall. The boards group the ten main-app
 * pages: the Dashboard has the big board in the middle, the other nine pages share five boards in pairs.
 * Nothing here is a fact about the portfolio: a board names its pages and nothing else, and standing at
 * one and pressing E opens the flat page (or the pair to choose from) in the world panel, so every number
 * still comes from the page itself. Numbers on the boards themselves arrive with the later piece that can
 * take them from the flat pages' own functions.
 *
 * Local coordinates: x east, z south, y up, the hall centred near the origin. The Town is not drawn while
 * you are in here, so the room sits at the origin without touching anything (like the tower library).
 */
import type { Spot } from "./layout";
import { doorsAt } from "./parity3d";
import type { Door } from "./parity3d";
import { BUILDINGS, doorSpot } from "./townPlan";

export const HALL = { minX: -11, maxX: 11, minZ: -10, maxZ: 9, height: 7 } as const;
/** A closed pair of doors in the south wall; E beside it leads back out into the Town. */
export const HALL_DOOR = { x: 0, z: HALL.maxZ, width: 3.2 } as const;
/** Far enough in that the follow camera (about 6 behind) is still inside the south wall. */
export const HALL_SPAWN = { x: 0, y: 1.5, z: 3 } as const;
/** Camera yaw 0 puts the hero looking north, toward the boards. */
export const HALL_YAW = 0;

export type BoardId = "dashboard" | "purse" | "storm" | "weather" | "reasons" | "roll";

export interface Board {
  id: BoardId;
  /** The words over the board: short and playful. */
  title: string;
  /** One line under it. Words only, no number. */
  line: string;
  /** The register routes this board opens (all of them are Town Hall doors). */
  routes: readonly string[];
}

/** Dashboard first (the big board), then the groups. Sectors is reached through Macro, so it has no route of its own. */
export const BOARDS: readonly Board[] = [
  { id: "dashboard", title: "The Big Board", line: "The whole portfolio at a glance.", routes: ["/"] },
  { id: "purse", title: "Purse and Scoreboard", line: "Accounts, imports and how it has all done.", routes: ["/portfolio", "/performance"] },
  { id: "storm", title: "Storm and Cushion", line: "How it behaves when it gets rough, and how far price sits from value.", routes: ["/risk", "/margin-of-safety"] },
  { id: "weather", title: "The Wide Weather", line: "Rates, growth, prices and the sectors.", routes: ["/macro"] },
  { id: "reasons", title: "Reasons and Shiny Metal", line: "Is each reason still standing? Plus gold and friends.", routes: ["/thesis", "/precious-metals"] },
  { id: "roll", title: "Roll Call", line: "Every company you own, and the ones you are watching.", routes: ["/holdings", "/watchlist"] },
];

export interface BoardSlot {
  id: BoardId;
  /** Centre of the board on the floor. */
  x: number;
  z: number;
  /** Yaw so the board's front (local +z) faces into the room. */
  yaw: number;
}

const BOARD_DEPTH_CENTRE = 0.4;
const NORTH_Z = HALL.minZ + BOARD_DEPTH_CENTRE;
const WEST_X = HALL.minX + BOARD_DEPTH_CENTRE;
const EAST_X = HALL.maxX - BOARD_DEPTH_CENTRE;

/** Three on the north wall (the Dashboard in the middle), two on the west wall, one on the east. */
export const BOARD_SLOTS: readonly BoardSlot[] = [
  { id: "dashboard", x: 0, z: NORTH_Z, yaw: 0 },
  { id: "purse", x: -6, z: NORTH_Z, yaw: 0 },
  { id: "storm", x: 6, z: NORTH_Z, yaw: 0 },
  { id: "weather", x: WEST_X, z: 3, yaw: Math.PI / 2 },
  { id: "reasons", x: EAST_X, z: -3, yaw: -Math.PI / 2 },
  { id: "roll", x: WEST_X, z: -3, yaw: Math.PI / 2 },
];

/** Board width and height, for the drawn frame and the clearance test. */
export const BOARD_SIZE = { w: 4.2, h: 3.4 } as const;

export const BOARD_RANGE = 3.2;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const BOARD_LEAVE_RANGE = 4.4;
export const HALL_DOOR_RANGE = 3.4;
export const HALL_DOOR_LEAVE_RANGE = 4.6;

export const hallPrompt = (b: Board): string => `Press E at the ${b.title} board`;
export const hallDoorPrompt = "Press E to go back out into the Town";

export function boardById(id: BoardId): Board {
  return BOARDS.find((b) => b.id === id) ?? BOARDS[0];
}

/** Where you stand to read a board: 1.6 in front of it. */
export function readingSpot(s: BoardSlot): Spot {
  return { x: s.x + Math.sin(s.yaw) * 1.6, z: s.z + Math.cos(s.yaw) * 1.6 };
}

export function nearestBoard(
  pos: { x: number; z: number },
  slots: readonly BoardSlot[] = BOARD_SLOTS,
  range: number = BOARD_RANGE,
): BoardId | null {
  let best: BoardId | null = null;
  let bestD = Infinity;
  for (const s of slots) {
    const p = readingSpot(s);
    const d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d <= range && d < bestD) {
      best = s.id;
      bestD = d;
    }
  }
  return best;
}

export function nearHallDoor(pos: { x: number; z: number }, range: number = HALL_DOOR_RANGE): boolean {
  return Math.hypot(HALL_DOOR.x - pos.x, HALL_DOOR.z - pos.z) <= range;
}

/** The register rows a board opens, in the board's own order. A route that is not a door gives no row. */
export function doorsOfBoard(board: Board, townHallDoors: readonly Door[] = doorsAt("townhall")): Door[] {
  return board.routes.map((r) => townHallDoors.find((d) => d.route === r)).filter((d): d is Door => d !== undefined);
}

/** Where the hero stands in the Town, and the camera yaw, when stepping out of the Town Hall door. */
export function hallExit(): { x: number; z: number; yaw: number } {
  const b = BUILDINGS.find((x) => x.id === "townhall");
  if (!b) return { x: 0, z: 0, yaw: 0 };
  const s = doorSpot(b);
  // Same convention as stepping out of a tower: the camera sits on the building's side, so the hero looks away from it.
  return { x: s.x, z: s.z, yaw: Math.atan2(b.x - s.x, b.z - s.z) };
}
