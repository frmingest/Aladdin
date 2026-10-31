# 3D courtyard: free CC0 character models (KayKit) — sprint plan, 2026-10-31

**Status: plan only. Nothing below is written, committed or deployed.** Written so a new chat can start from this file alone.

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
- No model carries a fact (unchanged rule); towers are still driven only by `stateToWorld()`.

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
