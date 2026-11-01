import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMP, CAMP_CENTER, CAMP_REACH, CAMP_URL } from "./campPieces";
import { DESK, SHELF } from "./desk";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { MARKET } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { DRILL_POST } from "./stormDrill";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";

function glbNodes(): string[] {
  const buf = readFileSync(join(__dirname, "../../public", CAMP_URL));
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
  expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
  return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
}

describe("drill camp", () => {
  it("every piece names a node in camp.glb, ids are unique, and the file is small", () => {
    const nodes = glbNodes();
    for (const p of CAMP) expect(nodes, p.id).toContain(p.model);
    expect(new Set(CAMP.map((p) => p.id)).size).toBe(CAMP.length);
    expect(statSync(join(__dirname, "../../public", CAMP_URL)).size).toBeLessThanOrEqual(400 * 1024);
  });

  it("uses no red or green piece, so nothing can read as a status colour", () => {
    for (const p of CAMP) expect(p.model, p.id).not.toMatch(/red|green/);
  });

  it("stands in the south-west on the cobbles and does not overlap itself", () => {
    for (const p of CAMP) {
      expect(Math.hypot(p.x - CAMP_CENTER.x, p.z - CAMP_CENTER.z), p.id).toBeLessThan(CAMP_REACH);
      expect(Math.hypot(p.x, p.z), p.id).toBeLessThan(COBBLE_RADIUS - 0.5);
    }
    const solid = CAMP.filter((p) => p.solid > 0);
    for (const a of solid) for (const b of solid) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThan(a.solid + b.solid);
  });

  it("is clear of the keep, pads, people, desk, spawn, market, props, scenery and torches", () => {
    const spots = towerSpots();
    const others = [
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...SCENERY.filter((p) => p.y === 0).map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      ...[...NPCS, ...TOWNSFOLK].map((n) => ({ id: n.id, x: n.x, z: n.z, r: 1.5 })),
      { id: "desk", ...DESK, r: 3 },
      { id: "shelf", ...SHELF, r: 3 },
    ];
    for (const p of CAMP) {
      const r = Math.max(p.solid, 0.3);
      const inKeep = Math.abs(p.x - KEEP.x) < KEEP.width / 2 + 2.5 && Math.abs(p.z - KEEP.z) < KEEP.depth / 2 + 2.5;
      expect(inKeep, p.id).toBe(false);
      for (const s of spots) expect(Math.hypot(p.x - s.x, p.z - s.z), `${p.id}/pad`).toBeGreaterThan(1.7 + 2.5 + r * 0.5);
      for (const o of others) expect(Math.hypot(p.x - o.x, p.z - o.z), `${p.id}/${o.id}`).toBeGreaterThan(r + o.r);
      expect(Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z), p.id).toBeGreaterThan(r + 3);
    }
  });

  it("leaves the player's place at the post well clear of every solid piece", () => {
    for (const p of CAMP) expect(Math.hypot(p.x - DRILL_POST.x, p.z - DRILL_POST.z), p.id).toBeGreaterThan(p.solid + 3);
  });

  it("the post itself is clear of the camp, pads, people and desk", () => {
    for (const s of towerSpots()) expect(Math.hypot(DRILL_POST.x - s.x, DRILL_POST.z - s.z)).toBeGreaterThan(5);
    for (const n of [...NPCS, ...TOWNSFOLK]) expect(Math.hypot(DRILL_POST.x - n.x, DRILL_POST.z - n.z), n.id).toBeGreaterThan(3);
    expect(Math.hypot(DRILL_POST.x - DESK.x, DRILL_POST.z - DESK.z)).toBeGreaterThan(8);
  });
});
