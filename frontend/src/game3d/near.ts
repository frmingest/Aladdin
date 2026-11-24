/**
 * "What am I standing at": one list of everything you can walk up to (S21, made one list in #411).
 *
 * `SPOTS` is that list: each entry says which place it is in, where it stands and how far its reach goes. The scene
 * runs one watcher over it (`watchSpots`), the page reads one answer from it (`standingAt`), and the E key and the
 * prompt both follow that answer, so a prompt can never promise something E does not do. A new thing to walk up to
 * is one entry here plus one entry in the page's action table (the compiler asks for it).
 *
 * Pure data and maths: no three.js, no React.
 */
import type { AreaId, AreaRef } from "./areas";
import { BOOTHS, BOOTH_LEAVE_RANGE, BOOTH_RANGE } from "./boothPlan";
import type { BoothId } from "./boothPlan";
import { DESK, DESK_LEAVE_RANGE, DESK_RANGE } from "./deskLogic";
import { setOpenDoor } from "./doorSwing";
import {
  GATE_LEAVE_RANGE as LAND_GATE_LEAVE_RANGE,
  GATE_RANGE as LAND_GATE_RANGE,
  LAND_GATE,
  LAND_SHELF_SLOTS,
  SHELF_LEAVE_RANGE as LAND_SHELF_LEAVE_RANGE,
  SHELF_RANGE as LAND_SHELF_RANGE,
  TABLE_LEAVE_RANGE,
  TABLE_RANGE,
  nearLandTable,
  nearestLantern,
} from "./holdingLandLogic";
import { nearestShelf } from "./libraryRoom";
import {
  BOOK_LEAVE_RANGE,
  BOOK_RANGE,
  MINT_DOOR_LEAVE_RANGE,
  MINT_DOOR_RANGE,
  PRESS_LEAVE_RANGE,
  PRESS_RANGE,
  SPAN_LEAVE_RANGE,
  SPAN_RANGE,
  nearBook,
  nearMintDoor,
  nearPress,
  nearSpan,
  nearestLever,
} from "./mintRoomLogic";
import type { LeverPlan } from "./mintRoomLogic";
import type { ShelfId } from "./libraryShelves";
import { LEAVE_RANGE, NPCS, TALK_RANGE } from "./npcs";
import type { NpcId } from "./npcs";
import { QUARTER_EXIT, QUARTER_EXIT_LEAVE_RANGE, QUARTER_EXIT_RANGE, QUARTER_GATE, QUARTER_GATE_LEAVE_RANGE, QUARTER_GATE_RANGE } from "./quarterPlan";
import { REALM_LEAVE_RANGE, REALM_POST, REALM_RANGE } from "./realmPlan";
import { ARCHIVE_DOOR_LEAVE_RANGE, ARCHIVE_DOOR_RANGE, SHELF_LEAVE_RANGE, SHELF_RANGE, nearArchiveDoor, nearShelves } from "./recordsHallRoomLogic";
import { fieldSpotAt } from "./siegeFieldTools";
import type { FieldSpotId } from "./siegeFieldTools";
import { SIGN, SIGN_LEAVE_RANGE, SIGN_RANGE } from "./signpostLogic";
import { STALL_LEAVE_RANGE, STALL_RANGE } from "./stallDoor";
import { DRILL_LEAVE_RANGE, DRILL_POST, DRILL_RANGE } from "./stormDrill";
import { ENTER_LEAVE_REACH, ENTER_REACH } from "./towerDoor";
import { BOARD_LEAVE_RANGE, BOARD_RANGE, BOARD_SLOTS, HALL_DOOR_LEAVE_RANGE, HALL_DOOR_RANGE, nearHallDoor, nearestBoard } from "./townHallRoomLogic";
import type { BoardId } from "./townHallRoomLogic";
import { BUILDINGS, DOOR_LEAVE_RANGE, DOOR_RANGE, nearestBuilding } from "./townPlan";
import type { BuildingId } from "./townPlan";
import { HOURGLASS, HOURGLASS_LEAVE_RANGE, HOURGLASS_RANGE } from "./hourglassPlan";
import { COUNTER_LEAVE_RANGE, COUNTER_RANGE, YARD_GATE, YARD_GATE_LEAVE_RANGE, YARD_GATE_RANGE, nearCounter } from "./practiceYardLogic";
import { PERCH, PERCH_LEAVE_RANGE, PERCH_RANGE, WATCH_LEAVE_RANGE, WATCH_POST, WATCH_RANGE } from "./watchPlan";
import { VAULT, VAULT_LEAVE_RANGE, VAULT_RANGE } from "./vaultPlan";
import { DIALS_LEAVE_RANGE, DIALS_RANGE, TOWER_DOOR_LEAVE_RANGE, TOWER_DOOR_RANGE, nearDials, nearTowerDoor } from "./weatherTowerRoomLogic";
import type { SurveyCheckId } from "../lib/survey";

