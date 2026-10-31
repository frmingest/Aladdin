import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS3D } from "./models3d";

/** Reads the JSON header of a .glb (node names and clip names) without loading any 3D code. */
function glbHeader(url: string): { nodes: string[]; clips: string[] } {
  const buf = readFileSync(join(__dirname, "../../public", url));
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength));
  return {
    nodes: (json.nodes ?? []).map((n: { name?: string }) => n.name ?? ""),
    clips: (json.animations ?? []).map((a: { name?: string }) => a.name ?? ""),
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
});
