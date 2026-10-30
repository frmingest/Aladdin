import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { NPCS } from "./npcs";
import { PROPS, PROP_CLEARANCE } from "./props";

describe("courtyard props", () => {
  it("every prop has a known model and a sensible size", () => {
    for (const p of PROPS) {
      expect(["fountain", "lamp", "board", "perch"], p.id).toContain(p.kind);
      expect(p.height).toBeGreaterThan(1);
      expect(p.solid).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(PROPS.map((p) => p.id)).size).toBe(PROPS.length);
  });

  it("stands on the cobbles, clear of the keep, every pad, both people and the spawn point", () => {
    const spots = towerSpots();
    for (const p of PROPS) {
      expect(Math.hypot(p.x, p.z), p.id).toBeLessThan(COBBLE_RADIUS - 1);
      const inKeep =
        Math.abs(p.x - KEEP.x) < KEEP.width / 2 + PROP_CLEARANCE && Math.abs(p.z - KEEP.z) < KEEP.depth / 2 + PROP_CLEARANCE;
      expect(inKeep, p.id).toBe(false);
      for (const s of spots) expect(Math.hypot(p.x - s.x, p.z - s.z), p.id).toBeGreaterThan(1.7 + PROP_CLEARANCE);
      for (const n of NPCS) expect(Math.hypot(p.x - n.x, p.z - n.z), p.id).toBeGreaterThan(PROP_CLEARANCE + 1);
      expect(Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z), p.id).toBeGreaterThan(PROP_CLEARANCE + 1);
    }
  });

  it("keeps the gate road open and props apart from each other", () => {
    for (const p of PROPS) {
      const onRoad = p.z > 26 && Math.abs(p.x) < 3 + p.solid;
      expect(onRoad, p.id).toBe(false);
    }
    for (let i = 0; i < PROPS.length; i++)
      for (let j = i + 1; j < PROPS.length; j++) {
        const a = PROPS[i];
        const b = PROPS[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThan(a.solid + b.solid + 1);
      }
  });
});
