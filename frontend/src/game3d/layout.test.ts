import { describe, expect, it } from "vitest";
import {
  COBBLE_RADIUS,
  GATE_HALF_ANGLE,
  KEEP,
  RESERVED_ZONES,
  SPAWN,
  TOWER_SPOT_COUNT,
  WALL_RADIUS,
  WALL_SEGMENTS,
  cornerTowers,
  towerSpots,
  wallSegments,
} from "./layout";

describe("courtyard layout", () => {
  it("leaves a gate in the south wall and closes the rest", () => {
    const segs = wallSegments();
    expect(segs.length).toBeLessThan(WALL_SEGMENTS);
    expect(segs.length).toBeGreaterThan(WALL_SEGMENTS - 6);
    // Nothing stands in the gate opening (due south, x near 0, z near the wall radius).
    const blocking = segs.filter((s) => Math.abs(s.x) < WALL_RADIUS * Math.sin(GATE_HALF_ANGLE) * 0.8 && s.z > 0);
    expect(blocking).toHaveLength(0);
    // The north is closed.
    expect(segs.some((s) => s.z < -WALL_RADIUS * 0.95)).toBe(true);
  });

  it("puts every wall piece on the ring", () => {
    for (const s of wallSegments()) {
      expect(Math.hypot(s.x, s.z)).toBeCloseTo(WALL_RADIUS, 6);
    }
  });

  it("places four corner towers away from the gate", () => {
    const towers = cornerTowers();
    expect(towers).toHaveLength(4);
    for (const t of towers) expect(Math.abs(t.x)).toBeGreaterThan(10);
  });

  it("makes one tower spot per holding, inside the courtyard", () => {
    const spots = towerSpots();
    expect(spots).toHaveLength(TOWER_SPOT_COUNT);
    for (const s of spots) {
      expect(Math.hypot(s.x, s.z)).toBeLessThan(COBBLE_RADIUS);
      expect(s.z).toBeLessThan(0); // north half
    }
  });

  it("spreads the towers across the courtyard, not in one clump", () => {
    const spots = towerSpots();
    const xs = spots.map((s) => s.x);
    const zs = spots.map((s) => s.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(40);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(20);
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z), `${i}/${j}`).toBeGreaterThanOrEqual(10);
    // Both sides get the same number, and the walk from the gate to the keep stays open.
    expect(spots.filter((s) => s.x < 0)).toHaveLength(spots.filter((s) => s.x > 0).length);
    for (const s of spots) expect(Math.abs(s.x)).toBeGreaterThan(8);
  });

  it("keeps every tower pad off the keep, the corner towers and the wall", () => {
    for (const s of towerSpots()) {
      const nearKeep = Math.abs(s.x - KEEP.x) < KEEP.width / 2 + 4 && Math.abs(s.z - KEEP.z) < KEEP.depth / 2 + 4;
      expect(nearKeep).toBe(false);
      expect(Math.hypot(s.x, s.z)).toBeLessThan(COBBLE_RADIUS - 1);
      for (const c of cornerTowers()) expect(Math.hypot(s.x - c.x, s.z - c.z)).toBeGreaterThan(7);
    }
  });

  it("holds no reserved ground now: the siege-simulator ground became the Storm Drill camp", () => {
    expect(RESERVED_ZONES).toEqual([]);
  });

  it("spawns the player inside the walls", () => {
    expect(Math.hypot(SPAWN.x, SPAWN.z)).toBeLessThan(WALL_RADIUS);
  });
});
