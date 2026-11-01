// Packs the KayKit marketplace pieces (CC0) into ONE plain .glb for the 3D courtyard (marketplace corner).
// Usage (from a scratch folder with @gltf-transform/{core,extensions,functions} installed, like pack-props.mjs):
//   node pack-market.mjs <KayKit-Dungeon-Remastered gltf dir> <KayKit-Medieval-Hexagon-Pack gltf root> <out.glb>
// Each piece becomes a top-level node named after its id. Blue/neutral only: the red and green market and
// well variants could read as a status colour. Plain float vertices: no quantize, no meshopt, no animation.
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [dungeonDir, hexRoot, out] = process.argv.slice(2);
if (!dungeonDir || !hexRoot || !out) throw new Error("usage: node pack-market.mjs <dungeon gltf dir> <hexagon gltf root> <out.glb>");

const PIECES = [
  ["market_stalls", "hex", "building_market_blue.gltf"],
  ["well", "hex", "building_well_blue.gltf"],
  ["tent_market", "hex", "tent.gltf"],
  ["crate_long_A", "hex", "crate_long_A.gltf"],
  ["stall_table_long", "dungeon", "table_long_tablecloth_decorated_A.gltf.glb"],
  ["stall_table_medium", "dungeon", "table_medium_tablecloth_decorated_B.gltf.glb"],
  ["stall_table_plain", "dungeon", "table_long_tablecloth.gltf.glb"],
  ["crates_stacked", "dungeon", "crates_stacked.gltf.glb"],
  ["keg_decorated", "dungeon", "keg_decorated.gltf.glb"],
  ["barrel_stack", "dungeon", "barrel_small_stack.gltf.glb"],
  ["stool", "dungeon", "stool.gltf.glb"],
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
const scene = target.createScene("market");

for (const [id, pack, file] of PIECES) {
  const path = findFile(pack === "dungeon" ? dungeonDir : hexRoot, file);
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
