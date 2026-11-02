import { describe, expect, it } from "vitest";
import { CLIP } from "./animClips";
import { DESK, DESK_FACING, SHELF } from "./desk";
import { COBBLE_RADIUS, SPAWN, towerSpots } from "./layout";
import { MODELS3D } from "./models3d";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { SIZE_RADIUS } from "./stateToWorld";
import { exitSpot } from "./towerDoor";
import { TOWNSFOLK } from "./townsfolk";
import { VAULT, VAULT_SOLID } from "./vaultPlan";
import { WORKERS, inFrame } from "./workers";

const chest = WORKERS.find((w) => w.id === "keeper")!;
const scribe = WORKERS.find((w) => w.id === "scribe")!;

describe("workers (the scribe and the vault keeper)", () => {
  it("each has a model slot, a clip, and an id of its own", () => {
    for (const w of WORKERS) expect(MODELS3D[w.id], w.id).toBeDefined();
    expect(new Set(WORKERS.map((w) => w.id)).size).toBe(WORKERS.length);
    expect(scribe.pose).toBe(CLIP.sit);
    expect(chest.pose).toBe(CLIP.useItem);
  });

  it("inFrame turns a furniture-frame point into the world", () => {
    expect(inFrame({ x: 1, z: 2 }, 0, 3, 4)).toEqual({ x: 4, z: 6 });
    const q = inFrame({ x: 0, z: 0 }, Math.PI / 2, 0, 1);
    expect(q.x).toBeCloseTo(1, 6);
    expect(q.z).toBeCloseTo(0, 6);
  });

  it("the scribe sits on the desk's chair and looks at the desk", () => {
    const chair = inFrame(DESK, DESK_FACING, 0, 1.15);
    expect(Math.hypot(scribe.x - chair.x, scribe.z - chair.z)).toBeLessThan(0.2);
    // His front points from the chair toward the desk.
    const dx = Math.sin(scribe.facing);
    const dz = Math.cos(scribe.facing);
    expect(dx * (DESK.x - scribe.x) + dz * (DESK.z - scribe.z)).toBeGreaterThan(0.9);
  });

  it("the keeper stands clear of the chest's solid body and looks at it", () => {
    const d = Math.hypot(chest.x - VAULT.x, chest.z - VAULT.z);
    expect(d).toBeGreaterThan(Math.max(VAULT_SOLID.hx, VAULT_SOLID.hz) + 0.6);
    const dx = Math.sin(chest.facing);
    const dz = Math.cos(chest.facing);
    expect(dx * (VAULT.x - chest.x) + dz * (VAULT.z - chest.z)).toBeGreaterThan(1.5);
  });

  it("stand on the cobbles, clear of pads, people, props, scenery, the spawn and each other", () => {
    for (const w of WORKERS) {
      expect(Math.hypot(w.x, w.z), w.id).toBeLessThan(COBBLE_RADIUS - 1);
      for (const s of towerSpots()) expect(Math.hypot(w.x - s.x, w.z - s.z), `${w.id}/pad`).toBeGreaterThan(4);
      for (const n of NPCS) expect(Math.hypot(w.x - n.x, w.z - n.z), `${w.id}/${n.id}`).toBeGreaterThan(5);
      for (const t of TOWNSFOLK) expect(Math.hypot(w.x - t.x, w.z - t.z), `${w.id}/${t.id}`).toBeGreaterThan(3.5);
      for (const p of PROPS) expect(Math.hypot(w.x - p.x, w.z - p.z), `${w.id}/${p.id}`).toBeGreaterThan(p.solid + 1.2);
      for (const c of SCENERY) if (c.solid > 0) expect(Math.hypot(w.x - c.x, w.z - c.z), `${w.id}/${c.id}`).toBeGreaterThan(c.solid + 1.2);
      expect(Math.hypot(w.x - SPAWN.x, w.z - SPAWN.z), w.id).toBeGreaterThan(10);
      for (const o of WORKERS) if (o !== w) expect(Math.hypot(w.x - o.x, w.z - o.z)).toBeGreaterThan(3);
    }
    expect(Math.hypot(chest.x - SHELF.x, chest.z - SHELF.z)).toBeGreaterThan(3);
  });

  it("is never where a hero stepping out of a tower is put down", () => {
    for (const s of towerSpots())
      for (const r of Object.values(SIZE_RADIUS)) {
        const out = exitSpot(s, r);
        for (const w of WORKERS) expect(Math.hypot(out.x - w.x, out.z - w.z), `${w.id} vs exit of ${s.x},${s.z}`).toBeGreaterThanOrEqual(1.5);
      }
  });
});