export interface NearTarget<K> {
  id: K;
  x: number;
  z: number;
  /** Near enough to be offered. */
  range: number;
  /** Still near once offered; at least `range`. */
  leaveRange: number;
}

/**
 * The target within reach, or null. The one you already hold keeps the wider `leaveRange`; every other target needs
 * the narrower `range`. Of those within reach the nearest to its own wall or spot wins; an exact tie goes to the earlier target.
 */
export function pickNear<K>(pos: { x: number; z: number }, targets: readonly NearTarget<K>[], last: K | null): K | null {
  let best: K | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const reach = last !== null && t.id === last ? Math.max(t.range, t.leaveRange) : t.range;
    const d = Math.hypot(t.x - pos.x, t.z - pos.z);
    // Ranked by how far inside its own reach the hero stands, so a fat tower (reach counted from its wall) is no easier.
    const rank = d - t.range;
    if (d <= reach && rank < bestD) {
      best = t.id;
      bestD = rank;
    }
  }
  return best;
}

/** Everything the hero can be near. One field per entry of `SPOTS`: an id where there are several, yes or no where there is one. */
export interface Nears {
  npc: NpcId | null;
  tower: string | null;
  desk: boolean;
  drill: boolean;
  sign: boolean;
  booth: BoothId | null;
  stall: string | null;
  vault: boolean;
  watch: boolean;
  perch: boolean;
  realm: boolean;
  /** Courtyard: at the hourglass (replay the stored days). */
  hourglass: boolean;
  shelf: ShelfId | null;
  table: boolean;
  /** Which survey lantern you stand at in a holding's land. */
  lantern: SurveyCheckId | null;
  /** At the gate of a holding's land. */
  landGate: boolean;
  building: BuildingId | null;
  board: BoardId | null;
  hallDoor: boolean;
  shelves: boolean;
  archiveDoor: boolean;
  /** Weather Tower: in front of the dials, and at the door. */
  dials: boolean;
  weatherDoor: boolean;
  /** Royal Mint: which lever you stand at, the span post, the press, the ledger lectern, and the door. */
  mintLever: string | null;
  mintSpan: boolean;
  mintPress: boolean;
  mintBook: boolean;
  mintDoor: boolean;
  /** Courtyard, on the Siege Field's plot: the winch, a marker stone or a yardstick banner within reach. */
  fieldSpot: FieldSpotId | null;
  /** Courtyard: at the arch to the Market Quarter. */
  quarterGate: boolean;
  /** Market Quarter: the road back is in reach. */
  quarterExit: boolean;
  /** Practice yard (#493): at Sal's practice counter, and at the gate back out. */
  counter: boolean;
  yardGate: boolean;
}

export type SpotKey = keyof Nears;

export const NO_NEARS: Nears = {
  npc: null,
  tower: null,
  desk: false,
  drill: false,
  sign: false,
  booth: null,
  stall: null,
  vault: false,
  watch: false,
  perch: false,
  realm: false,
  hourglass: false,
  shelf: null,
  table: false,
  lantern: null,
  landGate: false,
  building: null,
  board: null,
  hallDoor: false,
  shelves: false,
  archiveDoor: false,
  dials: false,
  weatherDoor: false,
  mintLever: null,
  mintSpan: false,
  mintPress: false,
  mintBook: false,
  mintDoor: false,
  fieldSpot: null,
  quarterGate: false,
  quarterExit: false,
  counter: false,
  yardGate: false,
};

