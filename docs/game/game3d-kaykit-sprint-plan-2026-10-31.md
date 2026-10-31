# 3D courtyard: free CC0 character models (KayKit) — sprint plan, 2026-10-31

**Status (updated 2026-10-31, evening): S0 to S8 merged (#207 to #215): characters, scenery, horizon, townsfolk, casting and the quest-1 cheer; merge checked on `main`, deploy not checked, seen only in a headless browser. Plan only, nothing written: S9 (bring-your-own packs, rewritten with a licence table), and three new sprints from the 2026-10-31 free-pack research: S10 drill camp, S11 writing nook, S12 vault props (parked).** Written so a new chat can start from this file alone. Other packs: [assessment](game3d-free-3d-packs-assessment-2026-10-31.md).

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

## Sprints S6 to S8 (added 2026-10-31 after the pack assessment; merged)

Source: [game3d-free-3d-packs-assessment-2026-10-31.md](game3d-free-3d-packs-assessment-2026-10-31.md). All three are built and merged (write-ups: [scenery](game3d-scenery-2026-10-31.md), [horizon](game3d-horizon-2026-10-31.md), [townsfolk](game3d-townsfolk-2026-10-31.md)). Each sprint: own branch off `main`, one PR, `tsc`, `lint`, `test`, `build` green, a headless screenshot looked at, doc and PROGRESS in the same PR. Every model here is decoration: **no fact, no data, nothing replaces the fountain, lamps, board, perch or the eight holding towers.** If a file fails to load, the courtyard looks like it does today.

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

## Sprints S9 to S12 (rewritten and extended 2026-10-31, evening)

Source: a second free-pack search on 2026-10-31 (pack pages read, plus the three KayKit repos listed file by file; the piece names below exist). Same rules as S6 to S8: own branch off `main`, one PR, `tsc`, `lint`, `test`, `build` green, a headless screenshot looked at, doc and PROGRESS in the same PR, status written as three facts (merged, deployed, seen on real data). **Hard rule unchanged: CC0 or equivalent, no AI generation, no per-model licence hunting. Models are decoration: anything that shows a fact stays code-built, like the eight holding towers.** If a file fails to load, the courtyard looks like it does today. No red or green pieces (the red and green banner, flag and castle variants exist in the packs and are not used).

**S9: bring-your-own packs (only if S10 to S12 leave a gap; needs Faiz to download)**
- For anything hosted only on kenney.nl, quaternius.com or itch.io: Faiz downloads the zip and puts it in a folder; a script `scripts/import-pack.mjs` reads it, **stops if there is no licence file or it is not CC0**, converts to plain GLB (same rules: float vertices, no quantize, no meshopt on skinned files), writes a `CREDITS.md` row and copies the licence text. Nothing is committed without that file. The sandbox cannot reach those hosts, so this step is always done on Faiz's machine.
- Vetted on 2026-10-31 from each pack's own page (the licence file inside the zip must still be opened before anything is committed):

| Pack | Page says | Use | Verdict |
|---|---|---|---|
| Kenney Castle Kit (70+ models, walls, gates, siege weapons, OBJ/FBX/glTF, 2.1 MB) | CC0 | siege pieces and castle extras for S10 | **Candidate.** Flat colours match KayKit best. |
| Quaternius Medieval Weapons (22) and the 2017 Low Poly RPG Pack (100+ items) | CC0 | weapons, items for S12 | Candidate. |
| LowPolyAssets Medieval Weapons (60+ meshes, includes siege engines, FBX) | CC0 | siege engines | Candidate; check the style against KayKit first. |
| De Alpe Low Poly Siege Engine Pack (catapult, siege tower, two rams, two ladders; FBX and GLB) | no licence line seen | the siege tower and rams KayKit lacks | **Blocked** until a licence file is found. |
| Imzaiko Basic Library (books, table, library furniture) | no licence line seen | library | **Blocked.** Use KayKit Furniture Bits instead (S11). |
| Quaternius MegaKits (Medieval Village, Fantasy Props), Universal Base Characters, Universal Animation Library 2 | Village page says CC0; the others not read; the licence conflict in the assessment is unresolved | town pieces, props, animation | **Blocked** until the zip's own licence text is opened. Not needed for animation: the Adventurers carry 76 clips. |
| Kenney Retro Medieval Kit | CC0 | none | **No:** PS1 look clashes with KayKit. |

- Done when: one pack imported end to end and used for one visible change, or a written decision that none is needed.

**S10: the drill camp (built together with the Storm Drill quest, P5 in the Standing plan)**
- What it is, in plain words: when you start a Storm Drill, a small enemy camp appears outside the wall: ladders against the stone, a catapult, targets, tents. It is only there during a drill the player starts, and the drill is labelled "Drill", so a calm fortress never looks besieged and a drill never looks like a real attack.
- Pieces, all KayKit Medieval Hexagon (CC0, the repo is already in use, **no download**): `building_tower_catapult_blue` and `_yellow`, `projectile_catapult`, `ladder`, `target`, `tent`, `weaponrack`, `flag_blue`, `flag_yellow`. Not in KayKit: a siege tower or a battering ram. Options: a simple code-built ram (default), or Kenney Castle Kit through S9.
- Packed into one GLB with the same packer as S6 and S7, loaded only when a drill starts (zero cost the rest of the time), instanced where repeated. Budget: 0.4 MB or less, 30 draw calls or fewer.
- **Version 1 carries no fact:** the camp is the same size whatever the slider says. Decision for Faiz (default: no): let the number of ladders and catapults follow the stored siege level. That is a model showing a fact, so it would need its own exception, written like the cheer's (pure function of stored state, never on sample data, tested for every state).
- Done when: the camp appears and disappears with the drill, a headless screenshot from the gate and from the wall, budget numbers recorded, reduced motion shows the camp without movement.

**S11: the writing nook (P4 in the Standing plan: write in the world instead of leaving for the Journal page)**
- What it is: a desk by the keep door where you write a reason or an invalidation line, using the journal write that already exists (`POST /journal`). Today every quest ends with "go to the Journal page", which leaves the world.
- Furniture, decoration only, from KayKit Furniture Bits (CC0 licence file checked in the repo): `table_medium`, `chair_A_wood`, `shelf_B_large_decorated`, `lamp_table`, `book_set`, `rug_rectangle_A`; plus from Dungeon Remastered `candle_lit` and `shelf_small_candles`. About 12 KB to 55 KB per piece, one shared palette texture.
- **The books that show your written reasons are code-built boxes driven by the journal** (the rule the towers follow). The furniture is a model, the fact is code.
- Decision for Faiz (default: nook): an open-air nook under the keep wall (cheap, one afternoon) or a real interior room (needs walls, a door, a camera rule; a separate sprint).
- Done when: walk up, press E, write, and the shelf shows one more book without leaving `/game3d`; tap count measured in a real browser; budget 0.3 MB or less.

**S12: vault props (parked until The Printer or the Vault has a 3D place; not scheduled)**
- Verified pieces in KayKit Dungeon Remastered: `chest`, `chest_gold`, `coin_stack_small`, `coin_stack_medium`, `coin_stack_large`, `key`, `keyring_hanging`, `column`, `pillar`. Anything that shows an amount (a coin stack for your cash) stays code-built; the chest, keys and columns are decoration.

## Game sprint checklist, section A, for S10 and S11

1. **Pages touched.** Only `/game3d` (the drill camp outside the wall, the writing nook by the keep door, the Oracle and Partner lines that currently send you to the Journal page). No flat Game mode page changes.
2. **Identity score.** `/game3d`: target 2 or higher after each sprint; it must not drop. Not re-scored here.
3. **Visual wins.** S10: *besiege*, at the wall: you see what a drill means. S11: *write*, at the desk: the shelf of books is your written reasons. S11 deletes the "go to the Journal page" lines.
4. **Verb and scene.** As above. S10 encodes no fact in v1; S11 encodes the number of written reasons through code-built books.
5. **Words.** No new paragraphs. Oracle first-step lines stay at 15 words or fewer; wording is a new version file, never an edit of the old one.
6. **Kit.** Reused: `Scenery.tsx` loader pattern, `Horizon.tsx` instancing, the packers `scripts/pack-props.mjs` and `scripts/pack-horizon.mjs`, `CREDITS.md`. Added: one packer job per sprint and a drill-only mount (owner: game-feel-engineer).
7. **Cut line.** S10: cut the siege tower and ram first. S11: cut the picture frames and the rug first. Never the unknown state, the plain words or the screenshots.
8. **Rules.** Truth: decoration carries no fact, fact pieces are code-built. Colour-blind: no red or green pieces, shape and number carry the meaning. Reduced motion: no drill animation. Performance: lazy GLBs, instanced repeats, 300 draw calls or fewer and 15 MB first load or less, measured and recorded.
9. **Taps.** S11: writing a reason from the courtyard is walk up and press E, then write (2 taps from standing near the desk; measured in a real browser). Today it leaves the world.

## Decisions for Faiz (defaults apply if you say nothing)

1. **Drill camp size:** fixed in version 1 (default), or following the stored siege level (a fact on a model; needs its own guarded exception).
2. **Writing place:** open-air nook (default) or a real interior room.
3. **Download Kenney Castle Kit for S9:** only if the KayKit pieces look too thin for the drill camp after S10's first screenshot.

## Risks and open questions

- **Size and load time** on Railway: 3.6 MB raw each. S4 decides if the budget holds.
- **Outline on skinned meshes** may not look right (S2 has a fallback).
- **Look of faces vs the rest of the Stitch style:** judge from a screenshot, Faiz decides.
- **One shared palette texture** limits recolouring; expect at most a small tint.
- **Animation names** are from the Adventurers pack only; confirm in the file at load (log missing clip names, fall back to `Idle`).

## Starting a new chat

1. `git status`, `git log --oneline -15`; fetch `origin/main` (S0 to S8 are merged as #207 to #215, Standing 1 as #217).
2. Read this file, `docs/game/game3d-billboards-2026-10-30.md`, and `frontend/src/game3d/{Figures,Inked,NpcMesh,Player,PropMesh}.tsx`.
3. Re-clone the KayKit repos (sandbox paths from the last session under `/tmp/claude-0/assets/` may be gone).
4. S0 to S8 are done. Next are S10 and S11 (S10 together with the Storm Drill quest), one commit per sprint, tests before each commit.
