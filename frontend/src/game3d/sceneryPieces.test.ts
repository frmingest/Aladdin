import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots, WALL_RADIUS } from "./layout";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY, SCENERY_CLEARANCE, SCENERY_URL } from "./sceneryPieces";

const standing = SCENERY.filter((p) => p.y === 0);
const hanging = SCENERY.filter((p) => p.y > 0);

function glbNodes(): string[] {
  const buf = readFileSync(join(__dirname, "../../public", SCENERY_URL));
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
  expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
  return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
}

describe("courtyard scenery", () => {
  it("every piece names a node that is in scenery.glb, and ids are unique", () => {
    const nodes = glbNodes();
    for (const p of SCENERY) expect(nodes, p.id).toContain(p.model);
    expect(new Set(SCENERY.map((p) => p.id)).size).toBe(SCENERY.length);
  });

  it("the file is small and the set stays a handful of pieces", () => {
    expect(statSync(join(__dirname, "../../public", SCENERY_URL)).size).toBeLessThanOrEqual(1024 * 1024);
    expect(SCENERY.length).toBeGreaterThanOrEqual(12);
    expect(SCENERY.length).toBeLessThanOrEqual(24);
  });

  it("no red or green flags or banners: nothing can read as a status colour", () => {
    for (const p of SCENERY) expect(p.model, p.id).not.toMatch(/red|green/);
  });

  it("standing pieces are on the cobbles, clear of the keep, every pad, both people and the spawn point", () => {
    const spots = towerSpots();
    for (const p of standing) {
      expect(Math.hypot(p.x, p.z), p.id).toBeLessThan(COBBLE_RADIUS - 1);
      const inKeep =
        Math.abs(p.x - KEEP.x) < KEEP.width / 2 + SCENERY_CLEARANCE &&
        Math.abs(p.z - KEEP.z) < KEEP.depth / 2 + SCENERY_CLEARANCE;
      expect(inKeep, p.id).toBe(false);
      for (const s of spots) expect(Math.hypot(p.x - s.x, p.z - s.z), p.id).toBeGreaterThan(1.7 + SCENERY_CLEARANCE);
      for (const n of NPCS) expect(Math.hypot(p.x - n.x, p.z - n.z), p.id).toBeGreaterThan(SCENERY_CLEARANCE + p.solid);
      expect(Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z), p.id).toBeGreaterThan(SCENERY_CLEARANCE + 1);
    }
  });

  it("keeps the gate road open and pieces apart from each other and from the props", () => {
    for (const p of standing) expect(p.z > 26 && Math.abs(p.x) < 3 + p.solid, p.id).toBe(false);
    const solids = [...standing.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })), ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid }))];
    for (let i = 0; i < solids.length; i++)
      for (let j = i + 1; j < solids.length; j++) {
        const a = solids[i];
        const b = solids[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThan(a.r + b.r + 0.3);
      }
  });

  it("hanging pieces are on the keep's south face or on the inner face of the wall", () => {
    for (const p of hanging) {
      const onKeep = Math.abs(p.z - (KEEP.z + KEEP.depth / 2)) < 0.6 && Math.abs(p.x) < KEEP.width / 2;
      const onWall = Math.abs(Math.hypot(p.x, p.z) - (WALL_RADIUS - 0.8)) < 0.3;
      expect(onKeep || onWall, p.id).toBe(true);
      expect(p.solid, p.id).toBe(0);
    }
  });
});
