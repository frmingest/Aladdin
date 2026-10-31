import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, quantize, meshopt, resample } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const KEEP = ["Idle","Walking_A","Running_A","Cheer","Interact","Spellcasting"];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({"meshopt.encoder":MeshoptEncoder,"meshopt.decoder":MeshoptDecoder});
for (const f of ["Rogue_Hooded","Mage","Knight"]) {
  const doc = await io.read(`${f}.glb`);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) { a.listChannels().forEach(c=>c.dispose()); a.listSamplers().forEach(x=>x.dispose()); a.dispose(); }
  const left = root.listAnimations().map(a=>a.getName());
  await doc.transform(resample(), prune(), dedup(), meshopt({encoder: MeshoptEncoder, level:"medium"}));
  await io.write(`out/${f}.glb`, doc);
  console.log(f, left.join(","));
}
