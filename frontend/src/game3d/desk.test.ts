import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { ENTER_REACH, exitSpot } from "./towerDoor";
import { SIZE_RADIUS } from "./stateToWorld";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { TOWNSFOLK } from "./townsfolk";
import { BOOKS_PER_ROW, DESK, DESK_LEAVE_RANGE, DESK_RANGE, MAX_BOOKS, SHELF, bookCount, bookSlots, nearDesk } from "./desk";

describe("writing desk placement", () => {
  it("stands on the cobbles beside the keep door, clear of the keep, every pad, people, props and the spawn", () => {
    for (const q of [DESK, SHELF]) {
      expect(Math.hypot(q.x, q.z)).toBeLessThan(COBBLE_RADIUS - 1);
      const inKeep = Math.abs(q.x - KEEP.x) < KEEP.width / 2 + 0.5 && Math.abs(q.z - KEEP.z) < KEEP.depth / 2 + 0.5;
      expect(inKeep).toBe(false);
      for (const s of towerSpots()) expect(Math.hypot(q.x - s.x, q.z - s.z)).toBeGreaterThan(3.5);
      for (const n of NPCS) expect(Math.hypot(q.x - n.x, q.z - n.z)).toBeGreaterThan(3.5);
      for (const t of TOWNSFOLK) expect(Math.hypot(q.x - t.x, q.z - t.z)).toBeGreaterThan(3.5);
      for (const p of PROPS) expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(p.solid + 2);
      for (const s of SCENERY) if (s.solid > 0) expect(Math.hypot(q.x - s.x, q.z - s.z), s.id).toBeGreaterThan(s.solid + 2);
      expect(Math.hypot(q.x - SPAWN.x, q.z - SPAWN.z)).toBeGreaterThan(10);
    }
  });

  it("is not within talking range of either person, so E never means two things", () => {
    for (const n of NPCS) expect(Math.hypot(DESK.x - n.x, DESK.z - n.z)).toBeGreaterThan(DESK_LEAVE_RANGE + 5);
  });

  it("is out of reach of every tower door, so standing at the desk never offers a library instead (found in a browser)", () => {
    const widest = Math.max(...Object.values(SIZE_RADIUS));
    for (const s of towerSpots()) {
      expect(Math.hypot(DESK.x - s.x, DESK.z - s.z), `pad ${s.x},${s.z}`).toBeGreaterThan(DESK_RANGE + widest + ENTER_REACH);
    }
  });

  it("is never where a hero stepping out of a tower is put down", () => {
    for (const s of towerSpots())
      for (const r of Object.values(SIZE_RADIUS)) {
        const out = exitSpot(s, r);
        expect(Math.hypot(out.x - DESK.x, out.z - DESK.z)).toBeGreaterThanOrEqual(2.4);
        expect(Math.hypot(out.x - SHELF.x, out.z - SHELF.z)).toBeGreaterThanOrEqual(2.4);
      }
  });

  it("arrives at a shorter range than it leaves, so the edge does not flicker", () => {
    expect(DESK_LEAVE_RANGE).toBeGreaterThan(DESK_RANGE);
    expect(nearDesk({ x: DESK.x + 2, z: DESK.z })).toBe(true);
    expect(nearDesk({ x: DESK.x + 5, z: DESK.z })).toBe(false);
    expect(nearDesk({ x: DESK.x + 5, z: DESK.z }, DESK_LEAVE_RANGE)).toBe(true);
  });
});

describe("the shelf of books", () => {
  it("has one book per written holding, never negative, never more than the eight pads", () => {
    expect(bookCount(0)).toBe(0);
    expect(bookCount(-3)).toBe(0);
    expect(bookCount(Number.NaN)).toBe(0);
    expect(bookCount(3)).toBe(3);
    expect(bookCount(3.9)).toBe(3);
    expect(bookCount(20)).toBe(MAX_BOOKS);
    expect(bookSlots(5)).toHaveLength(5);
    expect(bookSlots(0)).toEqual([]);
  });

  it("fills in a fixed order and gives every book its own place", () => {
    const slots = bookSlots(MAX_BOOKS);
    expect(new Set(slots.map((s) => `${s.x}:${s.y}`)).size).toBe(MAX_BOOKS);
    expect(slots.slice(0, BOOKS_PER_ROW).every((s) => s.y === slots[0].y)).toBe(true);
    // The books a count adds first are the same books whatever the count: a shelf grows, it is not redrawn.
    expect(bookSlots(2)).toEqual(slots.slice(0, 2));
  });
});
