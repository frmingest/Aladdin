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
const KEEP = ["Idle", "Walking_A", "Running_A", "Cheer", "Interact", "Spellcasting"];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2).length ? process.argv.slice(2) : ["Rogue_Hooded", "Mage", "Knight"]) {
  const doc = await io.read(`${f}.glb`);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (!KEEP.includes(a.getName())) {
      a.listChannels().forEach((c) => c.dispose());
      a.listSamplers().forEach((x) => x.dispose());
      a.dispose();
    }
  }
  const left = root.listAnimations().map((a) => a.getName());
  await doc.transform(resample(), prune(), dedup());
  await io.write(`out/${f}.glb`, doc);
  console.log(f, left.join(","));
}
