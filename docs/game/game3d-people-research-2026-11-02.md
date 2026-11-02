# 3D courtyard S20: more people, free CC0 character options (research, 2026-11-02)

Status: **research plus one small code change (extra clips in the five character files). Nothing downloaded beyond the KayKit Adventurers pack we already use, nothing placed in the world, not seen in a browser, not merged, not deployed.** Plan: [KayKit sprint plan](game3d-kaykit-sprint-plan-2026-10-31.md) (S20).

## The gap

All five KayKit Adventurers are in use: hero (Rogue_Hooded), Oracle (Mage), Partner (Knight), guard (Barbarian), scout (Rogue). Market stalls, the scribe, the raven keeper and the vault keeper still need bodies. Merchants carry no fact.

## Options found

Licence statements below come from the pack pages or from a third-party catalogue (Cinevva). **Open each zip's licence text before importing**; `scripts/import-pack.mjs` is the gate.

| Option | What | Verdict |
|---|---|---|
| Re-cut the Adventurers with more clips (this PR) | The originals hold 76 clips; S4 kept six. Now eight: adds `Sit_Chair_Idle` and `Use_Item`. | **Done first.** Same look, same rig, no download. A seated scribe and a working vault keeper need a pose and a prop swap. |
| [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations) | 133 free CC0 humanoid animations for KayKit Rig_Medium and Rig_Large. | Only if the original 76 lack something. Not checked that the Adventurers use Rig_Medium. |
| [KayKit Skeletons](https://kaylousberg.itch.io/kaykit-skeletons) | 4 free skeletons (+ Golem and Necromancer at $7.95 or more), CC0, rigged. | Enemies, not townsfolk. Optional "unknown"/storm figures, Faiz's call. |
| Kenney Mini Characters (Male and Female A to F) | 12 characters, about 1,200 to 1,600 vertices, 32 clips each, listed CC0. Female A needs `Textures/colormap.png`. | **Best candidate for new bodies**: same author and palette family as the town kit, light. Clothing unseen; needs a lineup picture first. |
| [Kenney Animated Characters 3](https://kenney-assets.itch.io/animated-characters-3) | One model, four skins, 3 animations, CC0. | Too thin. |
| Kenney Blocky Characters | Node-based rig, 143 vertices. | Skip. |
| [Quaternius Universal Base Characters](https://quaternius.itch.io/universal-base-characters) + [Modular Outfits Fantasy](https://quaternius.itch.io/modular-character-outfits-fantasy) | Six bases (male and female), about 13k triangles each, 20 hairstyles, 12 outfits, CC0, 122 MB and 263 MB zips, no animations bundled. | **Park** (same reason as the MegaKit): the ink outline doubles skinned meshes, so a dozen of them would eat the 300 draw-call budget; realistic proportions may clash. |
| Quaternius Ultimate Animated Characters, LowPoly Animated Knight | Knights only, about 6 to 9k vertices, 17 clips. | Low priority. |

No CC0 medieval villager, merchant or scribe pack in the KayKit style was found.

## What this PR changed

- `scripts/optimize-models.mjs` keeps eight clips: `Idle`, `Walking_A`, `Running_A`, `Cheer`, `Interact`, `Spellcasting`, `Sit_Chair_Idle`, `Use_Item`. `Sit_Floor_Idle` and `PickUp` were tried and left out (each clip costs about 28 KB per file).
- The five files were rebuilt from the original pack (`KayKit-Character-Pack-Adventures-1.0`, commit `672074b`) with that script, still no quantize and no meshopt. Sizes, bytes, before to after: Rogue_Hooded 503,820 to 559,292; Mage 503,104 to 558,572; Knight 560,028 to 615,512; Barbarian 515,060 to 570,532; Rogue 522,244 to 577,716. Total up by about 0.28 MB; every file stays under the 1.5 MB budget.
- `animClips.ts` names the two clips (`CLIP.sit`, `CLIP.useItem`); nothing plays them yet. `modelFiles.test.ts` fails if a character file loses either.

## Next (a decision for Faiz)

1. Use the free path: seat a scribe at the writing desk and give the vault keeper and merchants a prop swap, played from the new clips.
2. If you want more distinct faces, download Kenney Mini Characters, run it through the importer, and look at a lineup beside the Adventurers.
3. Skeletons: yes or no.
