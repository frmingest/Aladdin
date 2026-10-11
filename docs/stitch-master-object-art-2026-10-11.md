# Stitch Master object art: feasibility, catalogue and prompt pack (2026-10-11)

Status: **research and planning only. Nothing is built into the app.** Written from the folder `frontend/public/art/stitch_master` (untracked on Faiz's machine) and a read of the current scene code. The local checkout `E:\Aladdin` is stale (branch `feature/currency-edit-and-nok-equivalent`, older than `main`), so the Map/Cartographer and `kit/` code was not available to read; map conclusions come from the hand-off doc and the Stitch screens, and must be re-checked against fresh `main` before building.

Related: [stitch-handoff-2026-10-10.md](stitch-handoff-2026-10-10.md) (earlier brief and lessons), [art-pack-trial-2026-10-10.md](art-pack-trial-2026-10-10.md) (the painted-art trial that was merged and reverted), [stitch-art-prompts-2026-10-09.md](stitch-art-prompts-2026-10-09.md) (the old painted-style prompts, now superseded for objects by Part 6 below).

---

## 1. Verdict

**Yes, the new objects can replace the current ones, but not all with the same ease.**

| Area | Ease | Why |
|---|---|---|
| Marketplace booths, Sal's counter, vault booth (3 images) | **Smaller than first thought** | Corrected 2026-10-11 after reading `main`: the street shows one stall per watchlist company and the stall awning colour is the verdict tone (data), the store-page shopkeeper's mood is the verdict level (data). Those stay SVG. Safe slots: Sal's strip and the empty street. The vault has no slot on the street; it belongs to the Gold store tower (Phase C). |
| Map settlement markers (5 images) | **Easy to medium** | Fixed objects. Fog must stay a code overlay (fog is data). Re-check against the real map code on `main`. |
| Tower bodies on Fortress | **Medium** | Today every tower is drawn by code from live data (size, wall material, freshness, structure, cracks). One picture cannot carry that; it needs a small kit of pictures plus the existing code overlays. |
| Great Keep / curtain wall | **Medium** | Gate-wall and citadel art fit, but the keep has clickable realm parts; read `GreatKeep` first. |
| Sky, ground, water, weather, moat, fog, drawbridge, siege camp counts | **Keep as code** | These carry real facts (siege level, moat rating, unsurveyed). Stitch art is only for objects. |

Recommended path: Phase A (booths) first, behind a switch, then Phase B (map markers), then Phase C (tower kit). The prompt pack in Part 6 makes the missing pieces in the same style.

**Three things need Faiz's decision before building** (Part 4): the palette change (teal, blue-slate, bright light), whether the Stitch screen designs are adopted or only the objects, and whether Sal's red/cream awning stays.

---

## 2. What is in the folder

All 10 object images are **1024 x 1024 PNG, opaque, plain white background**, 0.75-1.15 MB each. 55-80% of each canvas is empty white. None is transparent.

| # | Folder (shortened) | What it shows | Natural role in the app |
|---|---|---|---|
| 1 | `..watchtower_with_conical_teal_roof..` | Tall round stone tower, scaled teal roof, wooden balcony, red hanging banner, 5 lit windows, wooden door, weathervane flag | **Spire tower** (Keep body, tall) |
| 2 | `..low_defensive_stone_rampart_bastion..` | Squat round bastion, teal crenellations, outer low wall with door, flag with a star | **Bastion tower** (Keep body, wide) |
| 3 | `..castle_central_fortress_wall..` | Wide stone gatehouse: portcullis, iron-bound double doors, two corner towers, flag with emblem, down-arrows on the merlons (AI artefact) | **Great Keep gate / curtain wall** |
| 4 | `..stone_mountain_citadel..` | Terraced rock citadel with village, teal banners, big iron gate | **Map marker: stronghold / big province**; possible Great Keep |
| 5 | `..settlement_town_castle_fortress..` | Walled town isometric, thatched inn, teal cone tower, wooden lookout | **Map marker: town / walled settlement** |
| 6 | `..coastal_trading_port..` | Cliff-top port, half-timber houses, crane, jetty, lighthouse | **Map marker: port / coastal sector** |
| 7 | `..island_archipelago_sanctuary..` | Floating green island, stone keep, palms and pines, small jetty | **Map marker: island / remote or "sanctuary" sector** |
| 8 | `..merchant_market_stall_booth..` | Wooden stall, teal and cream awning, potions, scrolls, lanterns, blank hanging sign | **Marketplace booth** (goods) |
| 9 | `..stone_and_timber_bank_holding_vault..` | Stone and half-timber vault house, iron door with gear lock, open chest of gold, teal pennant with coin | **Marketplace reserve vault**; also the app's "Gold store" (bullion) structure |
| 10 | `..friendly_fantasy_merchant_representative_sal_booth..` | Large carved stall, red and cream awning, shelves of gems, scales, ledger, quill; sign reads "SAL'S WARES" | **Sal's counter** |

Other files:
- `fortress_quest/DESIGN.md`: a full UI design system (Rubik font, teal `#0CA5B0`, timber `#8A5432`, moss `#76B82A`, "chunky tactile" buttons, XP bars, rewards).
- 8 screen mocks (`fortress_quest_*` desktop 1440 px and phone 390 px with `code.html`): game canvas, marketplace store, cartographer map, dual-continent maps. They use the objects above, placed on a bright sky-and-grass backdrop.
- `image.png/screen.png`: a flat vector cartoon castle on a sky. It is the style reference for the system and **looks like a third-party stock illustration. Use it as a look reference only, never ship it.**

---

## 3. How the current app draws these things

Checked in code (`FortressScene.tsx` 1380 lines, `sceneWorld.tsx`, `marketplace/MarketArt.tsx`, `SalesRepArt.tsx`): **the app has no raster images at all today; everything is hand-coded SVG.** The first raster art needs a small pipeline (Part 5) and a fallback.

**Towers (`Keep`, `Outpost`, `Bullion`, `Granary`)** are computed per holding:
- size: `w` and `h` vary continuously with weight class and structure (`STRUCTURE_HEIGHT`: keep 1, outpost 0.72, bullion 0.6, granary 0.85)
- wall material: `basalt, granite, brick, timber, rotted, unsurveyed, not_applicable` (`MATERIAL` table; stone gets merlons and tiles, timber gets stakes and planks)
- freshness: only `fresh` towers get a banner, lit windows and torches
- state overlays: crack (rotted and knife-edge), ivy, scaffolding, thesis marks, siege ladders, drawbridge, moat runs, unsurveyed "ghost keep", raven
- the tower count in the resource bar must equal the towers drawn

So a swapped-in picture must not assert anything the data does not. Concrete conflicts found in the Stitch set:
- Tower 1 has **5 baked lit windows and a banner**: it would say "fresh" for every tower. Needs unlit versions; light is added in code.
- Sal's counter has **baked text** ("SAL'S WARES"); the vault pennant has a baked coin emblem. Blank versions needed.
- Soft ground shadows on the port and the vault leave a white smudge when the white is removed (see Part 5).
- One material only (grey granite). The app needs 5 distinct looks (Part 6, S2-S6).

**Marketplace:** `MarketArt.tsx` draws the awning, a merchant, status pips, decision scales and door icons; `SalesRepArt.tsx` draws Sal as a character with moods (pitch etc.) and a coin burst. The Stitch booths replace the *stall*, not Sal the character; the mood sprite stays SVG unless Part 6 S18 is used.

**Map:** per the hand-off doc, settlements = holdings, provinces = sectors, fog patches = unsurveyed, pan and zoom. Markers are fixed objects, so these swap easily; fog stays a code layer drawn on top. Not verified in code (see status note).

---

## 4. Conflicts with current rules and decisions for Faiz

The Stitch Master look is **bright cartoon** (sky blue, grass green, teal roofs, rounded Rubik type, ink outlines). The documented identity is **candlelit hand-painted study** (dark browns, gold, Marcellus, no green or blue-green, no cartoon). The live Fortress scene already uses a daylit sky and grass, so the objects will not look foreign there, but the rest of the chrome is dark and gilded.

Decisions needed:

1. **Palette addendum.** Allow teal `#0CA5B0`/`#075960` (roofs, pennants) and a dark-indigo ink outline `#26253B` *for object art only*. Keep state colours exactly as before (green good, red bad, amber caution, never colour alone). Recommended: yes, with the rule "teal and moss are decoration, never status".
2. **Scope of the Stitch design system.** Recommended: adopt the **objects only**. Do not adopt `DESIGN.md` UI (Rubik, chunky wooden buttons, rounded 24 px dialogs) now: it would be a full reskin, and the screen mocks break the standing hard rules: XP, levels, gold, gems, waves, "START BATTLE", "Claim Reward" (points/rewards/timers), invented sample numbers, emoji icons, text under 12 px, and a fixed 1440 px layout. If Faiz wants a UI reskin, that is a separate sprint with its own audit.
3. **Sal's red and cream awning.** Red is reserved for "bad". Recommended: re-make Sal's stall in teal/cream or timber/gold (S13 follow-up). Same for the red banner on the spire tower.
4. **A raster layer in an all-SVG scene.** Recommended: yes, behind a switch with SVG fallback (Part 5), because the earlier art trial was reverted and this time the switch lets Faiz compare on real data.
5. **Which phase first.** Recommended: A (booths).

---

## 5. Technical feasibility (tested)

**Background removal works.** I ran a flood-fill from the image border (near-white = background), a one-pixel clean-up and a slight edge blur on all 10 images, then cropped and shrank to 512 px WebP:

| Result | Value |
|---|---|
| Output size | 26-58 KB each at 512 px on the long side (budget in the old pack: heroes < 300 KB, tiles < 60 KB) |
| Edge quality | Clean on a dark and on a green background for 8 of 10 |
| Problem images | Port and vault booth: a white shadow smudge remains under the object. Sal's counter: 5% light pixels kept (pale cream inside the object, harmless) |
| Fix | In every new prompt ask for "no ground shadow, no cast shadow"; for the two existing images, regenerate or erase the smudge by hand |

Pipeline to build (small script, `scripts/art/pack.py`): key from borders (min channel >= 232), open + blur alpha, crop to bounding box, resize to <= 512 px (retina 2x only where needed), save WebP q82. Store masters outside `public/`; ship only the packed files in `frontend/public/art/objects/`. Pre-commit blocks document uploads outside `docs/`, but images in `public/art` pass.

**How the tower swap would work (Phase C):**
- Draw an `<image>` inside the tower's SVG group, fixed aspect ratio, standing on the same ground line.
- Pick the silhouette by the layout aspect ratio: narrow and tall gets the **spire**, wide gets the **bastion**. This avoids stretching.
- Pick the picture by `wall` (one set per material, S2-S6). Do **not** recolour with CSS filters: a hue shift would also change the teal roof.
- Keep as code, drawn over or under the picture: lit windows and torches (freshness), crack, ivy, scaffolding, thesis marks, ladders, drawbridge, moat, raven, name plate.
- `unsurveyed` always stays the code ghost keep. A picture must never appear for an unknown wall.
- Layout spacing today uses the width `w`; choose the scale from height and accept a small width difference, or adjust spacing once, not per tower.

**Switch:** `?art=stitch|svg` plus localStorage, SVG is the default until Faiz flips it, and the component renders SVG if the image fails. Tests: tower count equals towers drawn; `unsurveyed` never uses an image; alt/aria text unchanged.

**Effort estimate (relative):** A booths: small. B map markers: small to medium (after reading map code on `main`). C tower kit: medium to large (needs the Part 6 images first). D Great Keep: medium.

---

## 6. Stitch Master style and prompt pack

### 6.1 Style description (what the new look is)

Hand-inked casual-fantasy illustration: clean dark-indigo outline, soft cel shading with warm light from the top left, a little painterly texture on stone and wood, chunky friendly proportions, a slightly elevated three-quarter view (about 30 degrees), one object centred with margin. Stone is blue-grey slate with moss in the cracks, roofs are scaled teal tiles, trim is timber brown with iron bands, windows glow warm amber only when lit, banners and pennants are teal, cream or gold.

Tokens (art only):

| Role | Value |
|---|---|
| Ink outline | `#26253B`, about 2-3 px at 1024 |
| Slate stone | `#6B6E8A` to `#A9ADBF` |
| Timber | `#8A5432`, shade `#58321C` |
| Spire teal | `#0CA5B0`, shade `#075960` |
| Moss (small accent) | `#76B82A` |
| Window glow | `#FBBF24` (only on lit variants) |
| Cream | `#EEE4D3` |
| Not allowed in objects | large red or green areas (state colours), emoji, text, figures |

### 6.2 Shared block (paste at the start of every prompt)

```
Design a square screen that is a single full-bleed illustration of ONE object, no UI chrome, no text.
STYLE (Stitch Master): hand-inked casual-fantasy game illustration, clean dark-indigo outline (#26253B, 2-3 px at 1024), soft cel shading with warm light from the top left, light painterly texture on stone and wood, chunky friendly proportions, slightly elevated three-quarter view (about 30 degrees), the object centred with a 10% margin on all sides. Palette: slate stone #6B6E8A-#A9ADBF with small moss patches, timber #8A5432 with shade #58321C, scaled roof tiles in teal #0CA5B0 (shade #075960), iron bands, cream #EEE4D3, banners teal or cream or gold. Windows are dark and unlit unless stated.
BACKGROUND: flat pure white #FFFFFF everywhere around the object. No sky, no ground plane, no scenery.
AVOID: any text, letters, numbers, sign lettering, logos or emblems on flags, people, animals (unless stated), ground shadow, cast shadow, reflection, glow, red or bright-green large areas, emoji, UI, frames, watermark, a second object.
Use the attached image as the style reference; keep outline weight, shading and colours identical to it.
```

Practical notes (from the earlier rounds): Stitch has no aspect-ratio control (ask for square, crop afterwards), transparency is unreliable (hence the white background and the keying script), counts and text are unreliable, and it adds things you did not ask for, so repeat the AVOID line every time. Attach `cartoon_fantasy_medieval_stone_watchtower...` or the bastion as the style reference.

### 6.3 Prompts

Each says what it is for. **Acceptance for all:** one object; pure white background that keys out cleanly; no text or emblem; no shadow smudge; windows unlit; same outline and light as the reference; readable at 64 px wide; passes the greyscale test (silhouette still reads).

**S1. Style anchor (optional).** Use tower #1 re-made unlit (S2) as the anchor, so no separate prompt.

**S2. Spire tower, granite (Keep body, tall).** Replaces the baked-lit tower #1.
```
[Shared block] Subject: a tall round stone watchtower in grey granite blocks with small moss patches, a conical teal scaled roof, a crenellated parapet ring under the roof, four small arched windows that are DARK and unlit, a wooden door with iron bands and three steps. A plain teal flag on top with NO emblem. No balcony, no hanging banner, no lantern.
```

**S3. Spire tower, basalt.** Same silhouette, dark blue-black basalt blocks `#3C4656`-`#1F2530`, slightly cooler light, same teal roof.
```
[Shared block] Subject: the same tall round watchtower, same pose and proportions as the reference, built from dark blue-black basalt blocks (#3C4656, joints #1F2530), teal roof, dark unlit windows, plain teal flag with no emblem.
```

**S4. Spire tower, brick.** Warm brick `#A9553A`, same silhouette (brick is a material here, not a status colour).
```
[Shared block] Subject: the same tall round watchtower, same pose, built from warm red-brown brick courses with cream mortar and a stone footing, teal roof, dark unlit windows, plain teal flag with no emblem.
```

**S5. Spire tower, timber.** Log palisade tower, wood-shingle roof (no teal; wood marks the material).
```
[Shared block] Subject: a tall round watchtower built from vertical timber logs with iron bands, a pointed wooden palisade top, a conical roof of brown wood shingles, dark unlit window slits, a plank door. Plain brown pennant, no emblem. Timber palette #8D6436 / #4F3418.
```

**S6. Spire tower, rotted timber.** For `rotted` walls.
```
[Shared block] Subject: the same timber watchtower but visibly decayed: leaning slightly, dark wet grey-brown boards, several missing planks, a broken roof with a hole, broken palisade tips, loose rope. No fire, no smoke, no pennant. Palette #4F3E29 / #2A2014.
```

**S7. Bastion set (squat tower), if S2-S6 work.** Repeat S2, S3, S4, S5, S6 using the reference bastion (#2) and the instruction "wide squat round tower with a low outer wall, teal crenellations (timber version: wooden hoarding), no flag emblem, dark unlit slits". Five more images; do this only after the spire set passes review.

**S8. Allied outpost (fund).** For `structure = outpost`.
```
[Shared block] Subject: a small hill outpost: a low round stone watchpost on a round grassy mound with a short timber palisade ring and one small teal-roofed turret, one canvas lean-to against the wall. No people, no animals, no flag emblem.
```

**S9. Granary.** For `structure = granary`.
```
[Shared block] Subject: a round stone-and-timber granary: stout stone base, timber upper half, a deep thatched cone roof with a small louvered vent, a loading hatch, three grain sacks stacked at the door. No people, no text.
```

**S10. Gold store (bullion) and reserve vault.** The existing vault (#9) fits; regenerate to remove the shadow and the coin emblem.
```
[Shared block] Subject: the same stone-and-timber vault house as the reference: arched stone doorway with an iron-banded door with a round gear-shaped lock, a barred upper window, a small crenellated side wall, an open chest of gold coins inside. The hanging pennant is plain teal with NO emblem. No cast shadow. No sign text (blank sign).
```

**S11. Great Keep.** The whole fortress as one structure (stands for all holdings).
```
[Shared block] Subject: a large central castle keep seen frontally, square main block with four round corner turrets with teal conical roofs, a tall central tower with a battlement, an arched gatehouse with a raised portcullis and iron-bound doors at the base, a flat stone base so it sits on a ground line. Plain teal pennants with no emblem. Windows dark. No surrounding walls, no hill, no scenery.
```
Companions (separate prompts, same shared block): **S11b curtain wall segment** (straight 3:1 stone wall with a walkway and merlons that tiles horizontally, no door, no figures) and **S11c corner bastion** (round corner tower with a short wall stub on each side).

**S12. Market booth variants (instrument kinds).** If more than one booth type is needed: same booth as #8 re-made with different goods (a grain-and-barrels booth, a toolsmith booth). Keep the teal/cream awning, **blank hanging sign**, no potions in saturated red or green.
```
[Shared block] Subject: a wooden market stall with a teal and cream striped awning, carved timber posts, two lanterns, a BLANK wooden hanging sign, counter stacked with grain sacks, a barrel and a coil of rope. No people, no text.
```

**S13. Sal's counter, state-colour safe.** Follow-up on #10.
```
[Shared block] Subject: the same large carved merchant counter as the reference (carved arch, shelves of goods, scales, open ledger, quill) but with a teal and cream striped awning, a BLANK arched sign (no letters), and a plain cream hanging banner with no symbol. Gems on the shelves in teal, amber and cream only (no red, no green). No cast shadow.
```

**S14. Siege camp sprites (separate images, enemy = dark ash palette).** The siege level and counts are data, so the camp is composed in code from sprites (calm = none; gathering = 3 tents / 7 soldiers; besieged = 7 tents / 20 soldiers / 3 engines / 5 fire arrows, per `siegeCamp()`). Make each sprite as its own image, in a charcoal, ash-brown and black palette with a dark pennant (no red), no teal: (a) a canvas war tent, (b) a small soldier silhouette with spear, standing (full-body, faceless, tiny), (c) a trebuchet, (d) a battering-ram frame, (e) a siege tower, (f) a fire arrow streak. Prompt pattern:
```
[Shared block] Subject: a single enemy war tent in dark charcoal-and-ash canvas with a short pole and a plain black pennant. Palette: #3B3A45, #5A4F44, #1F1E26. No emblem, no figures, no fire.
```
(For the soldier: "a tiny faceless soldier silhouette, spear upright, charcoal armour, full body". Soldiers are the only figures in the whole set; they are enemy markers and must stay faceless.)

**S15. Shanty shack.** For the "tiny positions" shantytown.
```
[Shared block] Subject: a tiny crooked lean-to shack of mismatched planks and a tarp, about one third of the size of a normal house, a rusty tin chimney. No people, no text.
```

**S16. Raven and lamp (replace `RavenMark`, `MagicLamp` if wanted).** Raven: perched, wings folded, charcoal body, small amber eye, tiny scroll tube on its leg. Lamp: a brass oil lamp with a curved spout and a thin cream smoke wisp. Two separate prompts, same shared block, "no genie, no sparkles".

**S17. Map terrain props (separate images).** (a) a cluster of three pine trees, (b) a rocky hill with moss, (c) a palm cluster, (d) a small sailing ship with a plain cream sail and no flag, (e) a small stone bridge. Each on white, no ground shadow. Sea, rivers, province shapes, fog and borders stay generated in code.

**S18. Sal portrait with moods (optional).** Four separate bust portraits, same character, neutral background: `pitch` (open hand), `shrug`, `pleased`, `worried`. Original character, short cap, ink-stained fingers, satchel strap, quill behind the ear. Stitch is poor at keeping one character across images; use the first image as reference and expect to iterate. Keep the SVG Sal as fallback.

**What stays out of Stitch (code only):** sky, ground, water, mountains, weather, fog patches, moat, drawbridge, rings and maps with data, lit windows and torches, cracks, name plates, counts.

### 6.4 If Stitch is used for screens again

Fix list for the next screen prompt (from the mocks): no XP, level, gold, gems, waves, "battle", "claim" or "survey cost" wording; no invented sample figures (use "0.0" or "sample" labels); no emoji icons; text at least 12 px; one tab strip, rooms not repeated in a sidebar; fluid layout with a 390 px phone version; Rubik only if decision 2 is yes; teal is not a status colour; and use real tower and booth images as separate, replaceable elements (not baked into the screen).

---

## 7. Rollout plan

Branch off fresh `main`, one PR per phase, behind `?art=stitch|svg`, SVG default until Faiz switches. Before each: `ruff`, `pytest`, `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` as in CLAUDE.md. Update `docs/PROGRESS.md` and the Claude project `progress.md` in the same PR.

| Phase | Content | Needs |
|---|---|---|
| 0 | Faiz decisions (Part 4); packing script; check `main` for Map and `kit/` code | nothing new from Stitch |
| A | Sal's strip and the empty street (see Part 9; stalls stay SVG). **Built, PR open.** | S13 (real re-make replaces the stand-in) |
| B | Map settlement markers #4-#7 plus the town or tower as the small marker; terrain props S17 | S17 (optional) |
| C | Tower kit: spires S2-S6, bastions S7, outpost S8, granary S9, gold store S10 | S2-S9 |
| D | Great Keep, curtain wall, bastion S11 | S11 |
| E | Siege sprites S14, shacks S15, raven and lamp S16, Sal moods S18 | optional |

Check on real data (dark and light, phone width) after each phase: tower count equals towers drawn; unsurveyed shows only the ghost; no baked state; 44 px targets; no text in any image; alt text states the fact in words.

---

## 8. Decisions (Faiz, 2026-10-11)

1. **Palette addendum: yes.** Teal `#0CA5B0`/`#075960` and the dark-indigo ink outline `#26253B` are allowed in object art only. Teal and moss are decoration, never status; state colours unchanged.
2. **Objects only.** The Stitch UI design system (`DESIGN.md`: Rubik, chunky buttons, rewards) is not adopted. The screen mocks stay reference only.
3. **Sal's stall is re-made in teal and cream** (S13), no red awning; red banners are also replaced.
4. **A raster layer behind a switch with SVG fallback: yes** (`?art=stitch|svg`, SVG default until Faiz flips it).
5. **Start with Phase A (booths): yes**, including packing the current images and building the Phase A switch on a fresh branch from `main`.

Status after the decisions: Phase A is built (branch `feature/stitch-objects-booths`, PR open, not merged, not deployed). Phase C (tower kit) still needs the S2-S9 images generated in Stitch.

## 9. Phase A as built (2026-10-11)

**Correction to Part 1 and Part 3.** Reading the real marketplace code on `main` showed the Stitch mocks (three big booths) do not match the app. What the app has: `MarketplacePage` draws one `Stall` per watchlist company whose awning colour comes from `TONE_PAINT[shopFront(row).tone]` (gold, amber, plain, mist = the stored verdict tone), a Sal strip (`SalesRep` mood `pitch`, 64 px) and an empty state; `MarketStorePage` draws a tone awning and `Merchant level={verdict.level}`. A picture there would hide or contradict data, so it was not swapped.

**Slots swapped (picture only when `?art=stitch`, SVG otherwise and on load failure):**
- Sal strip on the Marketplace: `sal-counter.webp` (Sal's counter, 96 px wide) replaces the 64 px drawn figure. The figure's looping bob is not applied to the picture.
- Empty street ("The street is empty"): `booth-goods.webp` (the teal and cream goods booth) above the existing text. No new words.

**Not swapped, on purpose:** stall awnings (tone = data), the store-page shopkeeper (verdict level = data), the Sal and Hype dialogs (mood sprites), the vault booth (no slot until the Gold store tower, Phase C).

**Stand-in for S13.** `sal-counter.webp` is made from your original image by `scripts/art/pack.py`: red awning stripes recoloured to teal and the "SAL'S WARES" lettering erased (decision 3). It is a stand-in; generate the real S13 in Stitch and the fix can be deleted. Known flaw: the lamp glass on the counter became transparent, and a few edge pixels on the right post are tinted teal.

**Files:** `scripts/art/pack.py` (white-background removal from the border plus enclosed pure-white openings, crop, <= 512 px, WebP q82), `frontend/public/art/objects/*.webp` (48 and 52 KB), `lib/stitchArt.ts` (+ test: default SVG, URL wins, unknown values ignored, every picture decorative), `components/ObjectArtImage.tsx`, 3 lines in `MarketplacePage.tsx`, 3 lines of CSS.

**How to look at it after deploy:** open the Marketplace with `?art=stitch` (remembered in that browser); `?art=svg` switches back. Check dark and light, phone width, and that the Sal buttons still work.

**Checks run in the cloud session:** `tsc --noEmit`, `npm run lint` (0 errors, 2 existing warnings), `npm test` (571 passed), `npm run build`. Not seen in a real browser; no backend was available to render the page.
