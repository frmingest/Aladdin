# 3D courtyard: other free 3D packs, assessment (2026-10-31)

Question from Faiz: besides the three KayKit Adventurers characters, are there other free 3D packs worth using in Game mode (3D courtyard)? Hard rule from the plan: **CC0 or equivalent, free, no AI-generation, no per-model licence hunting.** Plan that uses the result: [game3d-kaykit-sprint-plan-2026-10-31.md](game3d-kaykit-sprint-plan-2026-10-31.md), sprints S6 to S9.

## How this was checked, and what could not be

- **GitHub is the only host the cloud sandbox and Faiz's machine both reach.** `quaternius.com`, `kenney.nl`, `itch.io`, `opengameart.org`, `poly.pizza` all fail from here (checked with curl from both, and the fetch tool refuses kenney.nl). So packs hosted only there cannot be downloaded by me, only read about; **Faiz would download the zip himself** (S9 has an import script for that).
- **Verified here** = I cloned the repo, read its `LICENSE.txt` and listed the files. **From a web page** = what the pack's own page says, read through a search/fetch tool today. **Unverified** = my general knowledge, not checked today.

## Verified: KayKit repos on GitHub (all CC0 1.0, same author and look as the Adventurers)

The GitHub names need the `KayKit-` prefix (the earlier plan listed names without it, which is why they "failed").

| Repo (`KayKit-Game-Assets/…`) | Size | Format | What is in it | Use in the courtyard |
|---|---|---|---|---|
| `KayKit-Character-Pack-Adventures-1.0` | (done) | glb | Knight, Mage, Rogue_Hooded in use; **Barbarian and Rogue unused** | Extra people (S8) |
| `KayKit-Medieval-Hexagon-Pack` | 95 MB repo | gltf+bin | ~200 pieces: `building_tower_A/B/base/catapult`, `castle`, `well`, `market`, `tavern`, `church`, `windmill`, walls and fences, trees, rocks, hills, **mountains**, clouds, `flag_*`, `barrel`, `crate_*`, `tent`, `weaponrack`, `wheelbarrow`, `target`, `bucket_*`, `sack`, `ladder`; 5 colour sets (blue, green, red, yellow, neutral) | Scenery and the mountain backdrop (S6, S7) |
| `KayKit-Dungeon-Remastered` | 72 MB repo | glb | ~200 pieces: `torch`, `torch_lit`, `torch_mounted`, **42 banners**, barrels, kegs, chests, columns, pillars, tables, benches, candles, crates, keys, coin stacks, walls, doorways, stairs, floors | Torches, banners, keep door dressing (S6) |
| `KayKit-Furniture-Bits` | 12 MB repo | gltf+bin | chairs, tables, couches, cabinets, lamps, picture frames, beds, books | Only if there is ever a keep interior (not planned) |
| `KayKit-City-Builder-Bits` | 16 MB repo | gltf+bin | modern buildings, cars, benches | No: modern, wrong setting |
| `KayKit-Space-Base-Bits` | 17 MB repo | gltf+bin | sci-fi base | No: wrong setting |

