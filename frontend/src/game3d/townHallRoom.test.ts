import { describe, expect, it } from "vitest";
import { doorsAt } from "./parity3d";
import {
  BOARDS,
  BOARD_RANGE,
  BOARD_SLOTS,
  BOARD_SIZE,
  HALL,
  HALL_DOOR,
  HALL_SPAWN,
  doorsOfBoard,
  hallDoorPrompt,
  hallExit,
  hallPrompt,
  nearHallDoor,
  nearestBoard,
  readingSpot,
} from "./townHallRoom";
import { BUILDINGS, DOOR_RANGE, nearestBuilding } from "./townPlan";

const BUY_SELL = /\b(buy|sell|trade|invest)\b/i;

describe("the Town Hall inside", () => {
  it("has one slot for each board, once each, in order", () => {
    expect(BOARD_SLOTS.map((s) => s.id)).toEqual(BOARDS.map((b) => b.id));
  });

  it("gives every Town Hall door to exactly one board, and no board a door that is not there", () => {
    const hallRoutes = doorsAt("townhall").map((d) => d.route);
    const claimed = BOARDS.flatMap((b) => b.routes);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect([...claimed].sort()).toEqual([...hallRoutes].sort());
    for (const b of BOARDS) expect(doorsOfBoard(b).length, b.id).toBe(b.routes.length);
  });

  it("keeps boards and reading spots inside the hall, apart from each other", () => {
    for (const s of BOARD_SLOTS) {
      expect(s.x).toBeGreaterThan(HALL.minX);
      expect(s.x).toBeLessThan(HALL.maxX);
      expect(s.z).toBeGreaterThan(HALL.minZ);
      expect(s.z).toBeLessThan(HALL.maxZ);
      const r = readingSpot(s);
      expect(r.x).toBeGreaterThan(HALL.minX + 1);
      expect(r.x).toBeLessThan(HALL.maxX - 1);
      expect(r.z).toBeGreaterThan(HALL.minZ + 1);
      expect(r.z).toBeLessThan(HALL.maxZ - 1);
    }
    for (let i = 0; i < BOARD_SLOTS.length; i++)
      for (let j = i + 1; j < BOARD_SLOTS.length; j++)
        expect(Math.hypot(BOARD_SLOTS[i].x - BOARD_SLOTS[j].x, BOARD_SLOTS[i].z - BOARD_SLOTS[j].z)).toBeGreaterThan(BOARD_SIZE.w);
  });

  it("finds each board from its own reading spot and from no other", () => {
    for (const s of BOARD_SLOTS) expect(nearestBoard(readingSpot(s)), s.id).toBe(s.id);
    expect(nearestBoard({ x: 0, z: 6 })).toBeNull();
    expect(BOARD_RANGE).toBeGreaterThan(0);
  });

  it("spawns the hero in the hall, away from boards, and not at the door", () => {
    expect(nearestBoard(HALL_SPAWN)).toBeNull();
    expect(nearHallDoor(HALL_SPAWN)).toBe(false);
    expect(nearHallDoor({ x: HALL_DOOR.x, z: HALL_DOOR.z - 1 })).toBe(true);
  });

  it("steps out at the Town Hall's own door spot", () => {
    const out = hallExit();
    expect(nearestBuilding(out, BUILDINGS, DOOR_RANGE)).toBe("townhall");
  });

  it("uses short words with no number and no buy or sell", () => {
    for (const b of BOARDS) {
      expect(`${b.title} ${b.line}`).not.toMatch(/\d/);
      expect(`${b.title} ${b.line} ${hallPrompt(b)}`).not.toMatch(BUY_SELL);
    }
    expect(hallDoorPrompt).not.toMatch(BUY_SELL);
  });

  it("reads \"Press E to read <title>\" without doubling a word (was \"at the The Big Board board\")", () => {
    for (const b of BOARDS) {
      const p = hallPrompt(b);
      expect(p).toBe(`Press E to read ${b.title}`);
      expect(p).not.toMatch(/\bthe the\b/i);
      expect(p).not.toMatch(/board board/i);
    }
  });
});
