// Shrinks the KayKit character GLBs (S4 of the 3D courtyard): keeps only the clips the game can play,
// then meshopt-compresses. Original files are the untouched CC0 downloads (see frontend/public/models/CREDITS.md).
//
// Usage (deps are NOT in the repo; install them in a scratch folder):
//   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//   node optimize-models.mjs <dir with the original .glb files> <output dir>
// The app decodes meshopt through drei's useGLTF (meshopt decoder is on by default).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, meshopt, resample } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const [inDir = ".", outDir = "out"] = process.argv.slice(2);
const KEEP = ["Idle", "Walking_A", "Running_A", "Cheer", "Interact", "Spellcasting"];
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

for (const name of ["Rogue_Hooded", "Mage", "Knight"]) {
  const doc = await io.read(`${inDir}/${name}.glb`);
  for (const anim of doc.getRoot().listAnimations()) {
    if (KEEP.includes(anim.getName())) continue;
    // Dispose channels and samplers too, or their accessors stay in the file (JSON bloat).
    anim.listChannels().forEach((c) => c.dispose());
    anim.listSamplers().forEach((s) => s.dispose());
    anim.dispose();
  }
  await doc.transform(resample(), prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(`${outDir}/${name}.glb`, doc);
}
