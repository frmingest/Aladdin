// Packs the Siege Field pieces (S27-S31, 2026-11-02) from Kenney Castle Kit 2.0 (CC0) into ONE plain siege.glb:
// the five siege engines (intact and demolished), wall, tower and gate pieces, flags and a few rocks.
// Usage (from a folder with @gltf-transform/{core,extensions,functions} and pngjs installed, like pack-town.mjs):
//   node pack-siege.mjs <Castle Kit "GLB format" dir> <out dir>
// Writes <out>/siege.glb. Same colour rule as pack-town.mjs: Kenney's single 512 palette is retinted once (red cells
// become slate blue, green cells teal, the orange-red cells become sand), then every piece shares that one image.
// Flags and banners come out blue, white or yellow only. Node names never say red or green.
// Plain float vertices: no quantize, no meshopt, no animation.
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import { PNG } from "pngjs";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const [dir, outDir] = process.argv.slice(2);
if (!dir || !outDir) throw new Error("usage: node pack-siege.mjs <Castle Kit GLB dir> <out dir>");
mkdirSync(outDir, { recursive: true });

// node id <- source file (without .glb)
const PIECES = {
  siege_catapult: "siege-catapult", siege_catapult_wrecked: "siege-catapult-demolished",
  siege_trebuchet: "siege-trebuchet", siege_trebuchet_wrecked: "siege-trebuchet-demolished",
  siege_ballista: "siege-ballista", siege_ballista_wrecked: "siege-ballista-demolished",
  siege_ram: "siege-ram", siege_ram_wrecked: "siege-ram-demolished",
  siege_tower: "siege-tower", siege_tower_wrecked: "siege-tower-demolished",
  wall: "wall", wall_half: "wall-half", wall_corner: "wall-corner", wall_doorway: "wall-doorway",
  wall_pillar: "wall-pillar", wall_narrow: "wall-narrow", wall_narrow_stairs: "wall-narrow-stairs",
  gate: "gate", metal_gate: "metal-gate", stairs_stone: "stairs-stone",
  tower_square: "tower-square", tower_hexagon_base: "tower-hexagon-base", tower_hexagon_mid: "tower-hexagon-mid",
  tower_hexagon_top: "tower-hexagon-top", tower_hexagon_roof: "tower-hexagon-roof",
  flag: "flag", flag_pennant: "flag-pennant", flag_banner_long: "flag-banner-long", flag_wide: "flag-wide",
  rocks_small: "rocks-small", rocks_large: "rocks-large",
};

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
const BLUE = 215, TEAL = 188;
function retint(r, g, b) {
  const [h, s, v] = rgb2hsv(r, g, b);
  if (s >= 0.4 && (h >= 340 || h <= 12)) return hsv2rgb(BLUE, s * 0.85, v); // red cells -> slate blue
  if (s >= 0.3 && h >= 75 && h <= 175) return hsv2rgb(TEAL, s, v); // green and mint cells -> teal
  return [r, g, b];
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const first = await io.read(join(dir, "siege-catapult.glb"));
const png = PNG.sync.read(Buffer.from(first.getRoot().listTextures()[0].getImage()));
let changed = 0;
for (let i = 0; i < png.data.length; i += 4) {
  const [r, g, b] = retint(png.data[i], png.data[i + 1], png.data[i + 2]);
  if (r !== png.data[i] || g !== png.data[i + 1] || b !== png.data[i + 2]) changed++;
  png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b;
}
const palette = PNG.sync.write(png);
console.log(`palette: ${changed} of ${png.width * png.height} pixels retinted`);

const target = new Document();
target.createBuffer();
const scene = target.createScene("siege");
for (const [id, file] of Object.entries(PIECES)) {
  const src = await io.read(join(dir, `${file}.glb`));
  const kids = src.getRoot().listScenes()[0].listChildren();
  const map = mergeDocuments(target, src);
  const holder = target.createNode(id);
  for (const child of kids) holder.addChild(map.get(child));
  scene.addChild(holder);
  for (const s of src.getRoot().listScenes()) map.get(s)?.dispose();
  let n = 0;
  holder.traverse((node) => {
    if (node === holder) return;
    node.setName(`${id}_part${n++}`);
    node.getMesh()?.setName(`${id}_mesh${n}`);
  });
}
for (const t of target.getRoot().listTextures()) t.setImage(palette).setMimeType("image/png");
await target.transform(prune(), dedup(), unpartition());
let tris = 0;
for (const m of target.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(`siege: ${scene.listChildren().length} pieces, ${Math.round(tris)} triangles, ${target.getRoot().listTextures().length} texture(s)`);
for (const node of scene.listChildren()) {
  const b = getBounds(node);
  console.log(" ", node.getName().padEnd(26), "size", b.max.map((m, i) => (m - b.min[i]).toFixed(2)).join(","));
}
await io.write(join(outDir, "siege.glb"), target);
