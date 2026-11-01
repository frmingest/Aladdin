// Packs the KayKit Storm Drill camp pieces (CC0) into ONE plain .glb for the 3D courtyard (drill camp, S10).
// Usage (from a scratch folder with @gltf-transform/{core,extensions,functions} installed, like pack-market.mjs):
//   node pack-camp.mjs <KayKit-Medieval-Hexagon-Pack gltf root> <out.glb>
// Each piece becomes a top-level node named after its id. Blue/yellow/neutral only: no red or green
// variant, which could read as a status colour. Plain float vertices: no quantize, no meshopt, no animation.
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [hexRoot, out] = process.argv.slice(2);
if (!hexRoot || !out) throw new Error("usage: node pack-camp.mjs <hexagon gltf root> <out.glb>");

const PIECES = [
  ["catapult", "building_tower_catapult_blue.gltf"],
  ["catapult_yellow", "building_tower_catapult_yellow.gltf"],
  ["catapult_ball", "projectile_catapult.gltf"],
  ["ladder", "ladder.gltf"],
  ["target", "target.gltf"],
  ["tent", "tent.gltf"],
  ["weaponrack", "weaponrack.gltf"],
  ["flag_blue", "flag_blue.gltf"],
  ["flag_yellow", "flag_yellow.gltf"],
];

function findFile(root, name) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && e.name === name) return join(root, e.name);
    if (e.isDirectory()) {
      const hit = findFile(join(root, e.name), name);
      if (hit) return hit;
    }
  }
  return null;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const target = new Document();
target.createBuffer();
const scene = target.createScene("camp");

for (const [id, file] of PIECES) {
  const path = findFile(hexRoot, file);
  if (!path) throw new Error(`missing ${file}`);
  const src = await io.read(path);
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
  console.log(node.getName().padEnd(20), "min", f(b.min), "max", f(b.max));
}
await io.write(out, target);
console.log("wrote", out);
