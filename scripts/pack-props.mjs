// Packs the chosen KayKit scenery pieces (CC0) into ONE plain .glb for the 3D courtyard (S6).
// Usage (from a scratch folder that has @gltf-transform/{core,extensions,functions} installed, like optimize-models.mjs):
//   node pack-props.mjs <KayKit-Dungeon-Remastered gltf dir> <KayKit-Medieval-Hexagon-Pack gltf root> <out.glb>
// Each piece becomes a top-level node named after its id, so the app can clone it by name.
// Plain float vertices on purpose: no quantize, no meshopt (the S4 lesson), and no animation here.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [dungeonDir, hexRoot, out] = process.argv.slice(2);
if (!dungeonDir || !hexRoot || !out) throw new Error("usage: node pack-props.mjs <dungeon gltf dir> <hexagon gltf root> <out.glb>");

// id (as used in scenery.ts) -> source. Neutral colours only: no red or green that could read as a status.
const PIECES = [
  ["torch_mounted", "dungeon", "torch_mounted.gltf.glb"],
  ["banner_blue", "dungeon", "banner_blue.gltf.glb"],
  ["banner_white", "dungeon", "banner_white.gltf.glb"],
  ["banner_yellow", "dungeon", "banner_yellow.gltf.glb"],
  ["banner_patternA_blue", "dungeon", "banner_patternA_blue.gltf.glb"],
  ["banner_shield_white", "dungeon", "banner_shield_white.gltf.glb"],
  ["barrel", "hex", "barrel.gltf"],
  ["crate_A_big", "hex", "crate_A_big.gltf"],
  ["crate_B_small", "hex", "crate_B_small.gltf"],
  ["sack", "hex", "sack.gltf"],
  ["tent", "hex", "tent.gltf"],
  ["weaponrack", "hex", "weaponrack.gltf"],
  ["wheelbarrow", "hex", "wheelbarrow.gltf"],
  ["bucket_water", "hex", "bucket_water.gltf"],
  ["flag_blue", "hex", "flag_blue.gltf"],
  ["flag_yellow", "hex", "flag_yellow.gltf"],
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
const { Document } = await import("@gltf-transform/core");
const target = new Document();
target.createBuffer();
const scene = target.createScene("scenery");

for (const [id, pack, file] of PIECES) {
  const path = findFile(pack === "dungeon" ? dungeonDir : hexRoot, file);
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
