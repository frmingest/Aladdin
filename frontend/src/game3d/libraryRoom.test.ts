import { describe, expect, it } from "vitest";
import { DOOR_RANGE, HALL, HALL_DOOR, ROOM_SPAWN, SHELF_RANGE, SHELF_SLOTS, nearDoor, nearestShelf, readingSpot } from "./libraryRoom";
import { SHELF_ORDER } from "./libraryShelves";

const TABLE = { x: 0, z: -1, hx: 1.15, hz: 0.6 };

describe("tower library room", () => {
  it("has one bay for each of the six shelves, once each, in order", () => {
    expect(SHELF_SLOTS.map((s) => s.id)).toEqual([...SHELF_ORDER]);
  });

  it("keeps every bay and every reading spot inside the hall", () => {
    for (const s of SHELF_SLOTS) {
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
  });

  it("does not overlap bays (each is 3.6 wide) or put a reading spot in the table", () => {
    for (let i = 0; i < SHELF_SLOTS.length; i++) {
      for (let j = i + 1; j < SHELF_SLOTS.length; j++) {
        expect(Math.hypot(SHELF_SLOTS[i].x - SHELF_SLOTS[j].x, SHELF_SLOTS[i].z - SHELF_SLOTS[j].z)).toBeGreaterThan(3.8);
      }
      const r = readingSpot(SHELF_SLOTS[i]);
      const inTable = Math.abs(r.x - TABLE.x) < TABLE.hx + 0.5 && Math.abs(r.z - TABLE.z) < TABLE.hz + 0.5;
      expect(inTable).toBe(false);
    }
  });

  it("makes each bay face into the room", () => {
    for (const s of SHELF_SLOTS) {
      const r = readingSpot(s);
      const towardMiddle = Math.hypot(r.x, r.z) < Math.hypot(s.x, s.z);
      expect(towardMiddle).toBe(true);
    }
  });

  it("picks the nearest shelf only when you stand at its reading spot, and nothing in the middle", () => {
    for (const s of SHELF_SLOTS) expect(nearestShelf(readingSpot(s))?.id).toBe(s.id);
    expect(nearestShelf({ x: 0, z: 2 })).toBeNull();
    expect(SHELF_RANGE).toBeLessThan(5);
  });

  it("spawns you inside the hall, away from the door and from every shelf", () => {
    expect(ROOM_SPAWN.x).toBeGreaterThan(HALL.minX);
    expect(ROOM_SPAWN.z).toBeLessThan(HALL.maxZ);
    expect(nearDoor(ROOM_SPAWN)).toBe(false);
    expect(nearestShelf(ROOM_SPAWN)).toBeNull();
  });

  it("lets you take the door only when you stand by it", () => {
    expect(nearDoor({ x: HALL_DOOR.x, z: HALL_DOOR.z - 1 })).toBe(true);
    expect(nearDoor({ x: 0, z: HALL_DOOR.z - DOOR_RANGE - 1 })).toBe(false);
    // The door never shares a spot with a shelf prompt.
    expect(nearestShelf({ x: HALL_DOOR.x, z: HALL_DOOR.z - 1 })).toBeNull();
  });
});
