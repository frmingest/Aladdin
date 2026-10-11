# Design Master: review and sprint plan (2026-10-11)

Status: **plan for Faiz to approve. Nothing in this plan is built.** Written from a fresh clone of `main` (`e939577`, PR #101 merged), all 52 object images and 10 screen mocks in `frontend/public/art/Design_master`, the Stitch `DESIGN.md`, and a read of the scene, map and marketplace code. `E:\Aladdin` is stale (branch `feature/currency-edit-and-nok-equivalent`, older than `main`); pull `main` before any build.

Related: [stitch-master-object-art-2026-10-11.md](stitch-master-object-art-2026-10-11.md) (style, rules, prompts for what is still missing), [game-sprint-checklist.md](game-sprint-checklist.md) (section A is answered in Part 7).

## 1. Verdict

**Yes: Design_master is enough to start, and it covers well over half of the objects.** Every holding structure the Fortress draws now has art: spire and bastion towers in all five wall materials, outpost, granary, gold store, Great Keep, shack, the whole siege camp, raven, lamp, four map markers, five map props, Sal's counter and four stalls. Decoration is cheap to swap; the work is in keeping the data truthful (freshness, wall material, realm verdict, siege level, fog), which stays in code on top of the pictures.

| Scope | Slots | Covered | Usable as-is |
|---|---|---|---|
| **Core** (Fortress, siege camp, props, map, marketplace and people) | 56 | **41 (73%)** | 35 (62%) |
| Core, counting the 10 spire/bastion material variants as 2 objects | 48 | 33 (69%) | 27 (56%) |
| Core plus optional room objects (Council, Records, Chronicle, Circle, Night Watch) | 66 | 41 (62%) | 35 (53%) |

"Covered" means a usable image exists; "as-is" means it needs no touch-up. The full slot list is Part 3. The room objects stay SVG by recommendation: those pages already score 2 or 3 and are not blocked on art (Part 5, decision 9).

**Biggest risks found (details in Part 4):** (1) 103 MB of masters sit untracked inside `frontend/public/art/`, which Vite ships; one `git add .` puts 100 MB on Railway. (2) Several pictures bake in something the data must decide: pennants, and (for stalls) the awning colour. (3) Existing code overlays (crack, ivy, scaffolding, ladders, lit windows) are painted in the old style and will clash with the new art unless restyled. (4) Wall segments and corner bastions are missing, so the Fortress cannot go fully to art until they exist.

## 2. What is in the folder

52 object images, all 1024 x 1024 PNG, opaque; 49 on pure white, 3 (Sal busts) on a pale tinted background. 10 screen mocks (desktop 1440, phone 390, with `code.html`), `fortress_quest/DESIGN.md`, and `image.png` (a flat stock-style castle, **look reference only, never ship**).

`Design_master` replaces `stitch_master`: it holds the same files plus 42 new objects, and three desktop mocks changed (game canvas, marketplace, cartographer). `stitch_master` (49 MB) and `new` (6.6 MB, the pass-1 screens already processed in #97) are now retired copies.

| # | Object | Proposed id | Status |
|---|---|---|---|
| 37, 39, 40, 41, 38 | Spire tower: granite, basalt, brick, timber, rotted | `spire-{wall}` | Ready. Windows dark, plain pennant. |
| 26, 23, 24, 25, 22 | Bastion tower: granite, basalt, brick, timber, rotted | `bastion-{wall}` | Ready. |
| 36, 45 | First spire (5 baked lit windows, red hanging banner) and first bastion | none | Superseded by the sets above. |
| 15 | Allied outpost on a mound | `outpost` | Ready. |
| 27 | Granary | `granary` | Ready. |
| 35, 50, 51 | Vault house: chest, small coin piles, large hoard | `vault-1/2/3` | Ready. Plain teal pennant, no cast shadow. |
| 42 | First vault (cast shadow, coin emblem) | none | Superseded by 35. |
| 17 (18 is a near-copy) | Great Keep, granite | `keep-granite` | Ready. Pick one of 17/18. |
| 46, 47, 48, 49 | Great Keep: basalt, brick, timber, rotted | none yet | No slot (Part 5, decision 4). |
| 1 | Gatehouse wall | none | Hold: baked orange emblem banner and arrow artefacts on the merlons. |
| 34 | Shack | `shack` | Ready. One shack; code places many. |
| 6, 5, 7, 3, 4 | Tent, soldier, trebuchet, ram, siege tower | `siege-*` | Ready. Charcoal palette, black pennants, no red. |
| 8 | Fire arrow | `siege-arrow` | Needs a glow cut (Part 4). |
| 10, 11, 12, 13, 14 | Pines, palms, rocks, bridge, ship | `prop-*` | Ready. |
| 32, 16 | Raven with scroll, brass lamp | `raven`, `lamp` | Ready. |
| 33, 43 | Walled town, mountain citadel | `map-town`, `map-citadel` | Ready. |
| 2, 9 | Trading port, island sanctuary | `map-port`, `map-island` | Port has a shadow smudge. |
| 52 | Sal's counter, teal, blank sign | `sal-counter` | Ready. This is the real S13; it replaces the stand-in made by `pack.py`. |
| 44 | First Sal's counter (red awning, "SAL'S WARES") | none | Superseded by 52. |
| 28, 29, 30, 31 | Stalls: smithy, armoury, provisions, scribe/alchemist | `stall-*` | Awning is baked teal and cream (Part 5, decision 6). 31 is already `booth-goods` from Phase A. |
| 20, 21, 19 | Sal busts: open hand, worried with ledger, shrug | `sal-pitch`, `sal-oops`, `sal-think` | Ready after keying the tinted background. No "cheer". |
| 10 mocks | Screen mocks | none | Reference only (Part 4). |

## 3. Slot register (the coverage numbers)

R = ready, F = ready after a fix or rework, M = missing.

| Group | Slots | R | F | M | Missing or reworked |
|---|---|---|---|---|---|
| A Fortress buildings | 17 | 15 | 0 | 2 | **curtain wall segment, corner bastion** |
| B Siege camp | 6 | 5 | 1 | 0 | fire arrow glow cut |
| C Scene life and props | 11 | 7 | 0 | 4 | genie (3 faces), well, haystack, bush or flower tuft |
| D Map | 10 | 4 | 1 | 5 | mountain range, hill, sea serpent, compass rose, planted flag; port shadow |
| E Marketplace and people | 12 | 4 | 4 | 4 | Sal "cheer", store shopkeeper (5 verdict faces), Oracle, Partner; four stalls need the awning decision |
| **Core total** | **56** | **35** | **6** | **15** | |
| F Room objects (optional) | 10 | 0 | 0 | 10 | council table and chairs, tomes, bookshelf, wax seal, scroll, sealed letter, hourglass, candle stand, study desk, 8 room crests |

## 4. Review findings

**Files and repo**
- `frontend/public/art/` holds `Design_master` (49 MB), `stitch_master` (49 MB, duplicate) and `new` (6.6 MB), untracked and **not in `.gitignore`**. Vite copies `public/` into the build, so committing any of it ships it to Railway and bloats the repo; the pre-commit hook only blocks documents, not images. Fix in Sprint 0: masters leave `public/`, packed art lives under `src/assets/art/` with content-hashed names (also fixes stale caching of `/art/objects/*.webp`).
- Phase A (PR #101) is on `main`: `scripts/art/pack.py`, `stitchArt.ts`, `ObjectArtImage.tsx`, two WebPs, Marketplace strip and empty street. Deploy not verified.

**Image defects (tested: flood-fill keying from the border on all 52)**
- 46 of 52 key cleanly at 18-65 KB each (512 px, WebP q82).
- Fire arrow (8): glow and smoke on white leave a halo; needs alpha taken from distance to white, not flood fill.
- Port (2) and first vault (42) keep a soft shadow smudge; vault 35/50/51 are clean, port needs an erase.
- Great Keep rotted (49): pale turrets partly key out; fix with a lower threshold for that image.
- Sal busts (19-21): background is lavender or cream, not white; key from a sampled border colour.
- Keeps (17, 18, 46-49) have a thin baked ground line; crop it.
- 17 and 18 are near-identical; 22-26 and 37-41 are consistent sets (good: same pose, only material changes).

**Truth conflicts (what a picture must not say)**
- **Pennants are baked in** on every tower, the keep, the outpost and the vault. Today only a fresh tower has a banner, and the Great Keep banner colour is the realm verdict (`TONE_BANNER`). A baked teal pennant is decoration, but a stale tower with a flag looks well kept. Rule: freshness is carried by code only (amber light in the windows and door, plus the existing banner), and the Sprint 1 spike decides whether flagless regenerations are needed (Part 5, decision 3).
- **Stall awning colour is data** (the stored verdict tone). The baked teal awning hides it. Options in Part 5, decision 6.
- **Wall material** is data: five of seven values have art; `unsurveyed` always stays the code ghost keep, `not_applicable` uses granite.
- **Window light and torches** are the freshness signal and are dark in every picture, which is what we want; code draws the glow at per-image anchor points.
- **Code overlays are in the old painted style** (crack, ivy, scaffolding, thesis marks, ladders, moat, drawbridge) and will clash with ink-outlined art. Restyle in the same sprint, or the Fortress looks pasted together.
- **Weather.** The scene is repainted per weather (`worldPalette`); a raster object has fixed light. A brightness and saturation grade per weather is needed so a tower in besieged weather is not sunlit.

**Screen mocks (still reference only)**
Same conclusion as 2026-10-11: they break standing rules (XP, level, gold, gems, waves, "START BATTLE", "Claim", invented figures, emoji icons, objects on white squares, fixed 1440 px width, 8-10 px text). The Stitch UI system is not adopted (decision 2, 2026-10-11, unchanged). The dual-continent map mock shows two realms; the app has one, so nothing is taken from it.

**Sizing facts the sprints depend on**
Tower boxes are w 48-118 px, h 62-156 px (about 3:4); spire art is about 0.37 wide-to-high, bastion about 0.8. The scene is 1000 px wide with 290 px rows. At most about 30 towers, so a full Fortress costs roughly 10 tower images plus keep, siege and props: about 400 KB.

## 5. Decisions needed from Faiz

Each has a recommendation; "approve the plan" accepts all of them.

1. **Order and scope** of Sprints 0-7 (Part 6).
2. **Silhouette rule:** spire for `great` and `medium` size classes, bastion for `small`, `tiny`, `unknown`. Size class is already a fact the tower shows by size, so it adds no new meaning. Alternative: by structure type. *Recommended: size class.*
3. **Baked pennants:** accept the plain teal pennants as decoration, with freshness shown only by code light and banner; decide after the Sprint 1 spike on real towers whether to ask Stitch for flagless versions. *Recommended: accept, spike first.*
4. **Great Keep material variants** (basalt, brick, timber, rotted keeps): no slot, because the keep is one structure whose banner shows the realm verdict; a material would invent a meaning. *Recommended: do not use; keep in the masters.*
5. **Map markers:** by structure plus weight band: heavy stock keep = citadel, other stock = town, fund = outpost, gold = vault, cash/bond = granary. Port and island become scenery landmarks (coast and islet), not holdings. *Recommended: yes.*
6. **Marketplace stalls:** (a) use the four teal stalls as is, tone shown by the plate edge and tag word (colour was never the only signal); or (b) ask Stitch for awning-less stalls so the code awning keeps showing the tone. Which stall a company gets: stable hash of its id, labelled decoration. *Recommended: (a) now, (b) only if the street loses its at-a-glance tone.*
7. **Default:** art stays opt-in (`?art=stitch`, plus a Settings toggle added in Sprint 0) until you have seen Sprints 1-5 on real data; flipping the default is Sprint 7. SVG stays as the fallback permanently.
8. **Cleanup:** delete the retired folders `stitch_master` and `new` from `frontend/public/art`, and the retired docs in Part 9. *Recommended: yes; I will ask once more for the delete permission when I get there.*
9. **Other rooms:** do not convert Council, Records, Chronicle, Circle, Night Watch to art unless you want it; they already score 2-3 and the pictures would be a second visual language there. *Recommended: no.*

## 6. Sprint plan

Every sprint is one branch off fresh `main` and one PR, behind `?art=stitch|svg`, SVG default, never merged by me. Before each PR: `ruff check .`, `pytest -q`, `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; `docs/PROGRESS.md` and the Claude project `progress.md` updated in the same PR. Sizes are relative (S, M, L), not days. Statuses stay "written, not yet deployed" until verified.

**Sprint 0: Foundation (S).** No visible change.
- Move masters out of `public/`; `.gitignore` and a pre-commit guard for images over 150 KB outside `src/assets/art/`.
- `scripts/art/manifest.json` (id, source folder, key mode, anchors) and a batch `pack.py` with four key modes: white (flood fill), sampled background (Sal), glow (fire arrow), erase-shadow (port, vault). Writes hashed WebPs to `src/assets/art/`, a generated `artManifest.ts`, and a contact sheet for review.
- Generalise `stitchArt.ts`; a Settings toggle for the art mode next to game mode. Tests: every manifest id has a file; each file at most 60 KB; total at most 1.2 MB; unknown or missing id falls back to SVG.
- Real S13 replaces the stand-in `sal-counter` and its `FIXES` entry is deleted. Retire docs and old folders (Part 9).

**Sprint 1: Tower kit (L), the main event.**
- Spike first (go/no-go, half a sprint): render three towers per weather on the real layout; judge baked pennants, scale and weather grade.
- `towerArt(tower)` pure function (`lib/towerArt.ts`, tested): structure, size class and wall to an art id. `unsurveyed` never returns a picture; the tower count in the resource bar still equals the towers drawn.
- Art replaces the body in `Keep()` only; per-image anchors (crown, door, window rows, ground line) place the overlays.
- Code, restyled to the new look (ink outline `#26253B`, flat cel): lit windows and torch glow when fresh, banner, crack, ivy, scaffolding, thesis marks, ladders, drawbridge, moat, name plate, raven perch. Weather grade per `worldPalette`.
- Tests: selection table for all 7 walls x 5 size classes; unsurveyed; fresh versus stale produce different overlays but the same picture.
- Cut line: the weather grade polish.

**Sprint 2: Structures, Great Keep, walls (M).**
- Outpost, granary, gold store (vault-1/2/3 by size class), shack in the Shantytown, Great Keep (`keep-granite`) with the realm-verdict banner as a code overlay and the "THE REALM" plate unchanged.
- Curtain wall and corner bastion stay code, restyled to the new palette, until the Stitch pieces exist (Part 8, batch 1); this keeps the scene coherent in the meantime.
- Cut line: gold store fullness variants (use one vault).

**Sprint 3: Siege camp and scene life (M).**
- Camp built from the sprites by the existing `siegeCamp()` counts (3 tents and 7 soldiers when gathering; 7 tents, 20 soldiers, 3 engines, 5 arrows when besieged); nothing in calm or unsurveyed weather. Engines are one trebuchet, one ram, one siege tower. Fire arrows use the glow cut.
- Terrace life uses pines, palms, rocks; the raven art replaces `RavenMark` (same "new report" meaning, same position); lamp art for `MagicLamp`.
- Static; no new looping motion; reduced motion unchanged.
- Cut line: raven and lamp swap.

**Sprint 4: Map (M).**
- Settlement art by decision 5; the Great Keep art at the capital; props (pine, palm, rocks, ship) replace glyphs; bridge on roads where one crosses a province edge; port and island as landmarks. Fog patches and the five survey patches stay code, drawn over the picture, so unknown stays fog.
- Scale follows the existing `spriteScale(weight)`; unknown weight draws at the middle size.
- Cut line: bridges.

**Sprint 5: Marketplace and Sal (M).**
- Stalls per decision 6; Sal strip and empty street use the real art (Phase A slots stay); vault in the marketplace as the reserve.
- Sal busts in the Sal and Hype dialogs by mood (pitch, oops, think; cheer stays SVG until generated). The store shopkeeper stays SVG until its faces exist.
- Cut line: stalls (Sal first).

**Sprint 6: Second Stitch batch, then wire (M, depends on you).**
Generate Part 8 batch 1 (wall segment, corner bastion, genie, terrace props) and batch 2 (map pieces, Oracle, Partner, Sal cheer, shopkeeper faces); I pack and wire them. Closes groups A, C, D and E.

**Sprint 7: Default and hardening (S-M).**
Look at Sprints 1-5 on real data, dark and light, desktop and phone; then decide whether `?art=stitch` becomes the default. Phone performance at 4x CPU throttle, colour-blind pass, reduced motion, screenshots for the look-and-judge list. Update section 4 of the visual-identity standard (look changed: object pictures are default).

## 7. Game sprint checklist, section A

1. **Pages touched:** Fortress (scene, Great Keep, siege camp, ravens, lamp), Map (Cartographer), Marketplace and Store, Sal and Hype dialogs. Chronicle, Council, Records, Circle, Siege Simulator, Night Watch are not touched.
2. **Identity before to after (all inferred from code, none re-scored with screenshots; the standard's "today" line is out of date):** Fortress 3 to 3 (new look, same facts); Map 2 to 2 (settlements become objects; Map was 1 in the 2026-10-09 audit before #90-#93); Marketplace and Store 3 to 3 (audit score; the stalls change look); Sal and Hype dialogs unscored, unchanged in structure. No touched page falls below 2. **Debt (untouched):** Council, Records, Circle, Chronicle and Siege Simulator all had identity work in #91-#93 and #98 but have not been re-scored with screenshots; that is the first step of Sprint 7.
3. **Visual win:** the tower kit. Visual verb "raise" and scene "a fortress of towers": each holding is a distinct picture whose wall material, size, light, crack and fog are the facts. Deletes no words (none are added).
4. **Visual verb + scene per sprint:** S1 raise (the towers), S2 gather (the great keep and its outbuildings), S3 gather and march (the siege on the hills), S4 chart (settlements on the continent), S5 trade (the street and Sal).
5. **Words:** no added words; picture alt text is empty because the page already states each fact; word budgets unchanged.
6. **Kit:** reuses `ObjectArtImage`, `stitchArt`; adds `towerArt`, an art manifest and overlay anchors (owner: game-feel-engineer).
7. **Cut line:** per sprint above; never the SVG fallback, the unknown state or the screenshots.
8. **Rules:** truth (no baked state, `unsurveyed` always code, fog over the picture); colour-blind (state colours and shapes unchanged, teal and moss never status); reduced motion (no new loops); performance (about 400 KB of art for a full Fortress, lazy where off-screen, tested at 4x throttle).

## 8. What is missing (generate in Stitch; prompts in the master doc, Part 6)

Same shared block as before (white background, no text, no shadow, outline `#26253B`, teal and timber palette; attach tower 37 as the style reference).

- **Batch 1 (needed to finish the Fortress):** curtain wall segment (3:1, tiles horizontally, granite), corner bastion (round, wall stub each side), genie (happy, wow, sorry), well, haystack, bush or flower tuft.
- **Batch 2 (map and people):** mountain range (snow cap and bare), hill, sea serpent, compass rose (no letters), planted flag (plain), Oracle and Partner busts, Sal "cheer", five store shopkeeper faces (ready, promising, wait, pass, unknown).
- **Only if decisions go that way:** flagless towers and keep (decision 3), awning-less stalls (decision 6), ivy cluster, scaffolding frame, ladder, torch as sprites to replace restyled code overlays.
- **Optional room objects:** group F in Part 3, only if you want rooms converted (decision 9).

## 9. Documentation changes made with this plan

- New: this plan (repo `docs/` and Claude project).
- Rewritten: `stitch-master-object-art-2026-10-11.md` is now the style and rules reference plus prompts for the missing objects only. Its old catalogue of 10 images, the Phase A build story and the prompts for objects that now exist are removed.
- Retired and removed (superseded by the Stitch Master direction; lessons kept in the rewritten master doc): `stitch-art-prompts-2026-10-09.md` (the painted-gouache prompt library), `art-pack-trial-2026-10-10.md` (dropped trial, merged and reverted), `stitch-handoff-2026-10-10.md` (brief for the painted look; its hard rules and review checklist are already in the standards and in the master doc).
- Kept: `stitch-design-pass-2026-10-10.md` (component skin, still current; its status line is corrected: #97, #98, #99, #100 are merged).
- `progress.md` and `docs/PROGRESS.md` corrected: #93, #97-#101 are merged on `main` (git log, 2026-10-11); deploy not verified. Finished items moved to the archive.
- The visual-identity standard's art addendum gets one line pointing at this plan.
