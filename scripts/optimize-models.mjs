// Shrinks the KayKit character GLBs for the 3D courtyard (S4). Run from a folder that holds the
// ORIGINAL Rogue_Hooded.glb, Mage.glb and Knight.glb (KayKit-Character-Pack-Adventures-1.0, CC0),
// with `npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions` installed:
//   node optimize-models.mjs [Name ...]   -> writes out/*.glb (default: Rogue_Hooded Mage Knight; S8 added Barbarian Rogue)
//
// What it does: drops every animation clip the game cannot play, resamples what is left and prunes
// the unused data. The size was the 76 clips per file (about 3.5 MB), not the picture.
//
// What it must NOT do: quantize or meshopt-compress the skinned meshes. gltf-transform's quantize
// moves the vertex scale into the skin, but the courtyard's fit and outline code reads the raw
// geometry bounds, so the hero fitted wrongly and the scene broke (found in S5, rendered, 2026-10-31).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, resample } from "@gltf-transform/functions";
// Played today: Idle, Walking_A, Running_A, Cheer, Spellcasting. Kept for the townsfolk (S20): Interact, Sit_Chair_Idle
// (a seated scribe) and Use_Item (a vault keeper, a merchant). Measured: each extra clip adds about 28 KB to a file;
// Sit_Floor_Idle and PickUp were tried and left out. Everything else in the 76 stays out.
const KEEP = ["Idle", "Walking_A", "Running_A", "Cheer", "Interact", "Spellcasting", "Sit_Chair_Idle", "Use_Item"];
// S26 (2026-11-02): `--keep=Idle,Walking_A,...` replaces the clip list for this run (the four KayKit Skeletons keep their
// own set), `--out=dir` changes the output folder (default out). Plain names are file names without .glb.
const keepArg = process.argv.find((a) => a.startsWith("--keep="));
const outArg = process.argv.find((a) => a.startsWith("--out="));
const KEEP_NOW = keepArg ? keepArg.slice(7).split(",") : KEEP;
const OUT = outArg ? outArg.slice(6) : "out";
const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of names.length ? names : ["Rogue_Hooded", "Mage", "Knight"]) {
  const doc = await io.read(`${f}.glb`);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (!KEEP_NOW.includes(a.getName())) {
      a.listChannels().forEach((c) => c.dispose());
      a.listSamplers().forEach((x) => x.dispose());
      a.dispose();
    }
  }
  const left = root.listAnimations().map((a) => a.getName());
  await doc.transform(resample(), prune(), dedup());
  await io.write(`${OUT}/${f}.glb`, doc);
  console.log(f, left.join(","));
}
