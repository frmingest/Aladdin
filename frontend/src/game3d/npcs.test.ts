import { describe, expect, it } from "vitest";
import { KEEP, WALL_RADIUS, towerSpots } from "./layout";
import { ADVISOR_PAIR_MAX_GAP, ADVISOR_PAIR_MIN_GAP, LEAVE_RANGE, alsoHereNote, NPCS, TALK_RANGE, nearestNpc, yawToward } from "./npcs";

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
    }
  });

  it("stands the two advisors side by side: close enough to read as a pair, far enough that the bodies do not overlap", () => {
    const [a, b] = NPCS;
    const gap = Math.hypot(a.x - b.x, a.z - b.z);
    expect(gap).toBeGreaterThanOrEqual(ADVISOR_PAIR_MIN_GAP);
    expect(gap).toBeLessThanOrEqual(ADVISOR_PAIR_MAX_GAP);
  });

  it("answers E with the nearer advisor when you stand between the two", () => {
    const oracle = NPCS.find((n) => n.id === "oracle")!;
    const partner = NPCS.find((n) => n.id === "partner")!;
    // Both are in range from the middle, and a step toward one makes that one the answer.
    const mid = { x: (oracle.x + partner.x) / 2, z: (oracle.z + partner.z) / 2 };
    expect(nearestNpc(mid)).not.toBeNull();
    expect(nearestNpc({ x: oracle.x + 0.3, z: oracle.z })?.id).toBe("oracle");
    expect(nearestNpc({ x: partner.x - 0.3, z: partner.z })?.id).toBe("partner");
  });

  it("says who else stands beside each advisor, and nothing when nobody does", () => {
    expect(alsoHereNote("oracle")).toBe("Also here: Marlie Chunger");
    expect(alsoHereNote("partner")).toBe("Also here: Barren Wuffet");
    expect(alsoHereNote("oracle", [NPCS[0]])).toBeNull();
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
