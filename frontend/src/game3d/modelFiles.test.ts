import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
      for (const clip of ["Idle", "Walking_A", "Running_A", "Cheer", "Interact", "Spellcasting"]) {
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
