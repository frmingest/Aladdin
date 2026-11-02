import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Test helper: the JSON header of a .glb under public/, read without any 3D code. */
export interface GlbJson {
  nodes?: { name?: string }[];
  scenes?: { nodes?: number[] }[];
  meshes?: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  accessors?: { count: number }[];
  images?: unknown[];
  skins?: { joints: number[] }[];
  animations?: { name?: string; channels: { target: { node?: number; path: string } }[] }[];
  extensionsUsed?: string[];
}

export function glbJson(url: string): GlbJson {
  const buf = readFileSync(join(__dirname, "../../public", url));
  if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error(`${url} is not a glb`);
  return JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
}

export const glbBytes = (url: string): number => statSync(join(__dirname, "../../public", url)).size;

export function glbTopNodes(j: GlbJson): string[] {
  return (j.scenes?.[0]?.nodes ?? []).map((i) => j.nodes?.[i]?.name ?? "");
}

export function glbTriangles(j: GlbJson): number {
  let t = 0;
  for (const m of j.meshes ?? []) for (const p of m.primitives) t += p.indices === undefined ? 0 : (j.accessors?.[p.indices]?.count ?? 0) / 3;
  return t;
}

export function glbJointNames(j: GlbJson): string[] {
  return (j.skins?.[0]?.joints ?? []).map((i) => j.nodes?.[i]?.name ?? "");
}
