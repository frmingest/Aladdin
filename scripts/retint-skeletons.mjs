// Retints the KayKit Skeletons' picture (2026-11-02): red cells (the Mage robe, the Rogue cape and hood) become slate
// blue, so no figure reads as a status colour. Run after optimize-models.mjs, on its output, in place:
//   node retint-skeletons.mjs out/Skeleton_Mage.glb out/Skeleton_Rogue.glb ...
// Only pixels change; geometry, skin and clips are untouched (plain float vertices stay plain).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup } from "@gltf-transform/functions";
import { PNG } from "pngjs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx ? d / mx : 0, mx];
}
function rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((n) => Math.round(n * 255));
}
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  let changed = 0;
  for (const t of doc.getRoot().listTextures()) {
    const png = PNG.sync.read(Buffer.from(t.getImage()));
    for (let i = 0; i < png.data.length; i += 4) {
      const [h, s, v] = hsv(png.data[i], png.data[i + 1], png.data[i + 2]);
      if (s >= 0.35 && (h >= 335 || h <= 12)) {
        const [r, g, b] = rgb(215, s * 0.85, v);
        png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b;
        changed++;
      } else if (s >= 0.3 && h >= 75 && h <= 175) {
        const [r, g, b] = rgb(188, s, v); // green cells -> teal (eyes, slime)
        png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b;
        changed++;
      }
    }
    t.setImage(PNG.sync.write(png));
  }
  await doc.transform(dedup());
  await io.write(file, doc);
  console.log(file, changed, "pixels retinted");
}