/** The spots that are one of several: the answer carries which one. */
type ManyKind = "npc" | "tower" | "booth" | "stall" | "shelf" | "lantern" | "building" | "fieldSpot" | "board" | "mintLever";
/** The spots there is one of. */
type OneKind = "desk" | "drill" | "quarterGate" | "sign" | "vault" | "watch" | "perch" | "realm" | "hourglass" | "table" | "shelves" | "dials" | "mintSpan" | "mintPress" | "mintBook" | "counter";

export type Standing =
  | { kind: "none" }
  | { [K in ManyKind]: { kind: K; id: NonNullable<Nears[K]> } }[ManyKind]
  | { kind: OneKind }
  /** The door back out of an interior, or the road back from a field. */
  | { kind: "leave" };

export type StandingKind = Standing["kind"];
/** Every kind E can act on. */
export type SpotKind = Exclude<StandingKind, "none">;

type Pos = { x: number; z: number };

/** The parts of the world that move with the data: the towers that stand, the stalls up the lane, the lanterns of the land you are in. */
export interface SpotWorld {
  towers: readonly { holdingId: string; spot: Pos; radius: number; plot?: { footprint: number } | null }[];
  stalls: readonly { holdingId: string; x: number; z: number }[];
  lanterns: readonly { check: SurveyCheckId; x: number; z: number }[];
  /** The levers on the Royal Mint's wall (one for each lever the ledger lists). */
  mintLevers: readonly LeverPlan[];
}

export const NO_SPOT_WORLD: SpotWorld = { towers: [], stalls: [], lanterns: [], mintLevers: [] };

export interface Spot<K extends SpotKey = SpotKey> {
  /** Its field in `Nears`. */
  key: K;
  /** What E does there. Usually the same word as the key; every way back out is "leave". */
  kind: SpotKind;
  /** The one place it stands in. */
  area: AreaId;
  /** Who is in reach now, given who was in reach a moment ago (the held one keeps the wider leave range). */
  detect: (pos: Pos, held: Nears[K], world: SpotWorld) => Nears[K];
  /** Told when the answer changes (the tower's door leaf swings). */
  onChange?: (now: Nears[K]) => void;
}

/** One fixed spot: near or not, wider to leave than to arrive. */
const single = (p: Pos, range: number, leaveRange: number) => (pos: Pos, held: boolean) =>
  Math.hypot(p.x - pos.x, p.z - pos.z) <= (held ? Math.max(range, leaveRange) : range);
/** A yes-or-no check that takes its own range. */
const ranged = (near: (pos: Pos, range: number) => boolean, range: number, leaveRange: number) => (pos: Pos, held: boolean) =>
  near(pos, held ? leaveRange : range);

const NPC_T: readonly NearTarget<NpcId>[] = NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, range: TALK_RANGE, leaveRange: LEAVE_RANGE }));
const BOOTH_T: readonly NearTarget<BoothId>[] = BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, range: BOOTH_RANGE, leaveRange: BOOTH_LEAVE_RANGE }));


/** Targets built from a list that only changes when the data does: built once per list, not once per frame. */
function targetsOf<T extends object>(build: (item: T) => NearTarget<string>): (list: readonly T[]) => readonly NearTarget<string>[] {
  const cache = new WeakMap<readonly T[], readonly NearTarget<string>[]>();
  return (list) => {
    let hit = cache.get(list);
    if (!hit) cache.set(list, (hit = list.map(build)));
    return hit;
  };
}
// A tower's reach is counted from its wall, not its middle: fat towers are not easier to enter.
const towerTargets = targetsOf((t: SpotWorld["towers"][number]) => ({
  id: t.holdingId,
  x: t.spot.x,
  z: t.spot.z,
  range: ENTER_REACH + (t.plot?.footprint ?? t.radius),
  leaveRange: ENTER_LEAVE_REACH + (t.plot?.footprint ?? t.radius),
}));
const stallTargets = targetsOf((s: SpotWorld["stalls"][number]) => ({ id: s.holdingId, x: s.x, z: s.z, range: STALL_RANGE, leaveRange: STALL_LEAVE_RANGE }));

