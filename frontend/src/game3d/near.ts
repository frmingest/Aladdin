/**
 * "What am I standing at": the two pure pieces behind every E prompt (S21).
 *
 * `pickNear` is the one hysteresis rule that twelve hand-copied watchers used to repeat. `standingAt` is the one
 * answer the E key AND the prompt both read, so a prompt can never promise something E does not do.
 */
import type { AreaRef } from "./areas";
import type { BoothId } from "./boothPlan";
import type { NpcId } from "./npcs";
import type { ShelfId } from "./libraryShelves";
import type { BoardId } from "./townHallRoom";
import type { SurveyCheckId } from "../lib/survey";
import type { BuildingId } from "./townPlan";

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

/** Everything the hero can be near, as the page has been told. One field per spot. */
export interface Nears {
  npc: NpcId | null;
  tower: string | null;
  desk: boolean;
  drill: boolean;
  sign: boolean;
  booth: BoothId | null;
  stall: string | null;
  gate: boolean;
  vault: boolean;
  watch: boolean;
  perch: boolean;
  realm: boolean;
  shelf: ShelfId | null;
  table: boolean;
  /** Which survey lantern you stand at in a holding's land. */
  lantern: SurveyCheckId | null;
  /** At the gate of a holding's land. */
  landGate: boolean;
  building: BuildingId | null;
  townExit: boolean;
  board: BoardId | null;
  hallDoor: boolean;
  shelves: boolean;
  archiveDoor: boolean;
  /** Courtyard: at the gate to the Siege Field. */
  siegeGate: boolean;
  /** Siege Field: the road back is in reach. */
  fieldExit: boolean;
}

export const NO_NEARS: Nears = {
  npc: null,
  tower: null,
  desk: false,
  drill: false,
  sign: false,
  booth: null,
  stall: null,
  gate: false,
  vault: false,
  watch: false,
  perch: false,
  realm: false,
  shelf: null,
  table: false,
  lantern: null,
  landGate: false,
  building: null,
  townExit: false,
  board: null,
  hallDoor: false,
  shelves: false,
  archiveDoor: false,
  siegeGate: false,
  fieldExit: false,
};

export type Standing =
  | { kind: "none" }
  | { kind: "npc"; id: NpcId }
  | { kind: "tower"; holdingId: string }
  | { kind: "desk" | "drill" | "siegeGate" | "sign" | "gate" | "vault" | "watch" | "perch" | "realm" | "table" | "shelves" }
  | { kind: "booth"; id: BoothId }
  | { kind: "stall"; holdingId: string }
  | { kind: "shelf"; id: ShelfId }
  | { kind: "lantern"; check: SurveyCheckId }
  | { kind: "building"; id: BuildingId }
  | { kind: "board"; id: BoardId }
  /** The door back out of an interior, or the road back from the Town. */
  | { kind: "leave" };

export type StandingKind = Standing["kind"];

/**
 * The single thing E would do now. Order is the order the E key always used: a person beats a door, a door beats
 * the desk, and so on down to the Realm post. Whether the thing then has data to open is the page's business.
 */
export function standingAt(area: AreaRef, n: Nears): Standing {
  switch (area.id) {
    case "records":
      if (n.shelves) return { kind: "shelves" };
      return n.archiveDoor ? { kind: "leave" } : { kind: "none" };
    case "townhall":
      if (n.board) return { kind: "board", id: n.board };
      return n.hallDoor ? { kind: "leave" } : { kind: "none" };
    case "siege":
      return n.fieldExit ? { kind: "leave" } : { kind: "none" };
    case "town":
      if (n.building) return { kind: "building", id: n.building };
      return n.townExit ? { kind: "leave" } : { kind: "none" };
    case "holding":
      if (n.shelf) return { kind: "shelf", id: n.shelf };
      if (n.table) return { kind: "table" };
      if (n.lantern) return { kind: "lantern", check: n.lantern };
      return n.landGate ? { kind: "leave" } : { kind: "none" };
    case "courtyard":
      if (n.npc) return { kind: "npc", id: n.npc };
      if (n.tower) return { kind: "tower", holdingId: n.tower };
      if (n.desk) return { kind: "desk" };
      if (n.drill) return { kind: "drill" };
      if (n.siegeGate) return { kind: "siegeGate" };
      if (n.sign) return { kind: "sign" };
      if (n.booth) return { kind: "booth", id: n.booth };
      if (n.stall) return { kind: "stall", holdingId: n.stall };
      if (n.gate) return { kind: "gate" };
      if (n.vault) return { kind: "vault" };
      if (n.watch) return { kind: "watch" };
      if (n.perch) return { kind: "perch" };
      if (n.realm) return { kind: "realm" };
      return { kind: "none" };
  }
}
