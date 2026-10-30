import { describe, expect, it } from "vitest";
import {
  COBBLE_RADIUS,
  GATE_HALF_ANGLE,
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

  it("spawns the player inside the walls", () => {
    expect(Math.hypot(SPAWN.x, SPAWN.z)).toBeLessThan(WALL_RADIUS);
  });
});
