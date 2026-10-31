// Packs the chosen KayKit Medieval Hexagon nature pieces (CC0) into ONE plain .glb: the horizon shell of the 3D courtyard (S7).
// Same method as pack-props.mjs (S6), only the piece list and the single source pack differ.
// Usage (from a scratch folder that has @gltf-transform/{core,extensions,functions} installed, like optimize-models.mjs):
//   node pack-horizon.mjs <KayKit-Medieval-Hexagon-Pack gltf root> <out.glb>
// Each piece becomes a top-level node named after its id, so the app can clone it by name.
// Plain float vertices on purpose: no quantize, no meshopt (the S4 lesson), and no animation here.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [hexRoot, out] = process.argv.slice(2);
if (!hexRoot || !out) throw new Error("usage: node pack-horizon.mjs <hexagon gltf root> <out.glb>");

// id (as used in horizonPieces.ts) -> file. Nature only: nothing here can read as a status colour or carry a fact.
const NAMES = [
  "tree_single_A", "tree_single_B", "trees_A_small", "trees_A_medium", "trees_B_large",
  "rock_single_C", "rock_single_E",
  "hills_A", "hills_B", "hills_C", "hills_A_trees", "hills_C_trees",
  "mountain_A", "mountain_B", "mountain_C", "mountain_A_grass_trees", "mountain_B_grass",
];
const PIECES = NAMES.map((n) => [n, "hex", n + ".gltf"]);

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
const { Document } = await import("@gltf-transform/core");
const target = new Document();
target.createBuffer();
const scene = target.createScene("horizon");

for (const [id, pack, file] of PIECES) {
  const path = findFile(hexRoot, file);
  if (!path) throw new Error(`missing ${file}`);
  const src = await io.read(path);
  const srcScene = src.getRoot().listScenes()[0];
  const kids = srcScene.listChildren();
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
  console.log(node.getName().padEnd(22), "min", f(b.min), "max", f(b.max));
}
await io.write(out, target);
console.log("wrote", out);
