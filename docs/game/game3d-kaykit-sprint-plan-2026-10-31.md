# 3D courtyard: free CC0 character models (KayKit) — sprint plan, 2026-10-31

**Status (updated 2026-10-31, night): S0 to S6 merged (#207 to #213). S7 (horizon) written on `feature/game3d-horizon` (PR open, not merged, not deployed; [write-up](game3d-horizon-2026-10-31.md)); corner towers and keep as models deliberately left for Faiz's call. S8, S9 plan only. Older status line, kept for the record: S0 to S3 merged (#207 to #209). S4 and S5 written on `feature/game3d-kaykit-s5-and-packs` (PR open, not merged, not deployed): the character files are 0.5 MB each and were seen rendered in a headless browser (the first S4 build broke the scene and was fixed, see [the models doc](game3d-kaykit-models-2026-10-31.md)). S6 to S9 (more free packs) are plan only: nothing of them is written.** Written so a new chat can start from this file alone. Other packs: [assessment](game3d-free-3d-packs-assessment-2026-10-31.md).

**Corrections to the plan below (found 2026-10-31):** GitHub repo names need the `KayKit-` prefix (`KayKit-Medieval-Hexagon-Pack`, `KayKit-Dungeon-Remastered`, `KayKit-Furniture-Bits` all clone; the unprefixed names in the table fail). Forest, Skeletons, Animations and the other "failed" names are itch.io-only, not missing. The Quaternius licence claim is unresolved (see the assessment). **Never quantize or meshopt a skinned character GLB** (S4 trap).

## Why

Faiz saw the code-built figures (shapes with an ink outline) and wants better 3D models. Hard constraint: **a truly free solution** (CC0 or equivalent), no paid or AI-generation tools (the Modly workflow was tried and removed, PR #204 closed; Godot was discussed, no action).

## Finding (checked 2026-10-31)

KayKit packs by Kay Lousberg are **CC0** (`LICENSE.txt` in each repo says so). Public GitHub repos under `KayKit-Game-Assets/` can be cloned from the cloud sandbox:

| Pack | Repo | Use |
|---|---|---|
| Adventurers | `Character-Pack-Adventures-1.0` | hero, Oracle, Partner (rigged, 76 animations each) |
| Medieval Hexagon | `Medieval-Hexagon-Pack` | well, towers, market, walls, fences (optional props) |
| Dungeon Remastered | `Dungeon-Remastered` | torch, banners, column, chest (optional props) |

Not usable: Quaternius newer packs (QAL licence, no redistribution), Mixamo (Adobe ID, not CC0), Poly Pizza/Sketchfab (per-model licence). Sandbox cannot reach kenney.nl, quaternius.com, poly.pizza, opengameart, itch.io. Several other KayKit repo names failed to clone (Character-Animations, Fantasy-Village, Prototype-Bits, Forest-Nature-Pack, Resource-Bits, Skeletons, Medieval-Builder-Pack); do not rely on them.

Characters: `addons/kaykit_character_pack_adventures/Characters/gltf/{Barbarian,Knight,Mage,Rogue,Rogue_Hooded}.glb`. Each: 1 skin, 12-15 mesh nodes, 1 material/texture, ~3.6 MB raw. Stylised chibi, faces included. Measured heights (all nodes visible): Mage 3.0, Knight 2.47, Barbarian 2.40, Rogue_Hooded 2.25, Rogue 2.19.

Animation clips (same set in every file): `Idle`, `Unarmed_Idle`, `Walking_A/B/C`, `Walking_Backwards`, `Running_A/B`, `Running_Strafe_Left/Right`, `Jump_Start/Idle/Land/Full_Short/Full_Long`, `Cheer`, `Interact`, `Use_Item`, `PickUp`, `Spellcasting`, `Spellcast_Raise`, `Hit_A/B`, `Death_A/B`, `Sit_*`, `T-Pose`, plus melee/ranged sets we will not use.

Hideable child nodes (all are separate mesh nodes, so hide by `visible = false`):
- Rogue_Hooded: `Knife_Offhand`, `1H_Crossbow`, `2H_Crossbow`, `Knife`, `Throwable`, `Rogue_Cape` (keep or hide).
- Mage: `Spellbook`, `Spellbook_open`, `1H_Wand`, `2H_Staff`, `Mage_Hat`, `Mage_Cape`.
- Knight: `1H_Sword_Offhand`, `Badge_Shield`, `Rectangle_Shield`, `Round_Shield`, `Spike_Shield`, `1H_Sword`, `2H_Sword`, `Knight_Cape`.

## Decisions (defaults; Faiz may overrule)

- Mapping: **Rogue_Hooded = hero, Mage = Oracle, Knight = Partner.**
- **Faces stay** (as in the model). Faceless was the option; Faiz had not answered, default is faces.
- Hero plays `Idle` standing, `Walking_A` walking, `Running_A` when running; NPCs loop `Idle`; Oracle may use `Spellcasting`/`Interact` while a dialogue is open.
- Weapons hidden by default; Oracle keeps `Spellbook` and `2H_Staff` only if they read well at game distance (look at it, decide).
- Fountain, lamps, quest board and raven perch **stay code-built** (no fountain/lamp/board found in the CC0 packs). Hexagon well and Dungeon torch/banners are optional dressing in S4.
- Code-built `HeroFigure`/`OracleFigure`/`PartnerFigure` stay as the **fallback** if a GLB fails to load.
- No model carries a fact (unchanged rule, **one exception added 2026-10-31: the quest-1 celebration in S8**); towers are still driven only by `stateToWorld()`.

## Budget

- Per character GLB after compression: **1.5 MB or less**. First load of `/game3d`: 15 MB or less. Draw calls: 300 or less. 60 fps target on Faiz's desktop; phones stay unsupported.
- Scene chunk is already ~2.9 MB (1.0 MB gzip); models load as separate files, not in the chunk.

## Sprints

**S0 — Assets and licence (small)**
- Branch off current `main`: `feature/game3d-kaykit-models`.
- Clone the three KayKit repos into a scratch dir outside the repo; copy only the three character GLBs (and any chosen props) to `frontend/public/models/`.
- `frontend/public/models/CREDITS.md`: per asset, name, author (Kay Lousberg / KayKit), source repo URL, licence CC0 1.0, date fetched. Copy the pack `LICENSE.txt` next to it.
- Check `.pre-commit-config.yaml` does not block `.glb` (it blocks `.pdf/.xlsx/.xhtml` outside `docs/`).
- Done when: files present, CREDITS written, sizes measured and recorded in the doc.

**S1 — Loader and hero**
- Reuse the idea from the closed branch `feature/game3d-modly-workflow` (commit `3cbad7f`): `Avatar` + `modelFit` (scale to height, centre, feet on ground, per-slot yaw offset), drei `useGLTF` with meshopt decoder, `SkeletonUtils.clone`, fallback to the shape figure on error/Suspense. Re-create, do not merge that branch.
- Add `useAnimations` (drei) with a small state to clip map (idle / walk / run), cross-fade 0.2 s. Respect reduced motion (hold `Idle`).
- Hero: Rogue_Hooded, hide weapons, keep capsule collider (HALF_HEIGHT 0.5, RADIUS 0.35, feet at group origin) unchanged.
- Retint the hood toward teal `#0CA5B0` if the single palette texture allows it cleanly (otherwise leave as is and say so).
- Done when: tests for modelFit and clip mapping pass; headless render shows the hero standing and walking.

**S2 — Outline for skinned meshes**
- Inverted hull does not follow a skeleton with a plain mesh. Technique: per skinned mesh, a second `SkinnedMesh` sharing the skeleton with a BackSide `MeshBasicMaterial` `#26253B`, and `onBeforeCompile` adding `transformed += normalize(objectNormal) * thickness;` at `#include <begin_vertex>`.
- Fallback if that fights the skinning: drop the outline on characters and rely on flat lighting plus the dark texture edges; say so in the doc.
- Done when: outline visible in a headless screenshot with the walk clip frozen mid-stride.

**S3 — Oracle and Partner**
- Mage and Knight in `NpcMesh` using the same `Avatar` (NPC `art` id and `height: 2.0` stay; scale from height after hiding extras so Mage's hat/staff do not skew it). Face the player when the dialogue panel opens.
- Done when: both stand in the courtyard at their current positions, press-E dialogue and quests unchanged (existing `dialogueV1`, `quest` tests still green).

**S4 — Compression and optional props**
- `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp` (check the animation tracks survive; prune unused clips down to Idle, Walking_A, Running_A, Cheer, Interact, Spellcasting to save size). Record before/after sizes.
- Optional, only if time: Hexagon well and Dungeon torch/banners as extra scenery (instanced, flat-lit), never replacing the fountain/lamps/board and never carrying data.
- Done when: every GLB is at or under 1.5 MB and total load is under budget.

**S5 — Verify, docs, PR**
- Headless Playwright (swiftshader flags in `/tmp/claude-0/shoot.js` pattern; mocked `/game/state` and `/journal`): spawn, walk, near Oracle, near Partner, fallback path (block the GLB request and confirm shape figures appear), console errors.
- CI-equivalent locally: `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` in `frontend/`.
- Docs: write-up `docs/game/game3d-kaykit-models-<date>.md` (identity before/after, tap count, screenshots), README line, PROGRESS, and the mirrored `claude/` copies. Update the game-identity checklist answers.
- Open the PR from the branch; do not merge. Status wording: "written, not yet deployed".

## Sprints S6 to S9 (added 2026-10-31 after the pack assessment)

Source: [game3d-free-3d-packs-assessment-2026-10-31.md](game3d-free-3d-packs-assessment-2026-10-31.md). Nothing here is built. Each sprint: own branch off `main`, one PR, `tsc`, `lint`, `test`, `build` green, a headless screenshot looked at, doc and PROGRESS in the same PR. Every model here is decoration: **no fact, no data, nothing replaces the fountain, lamps, board, perch or the eight holding towers.** If a file fails to load, the courtyard looks like it does today.

**S6: dress the courtyard (KayKit Dungeon Remastered and Hexagon props, both CC0, both clone from GitHub)**
- Re-clone `KayKit-Dungeon-Remastered` and `KayKit-Medieval-Hexagon-Pack` into a scratch folder; copy their `LICENSE.txt` next to `CREDITS.md` and add one credits row per pack.
- Pick about 12 to 20 pieces: `torch_mounted` either side of the keep door and by the gate, 3 to 5 banners (neutral and teal sets only, so no red or green that could read as a status colour), `barrel`, `crate_*`, `sack`, `tent` and `weaponrack` near the Partner, a `wheelbarrow` by the gate road, `flag_*` neutral on a wall or two.
- Hexagon pieces are `.gltf` + `.bin` + one 16 KB palette PNG; pack each group into one plain `.glb` with a script (`scripts/pack-props.mjs`, same rules as `optimize-models.mjs`: float vertices, no quantize, no meshopt). Individual pieces are 3 to 55 KB, so the whole group should stay under 1 MB.
- New pure data file `scenery.ts` (id, model, x, z, yaw, scale, `solid` radius or 0) plus `scenery.test.ts` copying the `props.test.ts` rules (on the cobbles, clear of pads, keep, people, spawn and the gate road; no two pieces on each other). New `Scenery.tsx` loads with `useGLTF`, clones each piece, flat-lit like the rest, ink outline only if it looks right in a screenshot (static meshes use the plain inverted hull, not the skinned one). A load failure renders nothing.
- Done when: the above tests pass, a headless screenshot from spawn, the keep door and the Partner shows the pieces, `P` stats show 300 or fewer draw calls (software rendering is not a frame-rate measure; Faiz checks 60 fps), first load of `/game3d` is still 15 MB or less (record the number), and the game checklist answers are in the doc: identity score before and after, visual verb and scene line ("light the torches, hang the banners: a gate with a keep, not a plain yard"), tap count unchanged.

**S7: the shell and the horizon (decision gate: Faiz looks at S6 first)**
- Outer ring: Hexagon `tree_*`, `rock_*`, `hills_*`, `mountain_*` (and, if Faiz downloads it, the KayKit Forest Nature free tier) beyond the walls, instanced, replacing or sitting in front of the painted backdrop (`Backdrop.tsx`, a Stitch picture today). Keep the painted backdrop as the fallback and decide with a screenshot whether the models replace it or add depth in front of it.
- Corner towers and the keep (`Courtyard.tsx`, `CORNER_TOWER_*`, `KEEP`) may become `building_tower_*` / `building_castle_*` **only if** the collider still matches the visible shape and Faiz agrees after seeing one test shot. These hold no data. The eight **holding towers stay code-built** (they show crenels, cracks, ivy, water and flags from real data).
- Risk: this is the sprint that can break the budget (trees and hills add triangles and draw calls). Instance every repeated piece, measure after each addition, drop pieces before raising the budget.
- Done when: budget numbers recorded, screenshots from spawn and from the far wall, the gate road and every pad still reachable (existing `layout`/`movement` tests green).

**S8: townsfolk and small life (small)**
- Two more people from the Adventurers pack already in the source repo (`Barbarian`, `Rogue`): idle loops at fixed spots (a guard at the gate, one by the board), no dialogue, no name tag that suggests a role in the data. Needs two entries in `models3d.ts` (ids beyond `hero | oracle | partner`, so `ModelId` and the registry test change), the same compression step, and a 0.5 MB budget each.
- The Oracle plays `Spellcasting` (or `Interact`) while his dialogue is open; the clips are already in the file. Reduced motion holds `Idle`.
- Teal retint of the hero's hood if the palette texture allows it cleanly (open since S1); otherwise say so in the doc and stop.
- **Quest-done celebration (Faiz said yes on 2026-10-31: a cheer, and maybe confetti).** This is the one place a model shows a fact, so the rule "no model carries a fact" gets this single exception, with these guards:
  - Trigger: quest 1 (Unwritten Thesis) status is exactly `done`, worked out from the journal as today (nothing stored). Never on `loading`, `unreadable`, `empty`, and **not on the sample/demo journal** ("Sample journal, not yours"), so it cannot cheer for data that is not Faiz's.
  - What happens: the hero and both people play `Cheer` for about 3 seconds, and a short confetti burst goes up over the fountain, then everything returns to `Idle`. Once per page load, not looping, not on every re-render.
  - Confetti: one instanced particle burst (about 150 small flat quads, a few colours, gravity, gone after 3 s), no textures, no per-frame allocation. Reduced motion: no confetti and no cheer, just the quest log line "Done!" as today.
  - Test: the trigger is a pure function of the quest state and the demo flag (unit-tested for every status), so a wrong state cannot celebrate.
  - Not decided (default: no): a smaller cheer when quest 2 (Six-Month Reckoning) reads "clear". Nothing waiting is not an achievement, so it stays quiet unless Faiz asks.

**S9: bring-your-own packs (only if S6 to S8 leave a gap; needs Faiz to download)**
- For anything hosted only on kenney.nl, quaternius.com or itch.io (Quaternius Medieval Village MegaKit, KayKit Forest free tier, Skeletons): Faiz downloads the zip and puts it in a folder; a script `scripts/import-pack.mjs` reads it, **stops if there is no licence file or it is not CC0**, converts to plain GLB (same rules), writes a `CREDITS.md` row and copies the licence text. Nothing is committed without that file.
- Quaternius licence check is mandatory first (the assessment records the conflict). Kenney is unverified.
- Done when: one pack imported end to end and used for one visible change, or a written decision that none is needed.

## Risks and open questions

- **Size and load time** on Railway: 3.6 MB raw each. S4 decides if the budget holds.
- **Outline on skinned meshes** may not look right (S2 has a fallback).
- **Look of faces vs the rest of the Stitch style:** judge from a screenshot, Faiz decides.
- **One shared palette texture** limits recolouring; expect at most a small tint.
- **Animation names** are from the Adventurers pack only; confirm in the file at load (log missing clip names, fall back to `Idle`).

## Starting a new chat

1. `git status`, `git log --oneline -15`; fetch `origin/main` (week 1-4 and the solid models are merged as #198-#203; PR #205 is a docs-only correction that may still be open).
2. Read this file, `docs/game/game3d-billboards-2026-10-30.md`, and `frontend/src/game3d/{Figures,Inked,NpcMesh,Player,PropMesh}.tsx`.
3. Re-clone the KayKit repos (sandbox paths from the last session under `/tmp/claude-0/assets/` may be gone).
4. Run S0 to S5 in order, one commit per sprint, tests before each commit.
