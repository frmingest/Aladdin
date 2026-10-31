import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, WALL_RADIUS } from "./layout";
import { wallSegments } from "./layout";
import {
  GROVE_INNER,
  GROVE_OUTER,
  HORIZON,
  HORIZON_LIMIT,
  HORIZON_MAX_MODELS,
  HORIZON_MAX_PIECES,
  HORIZON_URL,
  buildHorizon,
  onGateRoad,
  seeded,
} from "./horizonPieces";

const file = join(__dirname, "../../public", HORIZON_URL);

function glbNodes(): string[] {
  const buf = readFileSync(file);
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
  expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
  return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
}

describe("horizon shell", () => {
  it("every piece names a node that is in horizon.glb, and ids are unique", () => {
    const nodes = glbNodes();
    for (const p of HORIZON) expect(nodes, p.id).toContain(p.model);
    expect(new Set(HORIZON.map((p) => p.id)).size).toBe(HORIZON.length);
  });

  it("the file is small and the set stays inside the budget (instances, and models = draw calls)", () => {
    expect(statSync(file).size).toBeLessThanOrEqual(1024 * 1024);
    expect(HORIZON.length).toBeGreaterThan(40);
    expect(HORIZON.length).toBeLessThanOrEqual(HORIZON_MAX_PIECES);
    expect(new Set(HORIZON.map((p) => p.model)).size).toBeLessThanOrEqual(HORIZON_MAX_MODELS);
  });

  it("is the same on every build: a fixed seed, no clock, no data", () => {
    expect(buildHorizon()).toEqual(buildHorizon());
    expect(buildHorizon()).toEqual(HORIZON);
    expect(buildHorizon(8)).not.toEqual(HORIZON);
    const a = seeded(1);
    const b = seeded(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("grove and boulders stand outside the wall and the cobbles, short of the meadow's edge", () => {
    for (const p of HORIZON.filter((x) => x.ring === "grove" || x.ring === "rock")) {
      const r = Math.hypot(p.x, p.z);
      expect(r, p.id).toBeGreaterThanOrEqual(GROVE_INNER - 0.001);
      expect(r, p.id).toBeLessThanOrEqual(GROVE_OUTER + 0.001);
      expect(r - p.solid, p.id).toBeGreaterThan(WALL_RADIUS + 2);
      expect(r - p.solid, p.id).toBeGreaterThan(COBBLE_RADIUS);
      expect(r + p.solid, p.id).toBeLessThan(HORIZON_LIMIT - 2);
    }
  });

  it("keeps the gate road clear and no two solid pieces overlap", () => {
    const near = HORIZON.filter((p) => p.ring === "grove" || p.ring === "rock");
    for (const p of near) expect(onGateRoad(p.x, p.z, 3 + p.solid), p.id).toBe(false);
    for (let i = 0; i < near.length; i++)
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i];
        const b = near[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThan(a.solid + b.solid);
      }
  });

  it("hills and mountains are out of reach: beyond the invisible edge, with no colliders", () => {
    for (const p of HORIZON.filter((x) => x.ring === "hill" || x.ring === "mountain")) {
      expect(p.solid, p.id).toBe(0);
      expect(Math.hypot(p.x, p.z), p.id).toBeGreaterThan(HORIZON_LIMIT + 8);
    }
    expect(HORIZON.filter((p) => p.ring === "mountain").length).toBeGreaterThanOrEqual(10);
  });

  it("the invisible edge is a closed ring: nothing to walk through", () => {
    const segs = wallSegments(HORIZON_LIMIT, 48, 0);
    expect(segs.length).toBe(48);
  });

  it("only nature: no model name can read as a flag, a banner or a status", () => {
    for (const p of HORIZON) expect(p.model, p.id).toMatch(/^(tree|trees|rock|hills|mountain)_/);
  });
});
