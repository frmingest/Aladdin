# Design Master: review and sprint plan (2026-10-11)

Status: **approved by Faiz 2026-10-11 (all nine decisions, Part 5). Sprint 0 is merged (#103); Sprint 1 is merged (#104); Sprint 2 is merged (#105); Sprint 3 is merged (#106); Sprint 4 is merged (#107); Sprint 5 is merged (#108); Sprint 6 is merged (#109, deploy not verified); Sprint 7 is next. Sprints 8 to 13 (the rooms: Council, Records, Circle, Chronicle, Map table, and the shared crests) are proposed on Faiz's request of 2026-10-11, waiting for his OK on decisions 10 to 13 (Part 5) and for the Stitch sets (Part 8, batches 3 to 8).** Written from a fresh clone of `main` (`e939577`, PR #101 merged), all 52 object images and 10 screen mocks in `frontend/public/art/Design_master`, the Stitch `DESIGN.md`, and a read of the scene, map and marketplace code. `E:\Aladdin` is stale (branch `feature/currency-edit-and-nok-equivalent`, older than `main`); pull `main` before any build.

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
| F Room objects (proposed, Sprints 8 to 13) | 40 | 0 | 0 | 40 | shared 9 (crests x5, wax seal intact and broken, quill and inkwell, candle stand); Council 5 (table, two chairs, agenda scroll, gavel); Records 7 (casket, bookshelf, three tomes, lectern, pigeonholes); Circle 7 (standing stone x2, brazier, lantern post, signpost, telescope, fog stake); Chronicle 7 (hourglass, strata block, sundial, book on stand, sconce, weathervane, cairn); Map table 5 (frame corner, dividers, rolled map, pin, wave tile); plus 5 optional room backdrops |

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

## 5. Decisions (Faiz, 2026-10-11)

**Answers:** 1 OK. 2 OK (size class). 3 Accepted: baked pennants stay (the Sprint 1 spike still checks scale and weather, not pennants). 4 OK (keep variants unused). 5 Yes (map markers by structure plus weight band). 6 Keep the teal stalls for now. 7 OK (opt-in until Sprint 7). 8 Yes (delete retired folders and docs). 9 Yes for now; Faiz will generate more design later. The text below is the original proposal.

1. **Order and scope** of Sprints 0-7 (Part 6).
2. **Silhouette rule:** spire for `great` and `medium` size classes, bastion for `small`, `tiny`, `unknown`. Size class is already a fact the tower shows by size, so it adds no new meaning. Alternative: by structure type. *Recommended: size class.*
3. **Baked pennants:** accept the plain teal pennants as decoration, with freshness shown only by code light and banner; decide after the Sprint 1 spike on real towers whether to ask Stitch for flagless versions. *Recommended: accept, spike first.*
4. **Great Keep material variants** (basalt, brick, timber, rotted keeps): no slot, because the keep is one structure whose banner shows the realm verdict; a material would invent a meaning. *Recommended: do not use; keep in the masters.*
5. **Map markers:** by structure plus weight band: heavy stock keep = citadel, other stock = town, fund = outpost, gold = vault, cash/bond = granary. Port and island become scenery landmarks (coast and islet), not holdings. *Recommended: yes.*
6. **Marketplace stalls:** (a) use the four teal stalls as is, tone shown by the plate edge and tag word (colour was never the only signal); or (b) ask Stitch for awning-less stalls so the code awning keeps showing the tone. Which stall a company gets: stable hash of its id, labelled decoration. *Recommended: (a) now, (b) only if the street loses its at-a-glance tone.*
7. **Default:** art stays opt-in (`?art=stitch`, plus a Settings toggle added in Sprint 0) until you have seen Sprints 1-5 on real data; flipping the default is Sprint 7. SVG stays as the fallback permanently.
8. **Cleanup:** delete the retired folders `stitch_master` and `new` from `frontend/public/art`, and the retired docs in Part 9. *Recommended: yes; I will ask once more for the delete permission when I get there.*
9. **Other rooms:** do not convert Council, Records, Chronicle, Circle, Night Watch to art unless you want it; they already score 2-3 and the pictures would be a second visual language there. *Recommended: no.*

**Decisions 10 to 13 (proposed 2026-10-11, Faiz asked to extend the plan to the other rooms; each needs his OK).**

10. **Decision 9 is superseded for the rooms.** Council, Records, Circle, Chronicle and the Map table get object art in the same Stitch Master look, because the 2026-10-09 audit scored Council 1, Records 1, Circle 0 and Chronicle 2 (Map 2 after Sprints 4 to 6), and the standard says a page below 2 is a review blocker. Night Watch, Siege Simulator and the Fortress ledger are not in scope. *Recommended: yes.*
11. **Order.** Sprint 7 (default and hardening) stays where it is; Sprints 8 to 13 follow it. Alternative: do 8 to 10 first and flip the default once, after seeing every room. *Recommended: Sprint 7 first, but the default flip waits until after Sprint 9 if you prefer one look at everything.*
12. **Red wax seals are the one new red.** The seal pair (intact and broken) is a small red object; the shape (whole or cracked) carries the meaning and the page keeps its existing label, so colour is never the only signal. Everything else stays in the object palette. *Recommended: yes.*
13. **Room backdrops are optional and not keyed.** One wide scene per room (about 100 KB WebP, lazy) behind the banner, from a new pack mode `none`. If Stitch's wide crops look off, the banner is crest plus the page's own colour. *Recommended: try Council and Records first, drop the rest if they disappoint.*

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

**Sprint 1 result (2026-10-11, written, not deployed).**
- Spike (go): three weathers plus calm, ten towers across every wall and size, on the real layout. The grade sits the pictures in storm and siege skies. Baked pennants do not fight freshness because the lit windows and door glow carry it; the code banner is dropped in art mode (two flags on one roof clash).
- `lib/towerArt.ts`: `towerArtId()` (spire for great and medium, bastion for small, tiny and unknown; `not_applicable` uses granite; `unsurveyed` and non-keeps return null) and `placeTowerArt()` (picture sized from the layout box, never wider than the box plus 14 px; ground line, body box, door and window points in scene px). Anchors are measured once per pose in master pixels in `manifest.json` (`anchors_px`) and packed as fractions of each crop. Rotted pictures have no window anchors (nothing to light).
- `Keep()` itself is untouched; `TowerFigure` swaps the body and hands the old overlays the picture's body box. Overlays restyled for art mode only (ink `#26253B`, palette moss and timber): crack, breach, ivy, scaffolding, ladders, drawbridge. `worldPalette().grade` is a CSS filter per weather.
- Not done, by design: window and torch glow is not graded (it is light, not paint); outposts, granaries and gold stores wait for Sprint 2; the SVG body is the fallback if a picture fails to load.

**Sprint 2: Structures, Great Keep, walls (M).**
- Outpost, granary, gold store (vault-1/2/3 by size class), shack in the Shantytown, Great Keep (`keep-granite`) with the realm-verdict banner as a code overlay and the "THE REALM" plate unchanged.
- Curtain wall and corner bastion stay code, restyled to the new palette, until the Stitch pieces exist (Part 8, batch 1); this keeps the scene coherent in the meantime.
- Cut line: gold store fullness variants (use one vault).

**Sprint 2 result (2026-10-11, written, not deployed).**
- `towerArtId()` now returns a picture for every structure: fund = `outpost`, cash-like fund = `granary`, gold store = `vault-3` (great), `vault-2` (medium), `vault-1` (small, tiny, unknown); keeps as in Sprint 1. `placeTowerArt()` sizes the low structures from the layout box with a per-picture height factor, stands them on the ground line and never wider than the box plus 14 px. Anchors (body box, door) for outpost, granary, the three vaults and `keep-granite` are new in `manifest.json` (`anchors_frac`, measured on the packed picture) and mirrored in `artManifest.ts`; `pack.py` passes them through.
- The old overlays (ivy, scaffolding, crack, thesis marks, ladders, drawbridge) take the picture's body box, as for keeps. Door glow follows freshness; torches stay on keeps and the Great Keep only. The code pennant on a fresh outpost is dropped in art mode (the picture has its own).
- Great Keep: `placeGreatKeep()` (236 px wide, centred on the keep box, standing on its ground). The picture carries no fact: the realm verdict is a flag on a pole in the forecourt (`TONE_BANNER`), the "THE REALM" plate and click target are unchanged, door glow and torches follow "any tower fresh". Weather grade applies to it.
- Shantytown: the shack picture replaces the code shacks (height varies by index, smoke on heavy), one picture for many shacks.
- Not done, by design: curtain wall and corner bastions stay code (Sprint 6, Stitch batch 1); gold store fullness variants beyond the three size classes.
- Window light (Faiz, 2026-10-11, towers were far too lit): the glow and pane drawn over keeps are now 20% of the old light (`WINDOW_LIGHT`). How many windows are lit follows freshness: fresh 3-5 of 5, weathered 1-2, others none; which ones is a stable hash of the holding id (`litWindows()`), so a tower never changes between loads and fresh always shows more than weathered. Door glow and torches are unchanged.
- Limits of this check: tests, tsc and lint pass; the scene was not rendered in a browser in this session, so placement of the verdict flag, door glow and vault height needs Faiz's eye on real data. Anchors were measured by eye on the packed pictures and may need a nudge.

**Sprint 3: Siege camp and scene life (M).**
- Camp built from the sprites by the existing `siegeCamp()` counts (3 tents and 7 soldiers when gathering; 7 tents, 20 soldiers, 3 engines, 5 arrows when besieged); nothing in calm or unsurveyed weather. Engines are one trebuchet, one ram, one siege tower. Fire arrows use the glow cut.
- Terrace life uses pines, palms, rocks; the raven art replaces `RavenMark` (same "new report" meaning, same position); lamp art for `MagicLamp`.
- Static; no new looping motion; reduced motion unchanged.
- Cut line: raven and lamp swap.

**Sprint 3 result (2026-10-11, written, not deployed).**
- `lib/sceneArt.ts` (tested): `siegeCampSprites()` places tents, soldiers and the three engines from the same `siegeCamp()` counts as the code camp (calm and unsurveyed draw nothing; gathering 3 tents and 7 soldiers; besieged 7, 20, 3 engines, 5 arrows). `fireArrowSprites()` lands each arrow on its target, rotated along the last stretch of the dotted arc. `ravenSprite()` perches the raven. All pictures keep their proportions and stand on a ground line.
- `sceneWorld.tsx`: in art mode the camp uses the pictures, graded per weather like the towers (the fire arrows are light and not graded; the dotted arcs stay code). Terrace pines at the edges, the round trees on the lower terraces and the scattered stones use `prop-pines` and `prop-rocks`. One failed picture turns its whole group back to the SVG. `RavenMark` swaps its drawing for the raven picture; position, bob and the "new report" meaning are unchanged.
- Fix (Faiz, 2026-10-11, towers looked as if on pikes): the cause was the code drawbridge, a narrow dark plank under each picture tower. In art mode it is now a stone causeway that widens towards the viewer (wider and longer for a wide moat); the SVG drawbridge is unchanged.
- Not done, by design: the lamp swap (the cut line; `MagicLamp` stays SVG), palms (a tropical prop in a northern realm; kept for the map), well and hay (no art until Stitch batch 1). Anchors and sizes were set by eye; the scene was not rendered in a browser in this session, so camp scale on the far hills and the causeway width need Faiz's eye on real data.

**Sprint 4: Map (M).**
- Settlement art by decision 5; the Great Keep art at the capital; props (pine, palm, rocks, ship) replace glyphs; bridge on roads where one crosses a province edge; port and island as landmarks. Fog patches and the five survey patches stay code, drawn over the picture, so unknown stays fog.
- Scale follows the existing `spriteScale(weight)`; unknown weight draws at the middle size.
- Cut line: bridges.

**Sprint 4 result (2026-10-11, written, not deployed).**
- `lib/mapArt.ts` (tested): `settlementArtId()` follows decision 5. A great stock is `map-citadel`, any other stock `map-town`, a fund `outpost`, a cash-like fund `granary`, gold a vault (`vault-1/2/3` by size class, as on the Fortress). The weight band is the existing size class, so no new threshold was invented; unknown size is a plain town. `placeSettlementArt()` fits each picture inside the old tower box (same centre, same bottom edge), so the survey patches land where they always did. `placeMapKeep()`, the scenery rectangles and `placeLandmarks()` are pure and deterministic.
- Map (`WorldMap.tsx`), only with the Settings "Object art" switch on: each settlement shows its picture under the five survey patches, which stay code and are drawn over it, so unknown stays fog (`TowerFigure` takes an optional `body`). The Great Keep at the capital is `keep-granite` (the code banner and flames are dropped, the commission flag moves over the roof). Forests use `prop-pines`, low hills `prop-rocks`, ships `prop-ship` (sailing and resting). The port (`map-port`) stands on the mainland shore furthest from every settlement, the island sanctuary (`map-island`) on the first islet, and each other islet gets a `prop-palms`. Landmarks are scenery: no name, no button, no fog, so none reads as a holding.
- A picture that fails to load turns every use of that id back into the SVG. Art off (the default) renders as before (tested). `CartographerPage` now passes what each holding is (`kinds`, from structure and size class); the survey, labels, buttons and keyboard are untouched.
- Not done, by design: bridges (the cut line). Mountains, serpent and compass stay code until Stitch batch 2 exists. Hills use the rocks picture as the plan said; they may read as boulders.
- Checks: all lib tests (562) and component and page tests (57) pass, eslint has 0 errors (2 old warnings), `vite build` succeeds (built into a scratch folder, because this shell cannot delete `frontend/dist`). `tsc` is clean except the missing Node types for `artAssets.test.ts`, an environment gap in this shell (that file is untouched). The backend is untouched, so ruff and pytest were not run. The map was not rendered in a browser in this session: settlement, keep, port and rock sizes and the keep flag position were set by eye and need Faiz's eye on real data.

**Sprint 5: Marketplace and Sal (M).**
- Stalls per decision 6; Sal strip and empty street use the real art (Phase A slots stay); vault in the marketplace as the reserve.
- Sal busts in the Sal and Hype dialogs by mood (pitch, oops, think; cheer stays SVG until generated). The store shopkeeper stays SVG until its faces exist.
- Cut line: stalls (Sal first).

**Sprint 5 result (2026-10-11, written, not deployed).**
- `lib/marketArt.ts` (tested): `stallArtId()` gives each company one of the four stalls by a stable hash of its holding id (decoration, labelled as such); `salBustId()` maps pitch, oops and think to their busts and cheer to none.
- Marketplace street, art mode only: the stall picture replaces the striped awning on each plate; the store's tone stays in a 4 px top edge on the plate (`--stall-tone`) and the printed tag, per decision 6a. Sal's strip and the empty street were already art (Phase A). `SalPortrait` swaps the SVG Sal for the bust in the Sal and Hype dialogs; the SVG is the fallback (art off, cheer, failed load).
- Not done, by design: the vault as a reserve (no slot exists on the Marketplace today), the store shopkeeper (SVG until its faces exist), Sal cheer (M14).
- Checks: new unit and render tests, eslint (0 errors) and `tsc` (only the old `artAssets.test.ts` Node-types gap) pass. Not rendered in a browser; stall size and the tone edge need Faiz's eye.

**Sprint 6: Second Stitch batch, then wire (M, depends on you).**
Generate Part 8 batch 1 (wall segment, corner bastion, genie, terrace props) and batch 2 (map pieces, Oracle, Partner, Sal cheer, shopkeeper faces); I pack and wire them. Closes groups A, C, D and E.

**Sprint 6 result (2026-10-11, written, not deployed).**
- Packed (22 new ids, `manifest.json` and `artManifest.ts`; the 42 earlier pictures repack byte-identical): `wall-segment`, `corner-bastion`, `genie-happy|wow|sorry`, `prop-well`, `prop-haystack`, `prop-bush`, `map-mountain-snow-a|b`, `map-mountain-bare-a|b`, `map-hill`, `map-serpent`, `map-compass`, `bust-oracle`, `bust-partner`, `sal-cheer`, `shopkeeper-promising|wait|pass|unknown`. 1.65 MB for all 64 pictures (budget test raised from 1.2 to 1.7 MB; pictures load only where a view uses them). `pack.py` gained `"enclosed": false` (keeps the genie's white cloud solid) and the bust faces use a tighter sampled-background tolerance (9) so white sleeves are not keyed out.
- Fortress: the curtain wall is the wall-segment tiled along each row (two pixels trimmed per tile, no seam), the corner bastions are the new picture (the right one mirrored), both graded per weather like the towers. Terraces: well and three haystacks as pictures; bushes among the rocks. `SharedWalls` (the cracked links between towers), moat and causeway stay code.
- The Genie (`GenieFigure`) is the picture for its mood; the Oracle and Partner busts are round ringed avatars (`Portrait`, Council and Hype Booth); Sal's cheer bust completes his four moods; the store shopkeeper has four faces: wait = chin on hand, promising = level gaze, pass = raised hand, unknown = shrug. Faces are the merchant's mood, never the tone colour; the verdict stays in the words beside it.
- Cartographer: mountains (two bare, two snow-capped, chosen by the glyph's own number), a grassy mound for about 60% of the hills (rocks for the rest), the sea serpent and the compass rose (the "N" is still drawn by code, the picture has no letters). The commission flags (`FlagMark`) are data and stay code.
- Not done, by design: the shopkeeper "ready" face (the four faces were generated without a smiling one; "ready" keeps the SVG merchant), the planted flag (no slot: the only map flags are the commission flags; its master is kept in `art-masters`, not packed), mountain variants 6 and 20 (kept in the masters), the Council table and other room objects (decision 9), lamp swap.
- Checks: vitest (631 tests), `tsc`, eslint (0 errors) and `vite build` pass; `ruff check` passes (backend untouched, `pytest` not run). Rendered in headless Chromium on a 12-tower fixture (calm weather, both rows) and a 12-settlement map: wall tiling, bastions, terraces, busts, Genie and map pieces all show. Besieged and light-theme renders, a phone width and real data were not checked: placement of the bastions and the wall's tone against real weather need Faiz's eye.
- Review for Faiz: the shopkeeper set shows a different man from the stocky first image (9); I used the four bearded faces, which match each other. If you would rather have the stocky one for "ready", it is a one-line change in `marketArt.ts`.

**Sprint 7: Default and hardening (S-M).**
Look at Sprints 1-5 on real data, dark and light, desktop and phone; then decide whether `?art=stitch` becomes the default. Phone performance at 4x CPU throttle, colour-blind pass, reduced motion, screenshots for the look-and-judge list. Update section 4 of the visual-identity standard (look changed: object pictures are default).

### Sprints 8 to 13: the rooms (proposed, not started)

Same rules as Sprints 1 to 6: one branch and one PR per sprint off fresh `main`, behind the Settings "Object art" switch, SVG (or today's plain layout) always the fallback, the Plain view unchanged, no new words, no new looping motion, never merged by me, "written, not yet deployed" until verified. Pictures are objects; every fact (seal state, ring, fog, gap day, due date, warning) is decided by code and drawn on top. Prompts for every picture are in the master doc, Part 6b. Each sprint ends with a side-by-side screenshot of the room next to the Fortress, and the room's identity score re-checked against the standard (target 3, never below 2).

**Sprint 8: Crests, banner and seals (S-M, the foundation for the rooms).**
- Needs: crest set (5), wax seal pair, quill and inkwell, candle stand (Part 6b, "Shared").
- Pack: add the nine ids to `manifest.json`; add pack mode `none` (opaque, for backdrops) and a backdrop budget (each at most 120 KB, five at most) to `check_image_sizes.py` and `artAssets.test.ts`.
- Code: `lib/roomArt.ts` (pure, tested): `roomCrestId(room)` and `sealId(state)` (whole or broken). `PageHeader` game branch: a 56 to 80 px banner strip with the room's crest, decorative, same words as today. `FortressTabs`: crest per tab and a lozenge active state, `aria-current` kept (shape and `aria-current`, not colour alone). Export `Corner` from `GameFrame` for banners.
- Cut line: the tab strip crests.

**Sprint 8 result (2026-10-11, written, not deployed; the room objects Faiz generated so far, not the crests).**
- The first room-art set that arrived (`frontend/public/art/latest`, 25 pictures) holds no crests, wax seals, quill, candle stand, table, chairs, scroll, gavel, standing stones, brazier, lantern, telescope or fog stake, so those slots stay on their SVG (see "Still missing" in the Sprint 13 result). Records, Chronicle and Map table objects and two backdrops did arrive, so Sprint 8 ships the kit those rooms need.
- `pack.py` gained key mode `none` (opaque, no crop) for backdrops; `backdrop-records` and `backdrop-chronicle` are packed at 960 px wide (37 and 43 KB). `artAssets.test.ts` allows a backdrop up to 120 KB, at most five, and the total is 2000 KB (was 1700).
- `lib/roomArt.ts` (tested): `roomBackdropId()`, `roomCrestId()`, `sealId()`; each returns null unless the picture is really packed, so a missing crest or seal never becomes a broken image. `RoomBackdrop` sits behind the banner (`GamePageHeader`), art mode only, lazy, empty alt text, with a dark wash so the title and the Plain view button stay readable; a failed load removes it. Records and Chronicle wear one.
- `FortressTabs`: the open room carries a small lozenge as well as the colour (`aria-current` was already set by the router). `GameFrame` exports `Corner` for the Map table frame (Sprint 13).
- Not done: crest per tab and crest in the banner (no crest pictures yet).
- Checks: tsc and eslint (0 errors) pass; vitest: all 633 tests pass except the local-only guard that no image over 150 KB sits in `frontend/public/` (the untracked masters in `public/art` trip it; CI has no such folder). Not rendered in a browser: banner wash strength and backdrop crop need Faiz's eye.

**Sprint 9: Council (M).** Visual verb "convene", scene "a round table under candlelight".
- Needs: table, two chairs, agenda scroll, gavel (Part 6b).
- Code: the two advisors seated at the table (the Oracle and Partner busts already exist), agenda items on parchment (`.scroll-paper`) with a seal per item: whole seal for a note, broken seal plus the existing label pill for a warning; candle flames drawn by code, constant. Stagger-in only without reduced motion.
- Truth: item order, tone and text come from the existing rules; the table and chairs carry nothing; no new words.
- Cut line: gavel and backdrop.

**Sprint 10: Records (M).** Visual verb "seal", scene "the archive".
- Needs: casket, bookshelf, tomes (3), lectern, pigeonholes (Part 6b).
- Code: each entry stays one row in the existing list (Plain view); a time capsule is a casket with a whole seal, drawn broken when its review is due or open, plus today's label. The bookshelf and lectern frame the header. Keeps the caption "a decision is not its outcome"; no streaks or rewards.
- Cut line: pigeonholes and lectern.

**Sprint 10 result (2026-10-11, written, not deployed).**
- Packed (4 new ids; the earlier pictures repack byte-identical): `casket-closed`, `casket-open`, `room-bookshelf`, `room-lectern` (63 KB together). The pigeonholes, the three tomes and the lectern-free tome stack are kept in the masters, not packed (the cut line; the Hall already draws its own tomes, one per record, because each tome carries the action letter and the owed ribbon).
- `lib/roomArt.ts`: `capsuleArt(state)` (sealed = closed casket, owed = closed casket plus a cracked seal that code draws, written = open casket) and `roomPropIds(room)`. Tested: the three states differ by picture or seal, and every id is packed.
- Hall of Records, art mode only: each review line (month 6 and month 12 in the reading desk) shows the casket instead of the small wax seal; the printed label ("Month 6: sealed until it is due", "unsealed, review owed", "opened, review written") is unchanged, so the state is shape plus words, never colour alone. The bookshelf and lectern stand in the banner between the title and the buttons (`RoomProps`, hidden on phones). The tomes, shelf, desk, Plain view, the caption "a decision is not its outcome" and every figure are untouched; no streak, no reward.
- Not done, by design: pigeonholes and the lectern as a reading desk (cut line), the tome pictures.
- Checks: tsc (only the known `artAssets.test.ts` Node-types gap), eslint (0 errors) and the room, hall and kit tests pass. Not rendered in a browser: casket size beside the label and the banner props need Faiz's eye.

**Sprint 11: Circle (M).** Visual verb "draw", scene "a clearing in a ring of stones".
- Needs: standing stones (2), brazier, lantern post, signpost, telescope, fog stake (Part 6b).
- Code: concentric rings drawn by code (know, partly, outside); a tower pin sits in the ring its status says, size from its real weight; unclassified towers sit outside the stones in dashed fog with stakes. Standing stones mark the ring edges, the brazier is the constant centre. The existing list stays as the accessible table; `role="img"` summary from `data.summary`.
- Truth: unknown stays outside and dashed, never inside by default; ring position, shape and label carry the status, not colour.
- Cut line: telescope, signpost, lantern.

**Sprint 12: Chronicle (M).** Visual verb "layer", scene "a wall of strata".
- Needs: strata block, hourglass, sundial, chronicle book, sconce, weathervane, cairn (Part 6b).
- Code: the existing time-strata spine drawn with the strata block; the hourglass in the banner; a dark sconce marks each day the worker was off ("what the record cannot show"), a gap is never drawn as an ordinary day. Weather stays code (`worldPalette`) from the stored siege level; no weather pictures.
- Cut line: sundial, weathervane, cairn.

**Sprint 13: Map table (S-M).** Visual verb "survey", scene "the cartographer's table".
- Needs: frame corner, dividers, rolled map, pin, wave tile (Part 6b).
- Code: a brass frame (corner mirrored four times), dividers and the rolled map beside the legend; wave tile on open water. Settlements, fog patches, commission flags and the keep are unchanged (Sprints 4 and 6).
- Cut line: pin and wave tile.

**Section A for Sprints 8 to 13 (checklist answers, targets inferred from code, none re-scored with screenshots).**
1. Pages touched: every room header and tab strip (S8); Council (S9); Records (S10); Circle (S11); Chronicle (S12); Map table (S13). Not touched: Siege Simulator, Night Watch, Ledger.
2. Identity before to after (target): Council 1 to 3, Records 1 to 3, Circle 0 to 3, Chronicle 2 to 3, Map 2 to 3, tab strip 0 to 2. No touched page ends below 2.
3. Visual win per sprint: S8 a crest for every room; S9 a table with two chairs; S10 a sealed casket; S11 the circle actually drawn; S12 strata and the dark sconce for a gap; S13 the table frame.
4. Visual verbs: convene, seal, draw, layer, survey.
5. Words: no added words; alt text empty; word budgets unchanged.
6. Kit: `roomArt.ts`, `PageHeader` banner, `Corner` export; owner game-feel-engineer.
7. Cut lines: per sprint; never the Plain view, the SVG or plain fallback, the unknown state or the screenshots.
8. Rules: truth (seals, rings, fog and gaps are code), colour-blind (shape plus label), reduced motion, phone performance (lazy backdrops, each at most 120 KB).

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

**Rooms (Sprints 8 to 13, proposed):** batches 3 to 8 in the master doc, Part 6b: shared crests and seals first (batch 3), then Council, Records, Circle, Chronicle, Map table (batches 4 to 8). Order by priority: the starred items in each batch.

## 9. Documentation changes made with this plan

- New: this plan (repo `docs/` and Claude project).
- Rewritten: `stitch-master-object-art-2026-10-11.md` is now the style and rules reference plus prompts for the missing objects only. Its old catalogue of 10 images, the Phase A build story and the prompts for objects that now exist are removed.
- Retired and removed (superseded by the Stitch Master direction; lessons kept in the rewritten master doc): `stitch-art-prompts-2026-10-09.md` (the painted-gouache prompt library), `art-pack-trial-2026-10-10.md` (dropped trial, merged and reverted), `stitch-handoff-2026-10-10.md` (brief for the painted look; its hard rules and review checklist are already in the standards and in the master doc).
- Kept: `stitch-design-pass-2026-10-10.md` (component skin, still current; its status line is corrected: #97, #98, #99, #100 are merged).
- `progress.md` and `docs/PROGRESS.md` corrected: #93, #97-#101 are merged on `main` (git log, 2026-10-11); deploy not verified. Finished items moved to the archive.
- The visual-identity standard's art addendum gets one line pointing at this plan.
- 2026-10-11 (rooms): Part 5 decisions 10 to 13, Sprints 8 to 13, Section A for them and the group F slot register are new; the Stitch prompts live in the master doc, Part 6b.
