# 3D courtyard: free CC0 models and the road to full page parity — sprint plan (updated 2026-11-01)

**Status (2026-11-01): S0 to S8, S10 (drill camp), S11 (writing desk), the keep and corner towers, the marketplace corner, the tower libraries and Standing levels 1 to 5 are merged (#198 to #238, per `docs/PROGRESS.md`). S9 (town kit import) is written and tested in the one open PR (`feature/game3d-town-kit-import`), not merged, not deployed: see [the S9 write-up](game3d-town-kit-import-2026-11-01.md). Deploy not checked, seen only in headless browsers.** The 2026-11-01 update added the review of the three downloaded packs ([review](game3d-art-review-2026-11-01.md)), rewrote S9, replaced the parked S12, and added S13 to S20 so that every flat Game mode page gets a place in 3D. Written so a new chat can start from this file alone.

## Why this plan exists (plain words)

A sprint is one finished, small piece you can try yourself. This plan has two jobs:

1. **Use the free art we now hold.** Faiz downloaded three packs. Two are wins: Kenney's town kit (stalls, goods cart, street pieces, wall and roof pieces) and the KayKit Medieval Builder Pack (finished small buildings: house, market, barracks, mill, watchtower and more). One does not fit our look (Quaternius MegaKit).
2. **Make sure nothing in the normal Game mode is left behind.** Faiz's rule (2026-11-01): *every element and page that exists in normal Game mode must be made available in the 3D game somehow.* Today the 3D world covers the courtyard, eight towers with libraries, a writing desk, the Storm Drill, the quest log and five torches. Most flat pages (Marketplace street and stores, Records, Map, Codex, Vault, Ravens, Night Watch and the rest) are **not** reachable from 3D at all. The new sprints close that gap and a test keeps it closed.

Hard rule unchanged: **CC0 or equivalent, licence text in hand, no AI generation.** Models are decoration; anything that shows a fact stays code-built, like the eight holding towers.

## Where we stand (read from the project docs and the repo, 2026-11-01)

| Built in 3D | What it covers of the flat app |
|---|---|
| Courtyard, walking, camera, KayKit hero, Oracle, Partner, two townsfolk | the Fortress scene (partly) |
| Eight holding towers, nameplates, a door and a **library with six shelves** per tower (Walls, Moat, Land, Oath, Treasury, Storm Test; the table opens the latest report) | per holding: balance sheet, moat, margin of safety, thesis, size, risk; holding page report reader (partly) |
| Writing desk (new journal entry) | Journal, new entries only |
| Storm Drill post and camp, quest 3 | Siege Simulator (one market fall and a written plan; no per-holding results) |
| Quest log (Q), Standing torches (levels 1 to 5), wires list | Hall of Records look-backs (as a torch only), thesis tripwires |
| Marketplace corner (KayKit stall, well, tables; **decoration only**) | nothing: no prices, no stores |
| Keep and four corner towers (KayKit) | decoration |
| **Town kit files (S9, in its PR): four packed files, not placed yet** | nothing yet |

## Free packs: what each is for (details in the [review](game3d-art-review-2026-11-01.md))

| Pack | Licence text in hand | Verdict |
|---|---|---|
| KayKit Adventurers, Hexagon, Dungeon Remastered, Furniture Bits | Yes, CC0 | In use. Dungeon Remastered also covers interiors (floors, walls, doorways, stairs, shelves, tables, chests, coins). |
| **Kenney Fantasy Town Kit 2.0** (folder is wrongly named "tower kit"; 167 pieces, 2.8 MB, one shared palette texture) | Yes, CC0 | **Adopted (S9, in its PR).** Stalls, goods cart, lantern, street, hedges, fences, modular walls and roofs, fountain, mills. One texture means one recolour fixes red and green everywhere. |
| Quaternius Medieval Village MegaKit [Standard] (176 pieces, 75 MB PBR textures) | Yes, CC0 | **Park.** Realistic look, normal maps and 75 MB of textures clash with our flat light and the file budget; its vines would look like the "stale analysis" ivy. |
| **KayKit Medieval Builder Pack 1.0** (226 pieces, 4.0 MB GLB, flat named colours, no textures) | Yes, CC0 (re-checked 11:40 after the files arrived) | **Adopted (S9, in its PR).** Finished buildings (`house`, `market`, `barracks`, `mill`, `watermill`, `lumbermill`, `mine`, `archeryrange`, `watchtower`, `castle`, `well`, bridges, walls) for the Town districts. About 190 terrain tiles are ignored. Orange roofs recoloured to teal. |
| Other Quaternius packs, Kenney Castle Kit, LowPolyAssets weapons | not in hand | Dormant; same rule: open the zip's licence text first. |
| People | none new in hand | Gap: all five Adventurers are used. See S20. |

## Page parity register (the rule, made visible)

Three levels per page. **A = reachable:** a door, sign or menu in the world opens that page's content in a panel in two taps or fewer, with a link to the flat page as Plain view. **B = shown:** the page's main fact is drawn in the world by code, words in a panel. **C = played:** the page's job is done by walking and pressing E.

Every page gets **A at least**, then B or C as the art arrives. A test (S13) lists every route in the app and fails if a route has no 3D entry, so a future page cannot be forgotten.

| Flat page or element | 3D today | Target place in the world | Target level | Sprint |
|---|---|---|---|---|
| Fortress scene (towers, walls, moats, weather) | towers, walls, moats, ivy | courtyard | C (done); **weather and realm verdict missing** | S16 |
| Ledger tab (the plain table) | none | "Plain view" button in the HUD | A | S13 |
| Marketplace street (`/fortress/marketplace`) | decoration only | **Market Street**: one stall per watchlist company | B, then C | S14 |
| Store (`/fortress/marketplace/:id`: eight gates, price board, name your price) | none | step up to a stall, press E: Store panel with its five tabs | C | S14 |
| Sal the Sales Rep (add a stock), Hype Booth (tip-checker) | none | two stands on Market Street | C | S14 |
| Siege Simulator (`/fortress/siege`) | Storm Drill (one fall, plan) | siege yard, drill panel gains per-holding results and the "not modelled" fog | C | S17 |
| Hall of Records (`/fortress/records`, calibration, time capsules) | level-5 torch only | **Hall of Records** building | A, then B | S15 |
| Map / Cartographer (`/fortress/map`, fog of war) | none | **Cartographer's Office** with a table map | A, then B | S15 |
| Glossary and Codex (`/glossary`) | none | **Archive** building | A | S15 |
| Holding page (`/holdings/:id`: scrolls, tower card, advisors, Ravens card) | six shelves, report table | tower library: add shelves (see S16) | B, C | S16 |
| Journal (`/journal`, old entries and look-backs) | desk writes new entries only | desk shelf: books open to read, look-back written at the desk | C | S16 |
| Vault (cash) and Temperament | none | **Vault** (chest, coin stacks by code) in the keep | B, C | S16 |
| Ravens and Night Watch | raven perch is decoration | perch shows a bird only when a real unseen raven exists; the gate guard reads the dispatch | B, C | S16 |
| Advisors and Magic Lamp / Genie | Oracle and Partner only | advisor lines as a shelf in each tower; the lamp as an object | B | S16 |
| Dashboard, Portfolio, Performance, Risk, Margin of Safety, Macro, Sectors, Thesis monitor, Precious metals, Holdings, Watchlist (the main-app pages) | per-holding shelves only (Walls, Land, Oath, Treasury, Storm Test) | **Town Hall**: one room or board per page | A, then B | S15, S18 |
| Analysis queue, System status, Settings, Tag review | none | **Workshop** (gatehouse): plumbing pages | A | S15 |
| The Printer (`/fortress/printer`, **not built yet**) | none | **Royal Mint** with a mill | planned | S19 |

Removed from game mode earlier and **not** to be rebuilt in 3D: Council, Chronicle, Circle, Blindfold Years, Winter Rehearsal, Hearth.

## Rules that stay in force

Own branch off `main`, one PR each, `tsc`, `lint`, `test`, `build` green, a headless screenshot looked at, doc and PROGRESS in the same PR, status written as three facts (merged, deployed, seen on real data). Decoration carries no fact; fact pieces are code-built; a failed model load must leave the world as it looks today. No red or green pieces, shape and words carry meaning, reduced motion respected, no buy or sell words, no points or streaks. Budgets: 15 MB first load of `/game3d`, 300 draw calls, 60 fps (P stats on Faiz's machine); anything new beyond the courtyard loads lazily. Game voice: short and playful, numbers exact. **No Stitch picture is needed for any sprint in this plan**; if one turns up, Faiz is told first with a short description.

## Done and merged (S0 to S8, condensed)

Details and numbers: [models](game3d-kaykit-models-2026-10-31.md), [assessment](game3d-free-3d-packs-assessment-2026-10-31.md), [scenery](game3d-scenery-2026-10-31.md), [horizon](game3d-horizon-2026-10-31.md), [townsfolk](game3d-townsfolk-2026-10-31.md).

| Sprint | What | State |
|---|---|---|
| S0 to S5 | KayKit Adventurers: licence and credits, loader and animation, ink outline on skinned meshes, Oracle (Mage) and Partner (Knight), compression, verification | merged (#207 to #209 and follow-ups). Hero Rogue_Hooded, Oracle Mage, Partner Knight; each file about 0.5 MB. **Never quantize or meshopt a skinned GLB** (broke the scene in S5). |
| S6 | Dress the courtyard (torches, banners, crates, tent, weapon rack, flags) | merged |
| S7 | Outer ring (trees, rocks, hills, mountains), keep and corner towers as models | merged |
| S8 | Townsfolk (Barbarian, Rogue), Oracle casts, quest-1 cheer and confetti | merged |
| S10 | Drill camp with the Storm Drill quest (fixed size, no fact; own table `storm_drills`) | merged (#237); migration `z1b2c3d4e5f6` runs on deploy (deploy not checked) |
| S11 | Writing desk (open-air nook) | merged (Standing 2) |
| Marketplace corner | KayKit stall, well, canopy, tables, crates, barrels, flags; decoration only | merged |
| Tower library | walk into a tower, six shelves from stored facts | merged |

## New and rewritten sprints

Order is the recommended order. Sizes are relative (S, M, L), not hours.

### S9 (rewritten): bring in the Kenney Fantasy Town Kit and the KayKit Builder Pack (S, a gate for S14 and S15)

**Status: written and tested in PR `feature/game3d-town-kit-import`, not merged ([write-up](game3d-town-kit-import-2026-11-01.md)).** Differences from the plan below: four groups in 1.4 MB (buildings 815 KB, 20k triangles for 13 pieces incl. `castle`); Kenney scale x2.5 and Builder x5.5 (recorded in `townPieces.ts`); leaf greens of trees and hedges kept (red and teal-green retinted to blue and teal, a call for Faiz); Kenney wall and roof pieces not packed (not needed); the packer is `scripts/pack-town.mjs` and `scripts/import-pack.mjs` is the licence gate; `frontend/3D art review/` gitignored. The lineup was a throwaway row; the two pictures are in `docs/game/img/`. **Decision gate: Faiz judges the pictures.**

*For:* getting the stalls, cart and building pieces into the project in our colours, and checking they sit next to the KayKit pieces before anything is built on them.
- **KayKit Builder Pack part:** copy its `License.txt` as `LICENSE-KayKit-Medieval-Builder.txt`, one credits row (Kay Lousberg, CC0 1.0, 2021-07-30). Pack only the building pieces we use (about 10: `house`, `market`, `barracks`, `mill`, `watchtower`, `lumbermill`, `mine`, `watermill`, `well`, `wall_*`) into `town-buildings.glb` (about 1 MB expected, 15k triangles); skip the 190 terrain tiles. The pieces use plain material colours, so the packer **recolours roofs to the blue or teal set** and skips or recolours the `Red` target material of `archeryrange`. Scale about 5 to 6 times (a tile is 2 units, a house 1.7 wide).
- **First commit:** add `frontend/3D art review/` to `.gitignore` (175 MB, untracked now). Copy `License.txt` to `frontend/public/models/LICENSE-Kenney-Fantasy-Town-Kit.txt`; add a credits row ("Fantasy Town Kit 2.0, Kenney, CC0 1.0, 2025-08-03").
- `scripts/import-pack.mjs` (planned in the old S9): reads the pack folder, **stops if there is no licence text or it is not CC0**, converts nothing it does not need.
- **One retinted palette:** a new `town-palette.png` replacing Kenney's `colormap.png` (roofs and awnings in teal and cream, stone slate, timber brown; no red, no green). Every piece shares the one 512 by 512 texture, so one edit recolours all 167. Kenney's own Variation A is this trick.
- Packer `scripts/pack-town.mjs` (same rules as `pack-market.mjs`: float vertices, no quantize, no meshopt): groups `town-market.glb`, `town-street.glb`, `town-buildings.glb` (KayKit Builder buildings plus Kenney wall pieces if needed), `town-nature.glb`. Expect well under 1 MB for the lot (the raw GLBs total 2.8 MB for all 167).
- Scale about 2.5 to 3 times so a stall is about 3 high beside 2.0-tall people; measured, recorded.
- **Lineup test:** a throwaway row in the courtyard (stall, cart, lantern, fence, hedge, tree, a Builder `house` and `market`) beside KayKit crates and the market corner, screenshot, Faiz judges.
- **Done when:** licence and credits in place, groups built with sizes recorded, a test that every piece uses the retinted palette and no model name contains `red` or `green`, one screenshot of the lineup.
- **Cut line:** nature and fountain groups first. **Decision gate:** if the lineup looks wrong next to KayKit, S14 and S15 fall back to KayKit pieces only (they have crates, barrels, tables, a `building_market`, a `tent`, but no awning stall).

### S13: the parity layer, page doors and Plain view (M, art-independent, do first after S9 or in parallel)

*For:* making **every** flat page reachable from 3D right away, with no new art, and making the rule enforceable.
- `parity3d.ts`: the register above as data (route, place, level, sprint). A test reads the app's route list and fails if a route is missing, and fails if a "planned" entry has no sprint.
- A generic **world panel** that hosts an existing page's content (the same components the flat route renders, read-only) with a "Open the flat page" link. Pages that write (Store's name-your-price, Sal) keep their existing write calls only.
- A **signpost and menu in the keep or at the gate**: "Where to?" lists every place; choosing one opens its panel (Level A for all pages in two taps: E at the sign, pick). Real doors replace the sign one district at a time (S14, S15).
- A HUD **Plain view** button that opens the flat Fortress, so a 3D failure never hides data.
- **Done when:** every route in the register opens from the sign; the register test is green and fails on a deliberately removed row; tap counts measured in a real browser.
- **Cut line:** the main-app pages go in as links first, panels second.

### S14: Market Street, the Marketplace in 3D (L, four steps; needs S9)

*For:* the biggest missing page. Today the 3D market is a decorated corner that says nothing; the flat Marketplace tells you which watchlist company is near the price you named.
- **M1, the street:** a lane of plots on the south-east ground (the corner today becomes its plaza): Kenney retinted awning stalls, goods cart, lanterns, fences, hedges, street pieces, plus KayKit crates, barrels, sacks. **One stall per watchlist company**, same order as the flat street (in range first, then nearest to your price, then name); more than fit are listed in the panel ("the N stalls with no price of yours"), not drawn. Plot count follows the data; empty plots stay bare.
- **M2, what a stall says (all code):** a **pennant on a bare pole** (shape plus a printed word per tone), a price stake, the signed gap on a plate under the stall, as in the [Market Street brief](marketplace-landscape-2026-10-17.md). Models carry no fact. Unpriced companies stand at the far end in a fog lane, still enterable.
- **M3, the Store panel:** walk up, press E: the existing Store content (`lib/marketplace.ts`, rules `market-v1`: eight gates, price board, five tabs) opens in a panel; **Name your price** keeps its single existing write (PATCH of the buy-below price). Never says buy or sell.
- **M4, Sal and the Hype Booth:** two stands with a KayKit person each (reuse Barbarian and Rogue poses with a prop swap) opening the existing Sal dialog (add a stock by ticker, Oslo `.OL` hint, Newsweb runners) and the Hype Booth tip-checker. Disclaimer wording stays.
- **Done when:** with a watchlist of 5 and of 24, the right stalls stand, the pennant words match the flat page row for row (a test compares the two), the sample fortress shows stalls but cannot save, an empty watchlist shows the plaza and one line; budget recorded (instance the repeated stall).
- **Cut line:** Hype Booth, then the fog lane's art. Never the plain words, the unknown state, or the screenshots.
- **Decision (default, Faiz may overrule):** stall model chosen **by sector** once more than one awning style exists, otherwise by stable id; start with one style.

### S15: the Town, districts and a building kit (L; needs S9; do a spike first)

*For:* a place with a door for each page that is not a store: Records, Map, Codex, plumbing, the main-app pages.
- **Spike (S):** decide where the Town lives. **Default: a second zone beyond the gate, entered through the gate road like a tower door** (scene swap, lazily loaded, own budget), so the courtyard and its 60 fps stay as they are. The other options (crowd the courtyard, or enlarge the walls again) are rejected for budget and walking-time reasons. One screenshot of an empty Town ground and the walk from the gate.
- **Building kit:** a data file `buildingKit.ts` (model, position, yaw, footprint for the collider, sign word). **Finished buildings first, from the KayKit Builder Pack** (no assembling); Kenney modular walls, doors and roofs only for a shape the pack lacks; Hexagon buildings where one fits. Colliders from the footprint; the door sign is code-drawn text.
- **First four buildings (proposed model, a look decides):** **Hall of Records** = `castle` or `barracks` (records and calibration), **Cartographer's Office** = `watchtower` (map), **Archive** = `house` (Glossary and Codex), **Workshop** = `lumbermill` or `mine` (Analysis queue, System status, Settings, Tag review). Each door opens the page's panel from S13 (Level A); the building is decoration, the fact stays in the panel. The Builder Pack `bridge` and `wall_gate` can frame the gate road into the Town.
- **Town Hall** (the main-app pages) gets its building here and its rooms in S18.
- **Done when:** the gate leads to the Town and back, four buildings open the right panels, colliders tested like `props.test.ts`, budget recorded for the zone.
- **Cut line:** Workshop first, then Archive.
- **Towers:** Kenney has none; towers are KayKit (`watchtower` from the Builder Pack, Hexagon towers).

### S16: the Fortress panels in the world (M, in two or three PRs; no new art needed)

*For:* the flat Fortress parts that have no 3D home yet.
- **Vault:** a KayKit `chest` in the keep; coin stacks **by code** show cash (an amount stays code-built); press E opens the existing Vault panel (update cash, the one write that exists). Temperament joins this panel.
- **Ravens and Night Watch:** the raven perch shows a bird **only when a real unseen raven exists** (flat-page rule); the gate guard reads the Night Watch dispatch on E; "Read the report" opens the existing reader.
- **Advisors:** each tower library gets a seventh shelf, "The Council's words", with the existing hand-written per-holding lines. Disclaimer wording kept.
- **Journal:** the desk shelf's books open to read old entries (read only); a due look-back is written at the desk (reuse the existing journal update, no new endpoint).
- **Weather and realm verdict:** sky and fog and a banner on the keep follow the stored weather and the realm verdict. **Flat neutral lighting stays:** weather is drawn by particles and sky tint only, never by changing the light on a tower. Decision for the sprint: show a "calm skies" state the same as the flat page, unknown stays fog.
- **Magic Lamp / Genie:** a lamp object on the desk opening the existing Genie wishes (decoration around a panel that already works).
- **Done when:** each item opens the same words as its flat page (a test per panel compares the strings), sample guard and unreadable states tested, screenshots.
- **Cut line:** lamp, then weather.

### S17: the siege yard, full simulator (S to M)

*For:* the missing half of the Siege Simulator: results per holding.
- The Storm Drill panel gains the flat page's per-holding rows (the "SiegeStrip" facts, the weighted beta line, the "Not modelled" fog with the one fix instruction). Fixed-size camp stays (decision 2026-10-31); **no model grows with the fall**.
- Siege tower and ram: skipped (cut line, still absent from both KayKit and Kenney).
- **Done when:** for every fall the panel matches the flat page's numbers (test), a holding without a stored beta says so once.

### S18: interiors and the Town Hall rooms (M; needs S15)

*For:* rooms you can walk into for the pages that are lists, not pictures.
- Reuse the library's scene-swap pattern (hero moved through a door). Interiors from **KayKit Dungeon Remastered** (flat-style floors, walls, doorways, stairs, shelves, tables) and Furniture Bits (rugs, lamps, shelves, books).
- **Town Hall:** one room per page group (Portfolio and Performance, Risk and Margin of Safety, Macro and Sectors, Thesis monitor and Precious metals, Holdings and Watchlist); each room has a **code-built board** showing the page's headline number and a panel with the full page (Level B).
- **Records Hall interior:** time capsules on shelves (same-size books, as flat page).
- **MegaKit style test (optional, default no):** one house, one screenshot, to confirm or reopen the "park" verdict.
- **Done when:** each room opens from the Town Hall, boards match the flat numbers (test), budget per room recorded.
- **Cut line:** the MegaKit test; Macro and Sectors room.

### S19: the Royal Mint (parked until The Printer page exists)

The Printer is planned as a flat room (`/fortress/printer`, P1 engine written, P2 to P5 not built). Reserve a plot in the Town now (`reservedZones`). When P2 lands: the Builder Pack `mill` or `watermill`, or Kenney `watermill`, `wheel` and `windmill` (retinted), as the building, **brass lever wall and coins by code**. Not scheduled; the parity register keeps it as "planned".

### S20: more people (S, decision first)

All five KayKit Adventurers are in use (hero, Oracle, Partner, two townsfolk). Market stalls, the scribe, the raven keeper and the vault keeper need bodies. Options: reuse the five with hat and prop swaps (free, default); or Faiz downloads another CC0 character pack and S9's importer vets it. No new character pack is in hand. Merchants carry no fact (they speak the flat page's words only).

### S12 (folded into S16): vault props

`chest`, `chest_gold`, `coin_stack_*`, `key`, `keyring_hanging`, `column`, `pillar` (KayKit Dungeon Remastered, names verified). Amounts stay code-built.

## Game sprint checklist, section A, for the new sprints

1. **Pages touched.** `/game3d` only. No flat Game mode page changes; the flat pages stay as the Plain view and as the source of every number.
2. **Identity score.** `/game3d` stays 3 or higher after each sprint. S13: 3 (no change). S14: a street with stalls (visual verb *browse*, scene Market Street, fact: which companies sit near your price). S15: a Town beyond the gate.
3. **Visual wins.** S14 stalls and pennants; S15 a town with doors; S16 the Vault chest and the raven.
4. **Words.** Reuse the flat page words; new strings go in new version files (`marketWordsV1.ts`, `townWordsV1.ts`); never edit an old version.
5. **Kit.** Reused: `Scenery.tsx` and `Market.tsx` loader pattern, `pack-market.mjs`, `Inked`, panel style from `hudPanels.ts`, the library scene swap.
6. **Cut lines.** In each sprint above.
7. **Rules.** Truth: unknown is fog; models carry no fact; every number comes from the same function as the flat page, tested. Colour-blind: words and shapes. Reduced motion: nothing needs to move. Performance: lazy zones, instanced repeats, budgets recorded.
8. **Taps from a cold load.** Reach any page: E at the sign, pick (2). Enter a store: walk up, E (1 after arriving). Measured in a real browser, not from the diff.

## Decisions (defaults chosen by Claude on 2026-11-01 under Faiz's standing "you decide"; Faiz may overrule)

1. **Kenney kit: adopt, recoloured to our palette.** Reason: one shared texture, 2.8 MB for everything, fits the flat look. Red and green stay out. **KayKit Builder Pack: adopt for the Town buildings** (same author and family as the pieces already in the courtyard; finished buildings, 4 MB for everything, recolour roofs).
2. **Quaternius MegaKit: park.** Reason: style, 75 MB of textures, and vines that look like the ivy fact.
3. **Where the districts go: a Town zone beyond the gate**, entered like a tower door. Reason: protects the courtyard's budget and walk time. A spike confirms it first.
4. **Parity levels:** A (reachable) for everything first, B and C as the art and time allow. The register test enforces A.
5. **People:** reuse the five Adventurers with prop swaps until Faiz downloads more.
6. **Order:** S9, S13, S14, S15, S16, then S17, S18; S19 waits for The Printer; S20 when a body is needed.

## Risks and open questions

- **Style next to KayKit** was judged from pictures until the S9 lineup; the lineup now exists ([pictures](img/game3d-town-lineup-wide-2026-11-01.png)) and looks like one family, but Faiz judges.
- **The Town zone** is the one architecture decision (second scene); if the spike says no, S15 shrinks to a few buildings in the courtyard.
- **Flat pages as panels:** some flat page components may assume the full page layout; S13 may need small wrappers (checked then, not now).
- **Data the 3D world must not invent:** weather, pennant words and boards use the same functions as the flat pages; a test per place.
- ~~The folder `frontend/3D art review/` is 175 MB and untracked~~: gitignored in S9.
- **Kenney `stall` is a low counter** (0.37 high); only the red and green stalls have awnings, so the retint was required for S14 (done in S9: `stall_awning_blue`, `stall_awning_teal`).
- **Several Kenney modular pieces sit on a tile edge** (fence, hedge, poles, banners, overhang): place them by their edge, not their middle (sizes and minimums in the S9 write-up).
- **Builder Pack buildings are heavier than Kenney's** (1,250 to 2,270 triangles each): use only the ones needed and instance repeats. Done: 13 pieces, 20k triangles, 815 KB.
- **Animation names** are from the Adventurers pack; the rest unchanged from earlier plans (outline on skinned meshes, one shared palette texture limits recolouring of KayKit characters).

## Starting a new chat

1. `git status`, `git log --oneline -15`; fetch `origin/main` (everything up to #238 is merged; the only open PR per PROGRESS is S9).
2. Read this file, the [art review](game3d-art-review-2026-11-01.md), `docs/PROGRESS.md`, and `frontend/src/game3d/{Market,Scenery,Library,Scene,layout}.tsx` and `scripts/pack-market.mjs`.
3. S9 is done in its PR (merge it first, or branch from it). Start with S13 (page doors, Plain view, register test), then S14 Market Street.
