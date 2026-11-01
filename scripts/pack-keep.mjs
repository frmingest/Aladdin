// Packs the KayKit keep and corner-tower models (CC0) into ONE plain .glb for the 3D courtyard (keep + towers sprint).
// Usage (from a scratch folder with @gltf-transform/{core,extensions,functions} installed, like pack-props.mjs):
//   node pack-keep.mjs <KayKit-Medieval-Hexagon-Pack gltf buildings root> <out.glb>
// Node names: "keep" (building_castle_blue) and "corner_tower" (building_tower_B_blue).
// Blue only: the red and green variants could read as a status colour. Plain float vertices: no quantize, no meshopt.
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { join } from "node:path";

const [root, out] = process.argv.slice(2);
if (!root || !out) throw new Error("usage: node pack-keep.mjs <hexagon buildings root> <out.glb>");

const PIECES = [
  ["keep", "blue/building_castle_blue.gltf"],
  ["corner_tower", "blue/building_tower_B_blue.gltf"],
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const target = new Document();
target.createBuffer();
const scene = target.createScene("keep");
for (const [id, file] of PIECES) {
  const src = await io.read(join(root, file));
  const kids = src.getRoot().listScenes()[0].listChildren();
  const map = mergeDocuments(target, src);
  const holder = target.createNode(id);
  for (const child of kids) holder.addChild(map.get(child));
  scene.addChild(holder);
  for (const s of src.getRoot().listScenes()) map.get(s)?.dispose();
}
await target.transform(prune(), dedup(), unpartition());
for (const node of scene.listChildren()) {
  const b = getBounds(node);
  const f = (v) => v.map((x) => x.toFixed(2)).join(",");
  console.log(node.getName().padEnd(14), "min", f(b.min), "max", f(b.max));
}
await io.write(out, target);
console.log("wrote", out);
