// Shrinks six Kenney Particle Pack sprites (CC0) into frontend/public/fx/ (2026-11-02): box-filtered down to 128 px,
// kept white-on-transparent so the game tints them in code (THREE.SpriteMaterial color). Nothing is preloaded.
// Usage (needs pngjs, like the pack scripts): node pack-fx.mjs "<Particle Pack>/PNG (Transparent)" <out dir>
import { PNG } from "pngjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error('usage: node pack-fx.mjs "<PNG (Transparent) dir>" <out dir>');
mkdirSync(out, { recursive: true });
const SIZE = 128;
const PICK = { smoke_soft: "smoke_01", smoke_puff: "smoke_07", spark: "spark_01", dust: "dirt_01", flare: "flare_01", dot: "circle_05" };
for (const [id, file] of Object.entries(PICK)) {
  const src = PNG.sync.read(readFileSync(join(dir, `${file}.png`)));
  const k = src.width / SIZE;
  const dst = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const o = ((Math.floor(y * k) + j) * src.width + Math.floor(x * k) + i) * 4;
      const al = src.data[o + 3];
      r += src.data[o] * al; g += src.data[o + 1] * al; b += src.data[o + 2] * al; a += al; n++;
    }
    const o = (y * SIZE + x) * 4;
    dst.data[o] = a ? Math.round(r / a) : 255; dst.data[o + 1] = a ? Math.round(g / a) : 255; dst.data[o + 2] = a ? Math.round(b / a) : 255;
    dst.data[o + 3] = Math.round(a / n);
  }
  writeFileSync(join(out, `${id}.png`), PNG.sync.write(dst, { colorType: 6 }));
  console.log(id, `${src.width}px ->`, SIZE);
}
