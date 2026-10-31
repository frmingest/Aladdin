import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { MODELS3D } from "./models3d";
import { NPCS, nearestNpc } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { TOWNSFOLK } from "./townsfolk";

describe("townsfolk", () => {
  it("each has a model slot, and ids are unique", () => {
    for (const t of TOWNSFOLK) expect(MODELS3D[t.id], t.id).toBeDefined();
    expect(new Set(TOWNSFOLK.map((t) => t.id)).size).toBe(TOWNSFOLK.length);
  });

  it("stand on the cobbles, clear of the keep, pads, props, scenery, people and the spawn point", () => {
    for (const t of TOWNSFOLK) {
      expect(Math.hypot(t.x, t.z), t.id).toBeLessThan(COBBLE_RADIUS - 1);
      const inKeep = Math.abs(t.x - KEEP.x) < KEEP.width / 2 + 2 && Math.abs(t.z - KEEP.z) < KEEP.depth / 2 + 2;
      expect(inKeep, t.id).toBe(false);
      for (const s of towerSpots()) expect(Math.hypot(t.x - s.x, t.z - s.z), t.id).toBeGreaterThan(4);
      for (const p of PROPS) expect(Math.hypot(t.x - p.x, t.z - p.z), `${t.id}/${p.id}`).toBeGreaterThan(p.solid + 1.2);
      for (const c of SCENERY) expect(Math.hypot(t.x - c.x, t.z - c.z), `${t.id}/${c.id}`).toBeGreaterThan(c.solid + 1.2);
      for (const n of NPCS) expect(Math.hypot(t.x - n.x, t.z - n.z), `${t.id}/${n.id}`).toBeGreaterThan(5);
      expect(Math.hypot(t.x - SPAWN.x, t.z - SPAWN.z), t.id).toBeGreaterThan(3);
      const onRoad = t.z > 26 && Math.abs(t.x) < 3 + 0.5;
      expect(onRoad, t.id).toBe(false);
    }
  });

  it("opens nothing: walking up to them is not talking range of a person with a dialogue", () => {
    for (const t of TOWNSFOLK) expect(nearestNpc({ x: t.x, z: t.z })).toBeNull();
  });
});
