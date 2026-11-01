import { describe, expect, it } from "vitest";
import { CORNER_TOWER_MODEL, CORNER_TOWER_SCALE, KEEP_FACE_Z_MODEL, KEEP_MODEL, KEEP_MODEL_SCALE, cornerTowerFootprint, keepModelFootprint } from "./keepModels";
import { KEEP, WALL_RADIUS, cornerTowers } from "./layout";

describe("keep and corner tower models", () => {
  it("the keep model stands inside the old keep's footprint, south face on the old face", () => {
    const f = keepModelFootprint();
    expect(f.width).toBeLessThanOrEqual(KEEP.width);
    expect(f.depth).toBeLessThanOrEqual(KEEP.depth + 1);
    expect(f.centerZ + f.depth / 2).toBeCloseTo(KEEP_FACE_Z_MODEL);
    expect(KEEP_MODEL_SCALE).toBeGreaterThan(0);
  });
  it("the keep is taller than the curtain wall and the towers are too", () => {
    expect(keepModelFootprint().height).toBeGreaterThan(6);
    expect(cornerTowerFootprint().height).toBeGreaterThan(6);
    expect(KEEP_MODEL.height * KEEP_MODEL_SCALE).toBeGreaterThan(CORNER_TOWER_MODEL.height * CORNER_TOWER_SCALE);
  });
  it("corner towers sit on the wall ring and do not reach the gate", () => {
    const r = cornerTowerFootprint().radius;
    for (const t of cornerTowers()) {
      expect(Math.hypot(t.x, t.z)).toBeCloseTo(WALL_RADIUS);
      expect(Math.abs(t.x)).toBeGreaterThan(r + 4); // the gate is 7 wide at x=0
    }
  });
});
