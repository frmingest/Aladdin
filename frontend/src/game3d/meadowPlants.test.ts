import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIELDS, RIVER_HALF, distToPolyline, fieldReach, riverLine, thinnedHorizon, tracks } from "./countryside";
import { onGateRoad } from "./horizonPieces";
import {
  COUNTS,
  FOREST_URL,
  LOOK,
  MODELS_OF,
  PLANTS,
  PLANTS_MAX,
  PLANT_INNER,
  PLANT_MODELS_MAX,
  PLANT_OUTER,
  PLANT_SOLIDS_MAX,
  buildPlants,
} from "./meadowPlants";

const file = join(__dirname, "../../public", FOREST_URL);

function glbNodes(): string[] {
  const buf = readFileSync(file);
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
  expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
  return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
}

describe("meadow plants: the file", () => {
  it("every plant names a node in forest.glb, every model has a look, and ids are unique", () => {
    const nodes = glbNodes();
    for (const p of PLANTS) expect(nodes, p.id).toContain(p.model);
    for (const m of Object.keys(LOOK)) expect(nodes, m).toContain(m);
    expect(new Set(PLANTS.map((p) => p.id)).size).toBe(PLANTS.length);
  });

  it("the file is small (600 KB ceiling) and the set stays in budget", () => {
    expect(statSync(file).size).toBeLessThanOrEqual(600 * 1024);
    expect(PLANTS.length).toBeGreaterThan(60);
    expect(PLANTS.length).toBeLessThanOrEqual(PLANTS_MAX);
    expect(new Set(PLANTS.map((p) => p.model)).size).toBeLessThanOrEqual(PLANT_MODELS_MAX);
    expect(PLANTS.filter((p) => p.solid > 0).length).toBeLessThanOrEqual(PLANT_SOLIDS_MAX);
  });

  it("each kind uses only its own models and never exceeds its count", () => {
    for (const p of PLANTS) expect(MODELS_OF[p.kind]).toContain(p.model);
    for (const k of Object.keys(COUNTS) as (keyof typeof COUNTS)[]) {
      const n = PLANTS.filter((p) => p.kind === k).length;
      expect(n, k).toBeLessThanOrEqual(COUNTS[k]);
      expect(n, k).toBeGreaterThan(0);
    }
  });
});

describe("meadow plants: open ground only", () => {
  it("stay on the meadow, outside the lane round the wall and inside its edge", () => {
    for (const p of PLANTS) {
      const r = Math.hypot(p.x, p.z);
      expect(r, p.id).toBeGreaterThanOrEqual(PLANT_INNER);
      expect(r, p.id).toBeLessThanOrEqual(PLANT_OUTER);
    }
  });

  it("none stands in the river, on a track or on a field", () => {
    const river = riverLine();
    for (const p of PLANTS) {
      const at = { x: p.x, z: p.z };
      expect(distToPolyline(at, river), `${p.id} river`).toBeGreaterThan(RIVER_HALF + p.reach);
      for (const t of tracks()) expect(distToPolyline(at, t.points), `${p.id} ${t.id}`).toBeGreaterThan(t.width / 2 + p.reach);
      for (const f of FIELDS) expect(Math.hypot(p.x - f.x, p.z - f.z), `${p.id} ${f.id}`).toBeGreaterThan(fieldReach(f) + p.reach);
    }
  });

  it("none stands on the gate road, and none overlaps a horizon tree or boulder", () => {
    for (const p of PLANTS) expect(onGateRoad(p.x, p.z, 8), p.id).toBe(false);
    for (const g of thinnedHorizon().filter((h) => h.ring === "grove" || h.ring === "rock"))
      for (const p of PLANTS) expect(Math.hypot(p.x - g.x, p.z - g.z), `${p.id} ${g.id}`).toBeGreaterThan(Math.max(g.solid, g.scale * 0.45) + p.reach);
  });

  it("trees and boulders do not overlap each other", () => {
    const big = PLANTS.filter((p) => p.kind === "tree" || p.kind === "rock");
    for (let i = 0; i < big.length; i++)
      for (let j = i + 1; j < big.length; j++) expect(Math.hypot(big[i].x - big[j].x, big[i].z - big[j].z), `${big[i].id} ${big[j].id}`).toBeGreaterThanOrEqual(big[i].reach + big[j].reach);
  });

  it("only trees and boulders stop you; bushes and tufts are walked through", () => {
    for (const p of PLANTS) expect(p.solid > 0, p.id).toBe(p.kind === "tree" || p.kind === "rock");
  });
});

describe("meadow plants carry no fact", () => {
  it("the plan takes no input and is the same every time", () => {
    expect(buildPlants.length).toBeLessThanOrEqual(1);
    expect(JSON.stringify(buildPlants())).toBe(JSON.stringify(PLANTS));
  });

  it("the file never imports a holding, theme, wall, moat or verdict", () => {
    const src = readFileSync(join(__dirname, "meadowPlants.ts"), "utf8");
    const imports = src.split("\n").filter((l) => l.startsWith("import "));
    for (const l of imports) expect(l).not.toMatch(/lib\/sectors|wallTier|moat|verdict|holding(?!Land)/i);
  });
});
