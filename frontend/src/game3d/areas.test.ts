import { describe, expect, it } from "vitest";
import { AREAS, RESERVED_AREA_IDS, pathToCourtyard, returnSpot, sameArea, transitionSpot } from "./areas";
import type { AreaId, AreaRef } from "./areas";
import { towerSpots } from "./layout";
import { exitCameraYaw, exitSpot } from "./towerDoor";
import type { Enterable } from "./towerDoor";
import { hallExit, HALL as HALL_BOX } from "./townHallRoom";
import { HALL as LIB_BOX } from "./libraryRoom";
import { INTERIOR_BOX } from "./interiorBox";
import { archiveExit } from "./recordsHallRoom";
import { GATE_RETURN, GATE_RETURN_YAW } from "./townPlan";

const IDS = Object.keys(AREAS) as AreaId[];
const towers: Enterable[] = towerSpots().map((spot, i) => ({ holdingId: `h${i}`, spot, radius: 1.5 + (i % 3) * 0.3 }));

describe("area registry", () => {
  it("has unique ids that match their keys, and none of the reserved names", () => {
    expect(new Set(IDS).size).toBe(IDS.length);
    for (const id of IDS) expect(AREAS[id].id).toBe(id);
    for (const r of RESERVED_AREA_IDS) expect(IDS).not.toContain(r);
  });

  it("puts every spawn inside its own bounds", () => {
    for (const id of IDS) {
      const { spawn, bounds } = AREAS[id];
      expect(spawn.x).toBeGreaterThan(bounds.minX);
      expect(spawn.x).toBeLessThan(bounds.maxX);
      expect(spawn.z).toBeGreaterThan(bounds.minZ);
      expect(spawn.z).toBeLessThan(bounds.maxZ);
    }
  });

  it("never spawns you within reach of a door (E would send you straight back)", () => {
    for (const id of IDS) {
      const { spawn, doors } = AREAS[id];
      for (const d of doors) {
        expect(Math.hypot(d.x - spawn.x, d.z - spawn.z), `${id}/${d.id}`).toBeGreaterThan(Math.max(d.range, d.leaveRange));
      }
    }
  });

  it("gives every door a wider leave range than arrive range, inside the bounds, to a real place", () => {
    for (const id of IDS) {
      const { doors, bounds } = AREAS[id];
      for (const d of doors) {
        expect(d.leaveRange).toBeGreaterThan(d.range);
        expect(d.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(d.x).toBeLessThanOrEqual(bounds.maxX);
        expect(d.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(d.z).toBeLessThanOrEqual(bounds.maxZ);
        if (d.to !== "parent") expect(IDS).toContain(d.to);
        else expect(AREAS[id].parent).not.toBeNull();
      }
    }
  });

  it("reaches the courtyard from every area, with no loops and no orphans", () => {
    for (const id of IDS) {
      const path = pathToCourtyard(id);
      expect(path[path.length - 1]).toBe("courtyard");
      expect(new Set(path).size).toBe(path.length);
    }
    expect(AREAS.courtyard.parent).toBeNull();
    for (const id of IDS) if (id !== "courtyard") expect(IDS).toContain(AREAS[id].parent);
  });

  it("lights interiors indoors and everything else outdoors, whatever the verdict", () => {
    for (const id of IDS) expect(AREAS[id].lighting).toBe(AREAS[id].kind);
  });

  it("shares one interior box between the library room (kept for now) and the Town Hall", () => {
    expect(LIB_BOX).toBe(INTERIOR_BOX);
    expect(HALL_BOX).toBe(INTERIOR_BOX);
  });

  it("compares areas by id and holding", () => {
    expect(sameArea({ id: "town" }, { id: "town" })).toBe(true);
    expect(sameArea({ id: "holding", holdingId: "a" }, { id: "holding", holdingId: "a" })).toBe(true);
    expect(sameArea({ id: "holding", holdingId: "a" }, { id: "holding", holdingId: "b" })).toBe(false);
    expect(sameArea({ id: "town" }, { id: "courtyard" })).toBe(false);
  });
});

describe("returnSpot (same numbers as before S21)", () => {
  it("steps out of a holding's land where exitSpot says", () => {
    for (const t of towers) {
      const out = exitSpot(t.spot, t.radius);
      expect(returnSpot({ id: "holding", holdingId: t.holdingId }, { id: "courtyard" }, towers)).toEqual({
        x: out.x,
        z: out.z,
        yaw: exitCameraYaw(t.spot, out),
      });
    }
  });
  it("gives nothing for a land whose tower is gone", () => {
    expect(returnSpot({ id: "holding", holdingId: "nope" }, { id: "courtyard" }, towers)).toBeNull();
  });
  it("steps out of the Town, the Town Hall and the Hall of Records", () => {
    expect(returnSpot({ id: "town" }, { id: "courtyard" }, [])).toEqual({ x: GATE_RETURN.x, z: GATE_RETURN.z, yaw: GATE_RETURN_YAW });
    expect(returnSpot({ id: "townhall" }, { id: "town" }, [])).toEqual(hallExit());
    expect(returnSpot({ id: "records" }, { id: "town" }, [])).toEqual(archiveExit());
  });
  it("transitionSpot: in goes to the spawn, out goes to the return spot", () => {
    const land: AreaRef = { id: "holding", holdingId: "h0" };
    expect(transitionSpot({ id: "courtyard" }, land, towers)).toEqual(AREAS.holding.spawn);
    expect(transitionSpot(land, { id: "courtyard" }, towers)).toEqual(returnSpot(land, { id: "courtyard" }, towers));
    expect(transitionSpot({ id: "town" }, { id: "townhall" }, [])).toEqual(AREAS.townhall.spawn);
    expect(transitionSpot({ id: "town" }, { id: "town" }, [])).toBeNull();
  });
});
