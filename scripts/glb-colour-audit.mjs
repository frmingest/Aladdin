// Colour audit for packed GLBs (2026-11-02): which pieces read red or green?
// Usage (needs @gltf-transform/{core,extensions} and pngjs, like the pack scripts): node glb-colour-audit.mjs <file.glb> [more.glb]
// For each top-level node it samples the texture (or the material colour) under every triangle, weighted by
// triangle area, and prints the share that reads red (hue >= 340 or <= 10) or green (hue 75..165). Both need
// saturation >= 0.3 and value >= 0.25. Exit 1 if any piece that is not on the allow list is over 8 percent.
// Leaf and grass green on nature pieces and trees is scenery, not a status colour: pass --allow=name1,name2.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const allow = new Set((args.find((a) => a.startsWith("--allow=")) ?? "").slice(8).split(",").filter(Boolean));
const files = args.filter((a) => !a.startsWith("--"));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
};
const lin2srgb = (c) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
const kind = (r, g, b) => {
  const [h, s, v] = hsv(r, g, b);
  if (s < 0.3 || v < 0.25) return 0;
  if (h >= 340 || h <= 10) return 1;
  if (h >= 75 && h <= 165) return 2;
  return 0;
};
let bad = 0;
for (const file of files) {
  const doc = await io.read(file);
  const pngs = new Map();
  const png = (tex) => {
    if (!pngs.has(tex)) pngs.set(tex, PNG.sync.read(Buffer.from(tex.getImage())));
    return pngs.get(tex);
  };
  console.log(`\n${file}`);
  for (const top of doc.getRoot().listScenes()[0].listChildren()) {
    let area = 0, red = 0, green = 0;
    top.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION"), uv = prim.getAttribute("TEXCOORD_0");
        const mat = prim.getMaterial();
        const tex = mat?.getBaseColorTexture();
        const idx = prim.getIndices();
        const n = idx ? idx.getCount() : pos.getCount();
        const at = (i) => (idx ? idx.getScalar(i) : i);
        const p = [0, 0, 0].map(() => [0, 0, 0]);
        for (let t = 0; t + 2 < n; t += 3) {
          const ids = [at(t), at(t + 1), at(t + 2)];
          ids.forEach((id, k) => pos.getElement(id, p[k]));
          const a = p[0], b = p[1], c = p[2];
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
          const ar = Math.hypot(...cr) / 2;
          let rgb;
          if (tex && uv) {
            const im = png(tex);
            let su = 0, sv = 0;
            for (const id of ids) { const q = uv.getElement(id, [0, 0]); su += q[0] / 3; sv += q[1] / 3; }
            su = ((su % 1) + 1) % 1; sv = ((sv % 1) + 1) % 1;
            const x = Math.min(im.width - 1, Math.floor(su * im.width)), y = Math.min(im.height - 1, Math.floor(sv * im.height));
            const o = (y * im.width + x) * 4;
            rgb = [im.data[o], im.data[o + 1], im.data[o + 2]];
          } else {
            const f = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
            rgb = [lin2srgb(f[0]), lin2srgb(f[1]), lin2srgb(f[2])];
          }
          area += ar;
          const k = kind(...rgb);
          if (k === 1) red += ar; else if (k === 2) green += ar;
        }
      }
    });
    const r = area ? red / area : 0, g = area ? green / area : 0;
    const flag = r > 0.08 || g > 0.08;
    const ok = allow.has(top.getName());
    if (flag && !ok) bad++;
    console.log(`  ${top.getName().padEnd(28)} red ${(r * 100).toFixed(0).padStart(3)}%  green ${(g * 100).toFixed(0).padStart(3)}%${flag ? (ok ? "  (allowed)" : "  <-- CHECK") : ""}`);
  }
}
process.exit(bad ? 1 : 0);
