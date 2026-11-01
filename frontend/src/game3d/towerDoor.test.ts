import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, RESERVED_ZONES, towerSpots } from "./layout";
import { DESK, SHELF } from "./desk";
import { NPCS } from "./npcs";
import { ENTER_LEAVE_REACH, ENTER_REACH, doorSpot, doorYaw, exitCameraYaw, exitSpot, nearestTower } from "./towerDoor";

const RADII = [1.2, 1.3, 1.5, 1.8, 2.1];

describe("tower doors", () => {
  it("faces the middle of the courtyard", () => {
    for (const s of towerSpots()) {
      const d = doorSpot(s, 1.8);
      expect(Math.hypot(d.x, d.z)).toBeLessThan(Math.hypot(s.x, s.z));
    }
    // Facing: a tower north of the middle looks south (+z), one west of it looks east (+x).
    expect(Math.cos(doorYaw({ x: 0, z: -10 }))).toBeCloseTo(1, 5);
    expect(Math.sin(doorYaw({ x: -10, z: 0 }))).toBeCloseTo(1, 5);
  });

  it("puts you back clear of the stone, on the cobbles, facing out, with the camera on the tower side", () => {
    for (const s of towerSpots()) {
      for (const r of RADII) {
        const out = exitSpot(s, r);
        const d = Math.hypot(out.x - s.x, out.z - s.z);
        expect(d).toBeGreaterThanOrEqual(r + 2.2 - 1e-9);
        expect(Math.hypot(out.x, out.z)).toBeLessThan(COBBLE_RADIUS);
        // The camera sits 5 behind the hero: it must end up nearer the tower than the hero is.
        const yaw = exitCameraYaw(s, out);
        const cam = { x: out.x + Math.sin(yaw) * 5, z: out.z + Math.cos(yaw) * 5 };
        expect(Math.hypot(cam.x - s.x, cam.z - s.z)).toBeLessThan(d);
      }
    }
  });

  it("lands you clear of the desk, the shelf, the keep, the people and every other pad", () => {
    const spots = towerSpots();
    spots.forEach((s, i) => {
      for (const r of RADII) {
        const out = exitSpot(s, r);
        expect(Math.hypot(out.x - DESK.x, out.z - DESK.z)).toBeGreaterThanOrEqual(2.4);
        expect(Math.hypot(out.x - SHELF.x, out.z - SHELF.z)).toBeGreaterThanOrEqual(2.4);
        for (const n of NPCS) expect(Math.hypot(out.x - n.x, out.z - n.z)).toBeGreaterThanOrEqual(1.6);
        expect(Math.abs(out.x - KEEP.x) >= KEEP.width / 2 + 1 || Math.abs(out.z - KEEP.z) >= KEEP.depth / 2 + 1).toBe(true);
        spots.forEach((o, j) => {
          if (i !== j) expect(Math.hypot(out.x - o.x, out.z - o.z)).toBeGreaterThanOrEqual(3.3);
        });
        for (const z of RESERVED_ZONES) expect(Math.hypot(out.x - z.x, out.z - z.z)).toBeGreaterThanOrEqual(z.radius);
      }
    });
  });

  it("picks the tower you are next to, measured from its wall, and lets go a little later", () => {
    const towers = [
      { holdingId: "a", spot: { x: 0, z: 0 }, radius: 2 },
      { holdingId: "b", spot: { x: 20, z: 0 }, radius: 1.2 },
    ];
    expect(nearestTower({ x: 2 + ENTER_REACH - 0.1, z: 0 }, towers)?.holdingId).toBe("a");
    expect(nearestTower({ x: 2 + ENTER_REACH + 0.5, z: 0 }, towers)).toBeNull();
    expect(nearestTower({ x: 2 + ENTER_REACH + 0.5, z: 0 }, towers, ENTER_LEAVE_REACH)?.holdingId).toBe("a");
    expect(nearestTower({ x: 18, z: 0 }, towers)?.holdingId).toBe("b");
    expect(nearestTower({ x: 10, z: 30 }, towers)).toBeNull();
  });
});
