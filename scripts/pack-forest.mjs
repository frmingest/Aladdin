// Packs the chosen KayKit Forest Nature pieces (CC0) into ONE plain .glb: the meadow plants of the 3D courtyard (asset sprint A4).
// Same method as pack-horizon.mjs, only the piece list and the source pack differ.
// Usage (from a scratch folder that has @gltf-transform/{core,extensions,functions} installed, like optimize-models.mjs):
//   node pack-forest.mjs <Forest Nature Assets/gltf dir> <out.glb>
// Each piece becomes a top-level node named after its id (lower case), so the app can clone it by name.
// Plain float vertices on purpose: no quantize, no meshopt (the S4 lesson), and no animation here.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { join } from "node:path";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: node pack-forest.mjs <forest gltf dir> <out.glb>");

// id (as used in meadowPlants.ts) -> source file. Nature only: leaf green is scenery (colour audit --allow), nothing carries a fact.
const NAMES = [
  "tree_1_a", "tree_1_b", "tree_2_a", "tree_2_b", "tree_3_a", "tree_4_a",
  "bush_1_a", "bush_2_a", "bush_3_a", "bush_4_a",
  "grass_1_a", "grass_2_a",
  "rock_1_a", "rock_2_a", "rock_3_a",
];
const file = (id) => id.replace(/^(\w+?)_(\d)_(\w)$/, (_, k, n, v) => `${k[0].toUpperCase()}${k.slice(1)}_${n}_${v.toUpperCase()}_Color1.gltf`);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const { Document } = await import("@gltf-transform/core");
const target = new Document();
target.createBuffer();
const scene = target.createScene("forest");

for (const id of NAMES) {
  const src = await io.read(join(dir, file(id)));
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
  console.log(node.getName().padEnd(12), "min", f(b.min), "max", f(b.max));
}
await io.write(out, target);
console.log("wrote", out);
