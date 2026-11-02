// Exports clips-work.glb (2026-11-02): an animations-only file with six "work" clips for the people of the holding lands
// (swing a pick, hammer blow, scythe or saw sweep, lift, toss, rest on the floor).
// Usage: node export-work-clips.mjs <original Skeleton_Warrior.glb> <out clips-work.glb>
// Why Skeletons and not Character Animations: the free KayKit Character Animations 1.2 download holds ONE old six-bone
// character (Body, Head, armLeft ...) with 30 clips, not the 41-bone Rig_Medium clips, so nothing retargets by joint name
// (see docs/game/game3d-new-packs-2026-11-02.md). The Skeletons use the very same 41-bone rig as our Adventurers (names
// and rest pose checked against Knight.glb), so their clips play on Knight, Barbarian, Rogue, Mage unchanged.
// The file keeps the bone nodes (no mesh, no skin) so the clip tracks name real nodes; the game binds the clips to the
// character with an AnimationMixer, matching by bone name. Plain float data: no quantize, no meshopt.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, resample } from "@gltf-transform/functions";

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error("usage: node export-work-clips.mjs <Skeleton_Warrior.glb> <out.glb>");
const KEEP = ["2H_Melee_Attack_Chop", "1H_Melee_Attack_Chop", "2H_Melee_Attack_Slice", "PickUp", "Throw", "Sit_Floor_Idle"];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
for (const a of root.listAnimations()) {
  if (!KEEP.includes(a.getName())) {
    a.listChannels().forEach((c) => c.dispose());
    a.listSamplers().forEach((x) => x.dispose());
    a.dispose();
  }
}
for (const n of root.listNodes()) {
  if (n.getMesh()) n.setMesh(null);
  if (n.getSkin()) n.setSkin(null);
}
for (const s of root.listSkins()) s.dispose();
await doc.transform(resample(), prune({ keepLeaves: true }), dedup());
for (const m of root.listMeshes()) m.dispose();
await doc.transform(prune({ keepLeaves: true }));
await io.write(out, doc);
console.log("wrote", out, root.listAnimations().map((a) => a.getName()).join(","));
