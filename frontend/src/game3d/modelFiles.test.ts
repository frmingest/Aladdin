import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { glbBytes, glbJson, glbTriangles } from "./glbJson";
import { HOLDING_THEMES, HOLDING_URL, MARKET_QUARTER_URL, SIEGE_URL, SKELETON_FILES, SKELETON_URL, WORK_CLIPS_URL } from "./holdingPieces";
import { MODELS3D } from "./models3d";

/** Reads the JSON header of a .glb (node names and clip names) without loading any 3D code. */
function glbHeader(url: string): { nodes: string[]; clips: string[]; extensions: string[] } {
  const buf = readFileSync(join(__dirname, "../../public", url));
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength));
  return {
    nodes: (json.nodes ?? []).map((n: { name?: string }) => n.name ?? ""),
    clips: (json.animations ?? []).map((a: { name?: string }) => a.name ?? ""),
    extensions: json.extensionsUsed ?? [],
  };
}

describe("the model files the registry points at", () => {
  for (const [slot, spec] of Object.entries(MODELS3D)) {
    it(`${slot}: file exists, every hidden node is in it, and it has the clips we play`, () => {
      const { nodes, clips } = glbHeader(spec!.url);
      for (const name of spec!.hide) expect(nodes).toContain(name);
      for (const clip of ["Idle", "Walking_A", "Running_A"]) expect(clips).toContain(clip);
    });
  }

  for (const [slot, spec] of Object.entries(MODELS3D)) {
    it(`${slot}: stays inside the 1.5 MB budget and keeps the clips we may play`, () => {
      const bytes = statSync(join(__dirname, "../../public", spec!.url)).size;
      expect(bytes).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      const { clips } = glbHeader(spec!.url);
      for (const clip of ["Idle", "Walking_A", "Running_A", "Cheer", "Interact", "Spellcasting", "Sit_Chair_Idle", "Use_Item"]) {
        expect(clips).toContain(clip);
      }
    });
  }

  // S5 (2026-10-31): the first S4 build quantized the skinned meshes. Their raw bounds then no longer
  // matched the figure (Avatar fits and outlines from them), and the hero dropped out of the scene.
  for (const [slot, spec] of Object.entries(MODELS3D)) {
    it(`${slot}: no quantized or meshopt geometry (Avatar reads the raw vertex bounds)`, () => {
      const { extensions } = glbHeader(spec!.url);
      expect(extensions).not.toContain("KHR_mesh_quantization");
      expect(extensions).not.toContain("EXT_meshopt_compression");
    });
  }
});

// S26 (2026-11-02): budgets for the new packs, read from the file headers (discovery plan, "Budgets").
// Triangles are per file; the per-land total (<= 80k) is checked when a land is wired in.
describe("new pack budgets (bytes, meshes, triangles, images)", () => {
  const KB = 1024;
  const budgets: { url: string; bytes: number; meshes: number; tris: number; images: number }[] = [
    ...HOLDING_THEMES.map((t) => ({ url: HOLDING_URL(t), bytes: 600 * KB, meshes: 150, tris: 25_000, images: 4 })),
    { url: SIEGE_URL, bytes: 1024 * KB, meshes: 200, tris: 30_000, images: 1 },
    { url: MARKET_QUARTER_URL, bytes: 800 * KB, meshes: 150, tris: 30_000, images: 3 },
    ...SKELETON_FILES.map((n) => ({ url: SKELETON_URL(n), bytes: 650 * KB, meshes: 12, tris: 12_000, images: 1 })),
    { url: WORK_CLIPS_URL, bytes: 300 * KB, meshes: 0, tris: 0, images: 0 },
  ];
  for (const b of budgets) {
    it(`${b.url}: within ${Math.round(b.bytes / KB)} KB, ${b.meshes} meshes, ${b.tris} triangles, ${b.images} images`, () => {
      const j = glbJson(b.url);
      expect(glbBytes(b.url)).toBeLessThanOrEqual(b.bytes);
      expect((j.meshes ?? []).length).toBeLessThanOrEqual(b.meshes);
      expect(glbTriangles(j)).toBeLessThanOrEqual(b.tris);
      expect((j.images ?? []).length).toBeLessThanOrEqual(b.images);
      expect(j.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
      expect(j.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
    });
  }
});