const spot = <K extends SpotKey>(s: Spot<K>): Spot => s as unknown as Spot;

/**
 * Everything you can walk up to. Within one place the order is the order E has always used: a person beats a door,
 * a door beats the desk, and so on down; the way back out comes last.
 */
export const SPOTS: readonly Spot[] = [
  // The courtyard, and the Town on the meadow outside its gate.
  spot({ key: "npc", kind: "npc", area: "courtyard", detect: (pos, held) => pickNear(pos, NPC_T, held) }),
  spot({
    key: "tower",
    kind: "tower",
    area: "courtyard",
    detect: (pos, held, w) => pickNear(pos, towerTargets(w.towers), held),
    onChange: setOpenDoor,
  }),
  spot({ key: "desk", kind: "desk", area: "courtyard", detect: single(DESK, DESK_RANGE, DESK_LEAVE_RANGE) }),
  spot({ key: "drill", kind: "drill", area: "courtyard", detect: single(DRILL_POST, DRILL_RANGE, DRILL_LEAVE_RANGE) }),
  spot({ key: "quarterGate", kind: "quarterGate", area: "courtyard", detect: single(QUARTER_GATE, QUARTER_GATE_RANGE, QUARTER_GATE_LEAVE_RANGE) }),
  spot({ key: "sign", kind: "sign", area: "courtyard", detect: single(SIGN, SIGN_RANGE, SIGN_LEAVE_RANGE) }),
  spot({ key: "booth", kind: "booth", area: "courtyard", detect: (pos, held) => pickNear(pos, BOOTH_T, held) }),
  spot({ key: "building", kind: "building", area: "courtyard", detect: (pos, held) => nearestBuilding(pos, BUILDINGS, held ? DOOR_LEAVE_RANGE : DOOR_RANGE) }),
  spot({ key: "vault", kind: "vault", area: "courtyard", detect: single(VAULT, VAULT_RANGE, VAULT_LEAVE_RANGE) }),
  spot({ key: "watch", kind: "watch", area: "courtyard", detect: single(WATCH_POST, WATCH_RANGE, WATCH_LEAVE_RANGE) }),
  spot({ key: "perch", kind: "perch", area: "courtyard", detect: single(PERCH, PERCH_RANGE, PERCH_LEAVE_RANGE) }),
  spot({ key: "realm", kind: "realm", area: "courtyard", detect: single(REALM_POST, REALM_RANGE, REALM_LEAVE_RANGE) }),
  spot({ key: "hourglass", kind: "hourglass", area: "courtyard", detect: single(HOURGLASS, HOURGLASS_RANGE, HOURGLASS_LEAVE_RANGE) }),

  // A holding's land.
  spot({
    key: "shelf",
    kind: "shelf",
    area: "holding",
    detect: (pos, held) => nearestShelf(pos, LAND_SHELF_SLOTS, held ? LAND_SHELF_LEAVE_RANGE : LAND_SHELF_RANGE)?.id ?? null,
  }),
  spot({ key: "table", kind: "table", area: "holding", detect: ranged(nearLandTable, TABLE_RANGE, TABLE_LEAVE_RANGE) }),
  spot({ key: "lantern", kind: "lantern", area: "holding", detect: (pos, held, w) => nearestLantern(pos, w.lanterns, held) }),
  spot({ key: "landGate", kind: "leave", area: "holding", detect: single(LAND_GATE, LAND_GATE_RANGE, LAND_GATE_LEAVE_RANGE) }),

  // The Town Hall.
  spot({ key: "board", kind: "board", area: "townhall", detect: (pos, held) => nearestBoard(pos, BOARD_SLOTS, held ? BOARD_LEAVE_RANGE : BOARD_RANGE) }),
  spot({ key: "hallDoor", kind: "leave", area: "townhall", detect: ranged(nearHallDoor, HALL_DOOR_RANGE, HALL_DOOR_LEAVE_RANGE) }),

  // The Hall of Records.
  spot({ key: "shelves", kind: "shelves", area: "records", detect: ranged(nearShelves, SHELF_RANGE, SHELF_LEAVE_RANGE) }),
  spot({ key: "archiveDoor", kind: "leave", area: "records", detect: ranged(nearArchiveDoor, ARCHIVE_DOOR_RANGE, ARCHIVE_DOOR_LEAVE_RANGE) }),

  // The Weather Tower.
  spot({ key: "dials", kind: "dials", area: "weather", detect: ranged(nearDials, DIALS_RANGE, DIALS_LEAVE_RANGE) }),
  spot({ key: "weatherDoor", kind: "leave", area: "weather", detect: ranged(nearTowerDoor, TOWER_DOOR_RANGE, TOWER_DOOR_LEAVE_RANGE) }),

  // The Royal Mint: a lever beats the press, the press beats the span post and the lectern; the way out comes last.
  spot({ key: "mintLever", kind: "mintLever", area: "mint", detect: (pos, held, w) => nearestLever(pos, w.mintLevers, held) }),
  spot({ key: "mintPress", kind: "mintPress", area: "mint", detect: ranged(nearPress, PRESS_RANGE, PRESS_LEAVE_RANGE) }),
  spot({ key: "mintSpan", kind: "mintSpan", area: "mint", detect: ranged(nearSpan, SPAN_RANGE, SPAN_LEAVE_RANGE) }),
  spot({ key: "mintBook", kind: "mintBook", area: "mint", detect: ranged(nearBook, BOOK_RANGE, BOOK_LEAVE_RANGE) }),
  spot({ key: "mintDoor", kind: "leave", area: "mint", detect: ranged(nearMintDoor, MINT_DOOR_RANGE, MINT_DOOR_LEAVE_RANGE) }),

  // The Siege Field's tools stand on the meadow (issue #466), so they are courtyard spots; `fieldSpotAt` turns the world place into the field's own frame.
  spot({ key: "fieldSpot", kind: "fieldSpot", area: "courtyard", detect: (pos, held) => fieldSpotAt(pos, held) }),

  // The Market Quarter: a stall beats the road back; the exit stands far from every stall (test).
  spot({
    key: "stall",
    kind: "stall",
    area: "quarter",
    detect: (pos, held, w) => pickNear(pos, stallTargets(w.stalls), held),
  }),
  spot({ key: "quarterExit", kind: "leave", area: "quarter", detect: single(QUARTER_EXIT, QUARTER_EXIT_RANGE, QUARTER_EXIT_LEAVE_RANGE) }),

  // The practice yard (#493): Sal's practice counter beats the gate back out.
  spot({ key: "counter", kind: "counter", area: "practice", detect: ranged(nearCounter, COUNTER_RANGE, COUNTER_LEAVE_RANGE) }),
  spot({ key: "yardGate", kind: "leave", area: "practice", detect: single(YARD_GATE, YARD_GATE_RANGE, YARD_GATE_LEAVE_RANGE) }),
];