Not found on GitHub under the names tried (`Skeletons`, `Character-Animations`, `Forest-Nature-Pack`, `Prototype-Bits`, `Resource-Bits`, `Fantasy-Village`, `Medieval-Builder-Pack`, `Halloween-Bits`, `Platformer-Pack`): **they live on itch.io** (Kay Lousberg's page). Two read today:

- **KayKit Forest Nature Pack**: CC0 per its page; **Free tier (6 MB) has 100+ trees, rocks, bushes and grass**, FBX/glTF/OBJ; the larger tiers are pay-what-you-want. Good for the outer ring behind the walls. Faiz downloads it.
- **KayKit Character Animations 1.2**: CC0, pay-what-you-want, 7.5 MB, FBX and glTF. Its page says it is for the **older, leg-less KayKit characters**; the Adventurers already carry their own 76 clips. **Not needed.**
- KayKit Skeletons: itch.io only, **not read**. Would be the natural "enemy/ghost" extra if Faiz ever wants one; unverified.

## From a web page: Quaternius (https://quaternius.com)

- **Medieval Village MegaKit**: page says **CC0**, "free for personal, educational and commercial projects"; 304 modular pieces (walls, roofs, stairs, doors, windows); glTF in the Standard and Pro tiers (Standard is about 60 to 70 % of the pack, free). The Source tier (Blender, engine projects) is paid via Patreon. The page says nothing about redistributing the files.
- The site also lists many character, animation (Universal Animation Library 1 and 2, Ultimate Animated Character, Modular Men and Women, Animated Knight), nature, dungeon and monster packs. **Licence not read for those** (the licence page is not reachable from here).
- **Conflict to settle before use:** the first plan said newer Quaternius packs use a custom licence (QAL) that forbids redistribution. I could not re-check that and the pack page I could read says CC0. **Rule: before any Quaternius pack goes into `frontend/public/`, open its own licence text in the downloaded zip, and put that file next to `CREDITS.md`** (as done for KayKit). Our files are served to every browser that opens `/game3d`, so "no redistribution" would matter even if the repo is private.
- Style: also low-poly with a palette or flat colours, closest match to KayKit of the non-KayKit sources. A MegaKit house would sit well beside Hexagon pieces, but the pieces are many and modular, so the build effort is real (S9, optional).

## Unverified: Kenney (https://kenney.nl)

Not reachable from here. From general knowledge only: Kenney's packs are CC0, with 3D kits such as Castle Kit, Nature Kit, Fantasy Town Kit and several simple character packs, in a plainer, flatter style than KayKit. **Not checked today; not planned.** If Faiz wants one, he downloads it and S9 vets its licence file.

## Rejected

| Source | Why |
|---|---|
| Synty free samples (POLYGON Prototype, Dungeon sample) | Synty's own licence, not CC0, redistribution of the files is restricted. Fails the hard rule. |
| Mixamo | Adobe ID and Adobe terms, not CC0. |
| Sketchfab, Poly Pizza | Licence is per model (CC-BY, CC0, others); needs a check per file and credit lines. Allowed one by one, but not as a source for bulk. |
| OpenGameArt | Per-asset licences; mostly mirrors of the packs above. Nothing new needed. |
| Any AI-generation tool | Excluded by Faiz (the Modly workflow was removed, PR #204). |

## What fits the game, and what does not

Rules that stay: **no model carries a fact** (towers are driven only by `stateToWorld()`), the fountain, lamps, quest board and raven perch stay code-built, and every model has a fallback or is pure decoration so a failed load costs nothing.

| Idea | Pack | Verdict |
|---|---|---|
| Torches at the keep door and gate, banners on the keep wall (teal and the neutral colours, no red or green flags that could read as status) | Dungeon Remastered | **Yes, S6.** Cheap, instanced, the biggest "it looks like a place" gain. |
| Barrels, crates, sacks, a tent and a weapon rack near the Partner, a wheelbarrow by the gate | Hexagon props | **Yes, S6.** |
| Trees, rocks, hills and mountains outside the walls to replace the code-built mountain backdrop | Hexagon nature (and KayKit Forest free tier) | **Yes, S7**, after S6 shows the style holds. |
| Replace the four corner towers and the keep with `building_tower_*` and `building_castle_*` | Hexagon | **Maybe, S7, behind a look-and-judge.** Corner towers and keep carry no facts, so allowed. They need colliders that match the model, which is real work. |
| Replace the **holding towers** (the eight pads) | Hexagon towers | **No.** They show crenels, cracks, ivy, water and flags from real data; a fixed model cannot show those. Hexagon could still supply the *base* or flag shapes later, but that is a design question for Faiz, not a swap. |
| Two more people standing about (Barbarian, Rogue) as townsfolk | Adventurers (already in repo's source pack) | **Yes, S8, small.** Decoration only; they say nothing and carry no data. |
| Keep interior (Oracle's study) | Furniture Bits, Dungeon | Not now: there is no interior. |
| Skeleton enemies, animals | itch.io packs | Not now: no game use. |

## Budget with the extras

First load of `/game3d` must stay at 15 MB or less and draw calls at 300 or less. The three characters are 1.57 MB now. KayKit props are small (a handful of KB each plus one shared palette texture), so S6 should add well under 1 MB if props are packed into one GLB per group and instanced. S6 measures it; S7 (nature, buildings) is the one that can break the budget.
