import { describe, expect, it } from "vitest";
import { KEEP, TOWER_SPOT_RADIUS, WALL_RADIUS, towerSpots } from "./layout";
import { LEAVE_RANGE, NPCS, TALK_RANGE, nearestNpc, yawToward } from "./npcs";

describe("courtyard people", () => {
  it("finds the closest person in range, and nobody when out of range", () => {
    const oracle = NPCS.find((n) => n.id === "oracle")!;
    expect(nearestNpc({ x: oracle.x + 1, z: oracle.z + 1 })?.id).toBe("oracle");
    expect(nearestNpc({ x: 0, z: 0 })).toBeNull();
    expect(nearestNpc({ x: oracle.x + TALK_RANGE + 0.5, z: oracle.z })).toBeNull();
    expect(LEAVE_RANGE).toBeGreaterThan(TALK_RANGE);
  });

  it("stands inside the walls, outside the keep, and clear of every pad and of each other", () => {
    for (const n of NPCS) {
      expect(Math.hypot(n.x, n.z)).toBeLessThan(WALL_RADIUS - 3);
      const inKeep = Math.abs(n.x - KEEP.x) < KEEP.width / 2 + 1 && Math.abs(n.z - KEEP.z) < KEEP.depth / 2 + 1;
      expect(inKeep).toBe(false);
      for (const s of towerSpots()) expect(Math.hypot(n.x - s.x, n.z - s.z)).toBeGreaterThan(4.5);
      expect(Math.hypot(n.x, n.z)).toBeLessThan(TOWER_SPOT_RADIUS + 20);
    }
    const [a, b] = NPCS;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(TALK_RANGE * 2);
  });

  it("starts the hero out of range of both, so nothing opens by itself", () => {
    expect(nearestNpc({ x: 0, z: 24 })).toBeNull();
  });

  it("turns toward a point with the same convention as their resting facing", () => {
    for (const n of NPCS) expect(yawToward(n, { x: 0, z: 0 })).toBeCloseTo(n.facing);
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(0);
    expect(yawToward({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(Math.PI / 2);
  });

  it("each person has a model slot in the registry", async () => {
    const { MODELS3D } = await import("./models3d");
    for (const n of NPCS) expect(MODELS3D[n.art]).toBeDefined();
  });
});