/** The spots of one place, in E order. */
export function spotsOf(area: AreaId): readonly Spot[] {
  return SPOTS.filter((s) => s.area === area);
}

const isNear = (v: Nears[SpotKey]): boolean => v !== null && v !== false;

/**
 * One pass of the watcher: asks every spot of the place who is in reach, and returns the fields that changed
 * (null when nothing did). The scene runs this every frame and stores the answer; nothing else decides "near".
 */
export function watchSpots(area: AreaId, pos: Pos, held: Nears, world: SpotWorld): Partial<Nears> | null {
  let changed: Partial<Record<SpotKey, Nears[SpotKey]>> | null = null;
  for (const s of SPOTS) {
    if (s.area !== area) continue;
    const now = s.detect(pos, held[s.key], world);
    if (now !== held[s.key]) {
      (changed ??= {})[s.key] = now;
      s.onChange?.(now);
    }
  }
  return changed as Partial<Nears> | null;
}

/**
 * The single thing E would do now: the first spot of this place, in list order, that is in reach. Whether the thing
 * then has data to open is the page's business.
 */
export function standingAt(area: AreaRef, n: Nears): Standing {
  for (const s of SPOTS) {
    if (s.area !== area.id) continue;
    const v = n[s.key];
    if (!isNear(v)) continue;
    return (typeof v === "boolean" ? { kind: s.kind } : { kind: s.kind, id: v }) as Standing;
  }
  return { kind: "none" };
}
