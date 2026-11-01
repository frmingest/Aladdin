// Packs the town pieces (all CC0) into four plain .glb groups for the 3D Town and Market Street (S9, 2026-11-01).
// Usage (from a scratch folder with @gltf-transform/{core,extensions,functions} and pngjs installed, like pack-market.mjs):
//   node pack-town.mjs <Kenney Fantasy Town Kit "GLB format" dir> <KayKit Medieval Builder objects/gltf dir> <out dir>
// Writes <out>/town-market.glb, town-street.glb, town-buildings.glb, town-nature.glb and town-palette.png.
//
// Colour rule (no red, no green that could read as a status colour):
//  - Kenney shares ONE 512x512 palette (colormap.png). It is retinted once here and every Kenney piece gets that
//    one image: red cells (hue ~352) become slate blue, the teal "green" awning/roof cells (hue ~165) become a
//    clearer teal. Timber (hue ~19), stone and the leaf greens of trees and hedges (hue ~152) are left alone:
//    leaves are scenery like the KayKit trees already in the courtyard, not a status colour.
//  - Kenney's pieces named for a colour are renamed (stall-red -> stall_awning_blue ...), so no node name says red or green.
//  - KayKit Builder buildings use plain material colours. The orange roof material "Brown" (the highest geometry of
//    every building) becomes teal. archeryrange (the only piece with a pure "Red" material) is not packed.
// Plain float vertices: no quantize, no meshopt, no animation.
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { PNG } from "pngjs";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

const [kenneyDir, builderDir, outDir] = process.argv.slice(2);
if (!kenneyDir || !builderDir || !outDir) throw new Error("usage: node pack-town.mjs <kenney GLB dir> <builder gltf dir> <out dir>");
mkdirSync(outDir, { recursive: true });

// id (node name in the .glb) <- source file. Ids use underscores and never say red or green.
const GROUPS = {
  "town-market": {
    kenney: {
      stall: "stall", stall_bench: "stall-bench", stall_stool: "stall-stool",
      stall_awning_blue: "stall-red", stall_awning_teal: "stall-green",
      cart: "cart", cart_high: "cart-high",
      banner_blue: "banner-red", banner_teal: "banner-green",
      lantern: "lantern", poles: "poles", poles_horizontal: "poles-horizontal", overhang: "overhang",
    },
  },
  "town-street": {
    kenney: {
      road: "road", road_bend: "road-bend", road_corner: "road-corner", road_corner_inner: "road-corner-inner",
      road_curb: "road-curb", road_curb_end: "road-curb-end", road_edge: "road-edge", road_edge_slope: "road-edge-slope", road_slope: "road-slope",
      fence: "fence", fence_broken: "fence-broken", fence_curved: "fence-curved", fence_gate: "fence-gate",
      pillar_stone: "pillar-stone", pillar_wood: "pillar-wood", stairs_stone: "stairs-stone",
    },
  },
  "town-buildings": {
    builder: ["house", "market", "barracks", "mill", "watermill", "lumbermill", "mine", "watchtower", "castle", "well", "wall_straight", "wall_corner", "wall_gate"],
  },
  "town-nature": {
    kenney: {
      tree: "tree", tree_crooked: "tree-crooked", tree_high: "tree-high", tree_high_crooked: "tree-high-crooked", tree_high_round: "tree-high-round",
      rock_large: "rock-large", rock_small: "rock-small", rock_wide: "rock-wide",
      hedge: "hedge", hedge_curved: "hedge-curved", hedge_gate: "hedge-gate", hedge_large: "hedge-large", hedge_large_curved: "hedge-large-curved", hedge_large_gate: "hedge-large-gate",
      fountain_round: "fountain-round", fountain_round_detail: "fountain-round-detail",
    },
  },
};

// ---- colour helpers -------------------------------------------------------------------------------------------
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((n) => Math.round(n * 255));
}
const BLUE = 215; // slate blue: where the red cells go
const TEAL = 188; // clear teal: where the teal-green cells go
function retint(r, g, b) {
  const [h, s, v] = rgb2hsv(r, g, b);
  if (s >= 0.4 && (h >= 340 || h <= 8)) return hsv2rgb(BLUE, s * 0.85, v);
  if (s >= 0.4 && h >= 160 && h <= 176) return hsv2rgb(TEAL, s, v);
  return [r, g, b];
}
const srgb2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const ROOF_TEAL = [58, 142, 156].map((n) => srgb2lin(n / 255)); // Builder roofs

// ---- palette --------------------------------------------------------------------------------------------------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const original = await io.read(join(kenneyDir, "stall-red.glb"));
const png = PNG.sync.read(Buffer.from(original.getRoot().listTextures()[0].getImage()));
let changed = 0;
for (let i = 0; i < png.data.length; i += 4) {
  const [r, g, b] = retint(png.data[i], png.data[i + 1], png.data[i + 2]);
  if (r !== png.data[i] || g !== png.data[i + 1] || b !== png.data[i + 2]) changed++;
  png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b;
}
const paletteBytes = PNG.sync.write(png);
writeFileSync(join(outDir, "town-palette.png"), paletteBytes);
console.log(`town-palette.png: ${changed} of ${png.width * png.height} pixels retinted`);

// ---- packing --------------------------------------------------------------------------------------------------
async function pack(name, spec) {
  const target = new Document();
  target.createBuffer();
  const scene = target.createScene(name);
  const add = async (id, path, isBuilder) => {
    const src = await io.read(path);
    const kids = src.getRoot().listScenes()[0].listChildren();
    const map = mergeDocuments(target, src);
    const holder = target.createNode(id);
    for (const child of kids) holder.addChild(map.get(child));
    scene.addChild(holder);
    for (const s of src.getRoot().listScenes()) map.get(s)?.dispose();
    // Inner nodes and meshes keep the source file's name (stall-red ...): rename them after the piece, so no
    // name anywhere in the file says red or green.
    let n = 0;
    holder.traverse((node) => {
      if (node === holder) return;
      node.setName(`${id}_part${n++}`);
      node.getMesh()?.setName(`${id}_mesh${n}`);
    });
    if (isBuilder) {
      for (const m of target.getRoot().listMaterials()) if (m.getName() === "Brown") m.setBaseColorFactor([...ROOF_TEAL, 1]).setName("RoofTeal");
    }
  };
  for (const [id, file] of Object.entries(spec.kenney ?? {})) await add(id, join(kenneyDir, `${file}.glb`), false);
  for (const id of spec.builder ?? []) await add(id, join(builderDir, `${id}.gltf.glb`), true);
  // One retinted image for every Kenney texture, then merge the duplicates into one.
  for (const t of target.getRoot().listTextures()) t.setImage(paletteBytes).setMimeType("image/png");
  await target.transform(prune(), dedup(), unpartition());
  let tris = 0;
  for (const m of target.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  const file = join(outDir, `${name}.glb`);
  console.log(`\n${name}: ${scene.listChildren().length} pieces, ${Math.round(tris)} triangles, ${target.getRoot().listTextures().length} texture(s)`);
  for (const node of scene.listChildren()) {
    const b = getBounds(node);
    const f = (v) => v.map((x) => x.toFixed(2)).join(",");
    console.log(" ", node.getName().padEnd(22), "size", f(b.max.map((m, i) => m - b.min[i])), " min", f(b.min));
  }
  await io.write(file, target);
}
for (const [name, spec] of Object.entries(GROUPS)) await pack(name, spec);
console.log("\ndone");
