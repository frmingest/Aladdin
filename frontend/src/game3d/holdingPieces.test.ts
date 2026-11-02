import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { glbJointNames, glbJson, glbTopNodes } from "./glbJson";
import {
  AUDIO_FILES, FX_SPRITES, HOLDING_OWN, HOLDING_REUSE, HOLDING_THEMES, HOLDING_URL, MARKET_QUARTER_NODES, MARKET_QUARTER_URL,
  SIEGE_ENGINES, SIEGE_FLAGS, SIEGE_ROCKS, SIEGE_URL, SIEGE_WALLS, SIEGE_WRECKS, SKELETON_CLIPS, SKELETON_FILES, SKELETON_URL,
  WORK_CLIPS, WORK_CLIPS_URL, audioUrl, fxUrl,
} from "./holdingPieces";

const pub = (url: string) => join(__dirname, "../../public", url);

describe("holding-land packs", () => {
  for (const theme of HOLDING_THEMES) {
    it(`${theme}: every listed node is in its file and ids are unique`, () => {
      const nodes = glbTopNodes(glbJson(HOLDING_URL(theme)));
      expect(nodes).toEqual([...HOLDING_OWN[theme]]);
      expect(new Set(nodes).size).toBe(nodes.length);
    });
    it(`${theme}: every borrowed piece exists in the file it is borrowed from`, () => {
      for (const r of HOLDING_REUSE[theme]) {
        const nodes = glbTopNodes(glbJson(`/models/${r.file}`));
        for (const n of r.nodes) expect(nodes, `${r.file}:${n}`).toContain(n);
      }
    });
    it(`${theme}: no node name says red or green`, () => {
      for (const n of HOLDING_OWN[theme]) expect(n).not.toMatch(/red|green/i);
    });
  }
});

describe("siege.glb and market-quarter.glb", () => {
  it("siege.glb holds every engine, its wreck, the walls, flags and rocks", () => {
    const nodes = glbTopNodes(glbJson(SIEGE_URL));
    for (const n of [...SIEGE_ENGINES, ...SIEGE_WRECKS, ...SIEGE_WALLS, ...SIEGE_FLAGS, ...SIEGE_ROCKS]) expect(nodes, n).toContain(n);
    for (const n of nodes) expect(n).not.toMatch(/red|green/i);
  });
  it("market-quarter.glb lists exactly its nodes", () => {
    expect(glbTopNodes(glbJson(MARKET_QUARTER_URL))).toEqual([...MARKET_QUARTER_NODES]);
  });
});

describe("skeletons and work clips", () => {
  const knight = glbJointNames(glbJson("/models/Knight.glb"));
  for (const name of SKELETON_FILES) {
    it(`${name}: same 41 joint names as Knight.glb, keeps the clips, skinned float data`, () => {
      const j = glbJson(SKELETON_URL(name));
      expect(glbJointNames(j)).toEqual(knight);
      expect(knight.length).toBe(41);
      expect((j.animations ?? []).map((a) => a.name).sort()).toEqual([...SKELETON_CLIPS].sort());
      expect(j.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
      expect(j.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
    });
  }
  it("clips-work.glb: six clips whose tracks all name Knight.glb joints", () => {
    const j = glbJson(WORK_CLIPS_URL);
    expect((j.animations ?? []).map((a) => a.name).sort()).toEqual([...WORK_CLIPS].sort());
    const joints = new Set(knight);
    for (const a of j.animations ?? []) {
      expect(a.channels.length, a.name).toBeGreaterThan(0);
      for (const c of a.channels) expect(joints.has(j.nodes?.[c.target.node ?? -1]?.name ?? ""), `${a.name}:${c.target.node}`).toBe(true);
    }
    expect(j.meshes ?? []).toHaveLength(0);
  });
});

describe("opt-in audio and sprites", () => {
  it("every listed sound exists; at most 12, under 200 KB in all", () => {
    expect(AUDIO_FILES.length).toBeLessThanOrEqual(12);
    let total = 0;
    for (const a of AUDIO_FILES) {
      expect(existsSync(pub(audioUrl(a))), a).toBe(true);
      total += statSync(pub(audioUrl(a))).size;
    }
    expect(total).toBeLessThanOrEqual(200 * 1024);
  });
  it("at most 6 sprites, all present, under 120 KB in all", () => {
    expect(FX_SPRITES.length).toBeLessThanOrEqual(6);
    let total = 0;
    for (const f of FX_SPRITES) {
      expect(existsSync(pub(fxUrl(f))), f).toBe(true);
      total += statSync(pub(fxUrl(f))).size;
    }
    expect(total).toBeLessThanOrEqual(120 * 1024);
  });
});
