# Stitch Master object art: style, rules and prompts for what is missing

Status: **reference, rewritten 2026-10-11 after Design_master arrived.** The catalogue of what exists and the sprint order are in [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md). Phase A (Sal's strip and the empty street on the Marketplace, `?art=stitch`) is merged as #101, deploy not verified. Nothing else is built.

## 1. Decisions in force (Faiz, 2026-10-11)

1. **Palette addendum: yes.** Teal `#0CA5B0`/`#075960` and the dark-indigo ink outline `#26253B` are allowed in object art only. Teal and moss are decoration, never status; state colours (green good, red bad, amber caution) are unchanged and never the only signal.
2. **Objects only.** The Stitch UI system (`DESIGN.md`: Rubik, chunky buttons, rewards, XP) is not adopted. The screen mocks are reference only.
3. **Sal's stall in teal and cream**, no red awning and no baked text. Done: Design_master image 52.
4. **Raster layer behind a switch, SVG fallback: yes** (`?art=stitch|svg`, SVG default until Faiz flips it).
5. **Start with the Marketplace (Phase A): yes**, done. The rest follows the sprint plan.

Earlier direction that is **retired**: the candlelit hand-painted look for object art, the painted art pack trial (merged as #94, reverted by #95, dropped by Faiz on 2026-10-10; the painted-gouache prompt library and the old hand-off brief were removed with this rewrite). The rest of the app keeps the candlelit study skin; only object pictures use the Stitch Master look.

## 2. The look

Hand-inked casual-fantasy illustration: clean dark-indigo outline, soft cel shading with warm light from the top left, a little painterly texture on stone and wood, chunky friendly proportions, slightly elevated three-quarter view (about 30 degrees), one object centred with a 10% margin.

| Role | Value |
|---|---|
| Ink outline | `#26253B`, 2-3 px at 1024 |
| Slate stone | `#6B6E8A` to `#A9ADBF` |
| Timber | `#8A5432`, shade `#58321C` |
| Spire teal | `#0CA5B0`, shade `#075960` |
| Moss (small accent) | `#76B82A` |
| Window glow | `#FBBF24`, only ever drawn by code |
| Cream | `#EEE4D3` |
| Enemy | charcoal `#3B3A45`, `#5A4F44`, `#1F1E26`, black pennant, no red, no teal |
| Not allowed in objects | large red or green areas, emoji, text, logos, figures (except the faceless enemy soldier and Sal) |

## 3. Truth rules for any picture

- A picture carries no fact: no status colour, count, text, emblem, lit window, torch, fog, weather or damage that data must decide. Those are drawn by code on top.
- A slot whose look encodes data stays SVG unless the data is re-drawn over the picture.
- Wall material is data (five of seven values have art); `unsurveyed` is always the code ghost keep.
- Alt text is empty; the page already states each fact in words.
- No new looping motion; reduced motion unchanged; text 12 px or more; no buy/sell wording, points, streaks or rewards in anything built from the mocks.

**Review checklist for new images:** one object; pure white background that keys out; no text or emblem; no cast shadow; windows dark; same outline and light as the reference; readable at 64 px wide; silhouette reads in greyscale; no baked state; palette within section 2.

## 4. Lessons from the Stitch rounds

- Stitch bakes in what you did not ask for (fog, seated figures, tent counts, pennants, text). Repeat the AVOID line in every prompt.
- One element per image on plain white; transparency and tiles are unreliable, so we key from white (`scripts/art/pack.py`).
- No aspect-ratio control: ask for square, crop afterwards.
- Counts and lettering are unreliable; code draws counts and text.
- A sample-data mock is not data: the mocks invent figures, levels and "battle" wording; never copy them.

## 5. Shared prompt block (paste at the start of every prompt)

```
Design a square screen that is a single full-bleed illustration of ONE object, no UI chrome, no text.
STYLE (Stitch Master): hand-inked casual-fantasy game illustration, clean dark-indigo outline (#26253B, 2-3 px at 1024), soft cel shading with warm light from the top left, light painterly texture on stone and wood, chunky friendly proportions, slightly elevated three-quarter view (about 30 degrees), the object centred with a 10% margin on all sides. Palette: slate stone #6B6E8A-#A9ADBF with small moss patches, timber #8A5432 with shade #58321C, scaled roof tiles in teal #0CA5B0 (shade #075960), iron bands, cream #EEE4D3. Windows are dark and unlit unless stated.
BACKGROUND: flat pure white #FFFFFF everywhere around the object. No sky, no ground plane, no scenery.
AVOID: any text, letters, numbers, sign lettering, logos or emblems on flags, people, animals (unless stated), ground shadow, cast shadow, reflection, glow, red or bright-green large areas, emoji, UI, frames, watermark, a second object.
Use the attached image as the style reference; keep outline weight, shading and colours identical to it.
```

Attach `spire-granite` (Design_master image 37, folder `..tall_round_stone_watchtower_in_grey_granite_blocks`) as the style reference.

## 6. Prompts for what is still missing

Each says where it is used. Acceptance is the checklist in section 3.

**Batch 1: finishes the Fortress**
- **M1 Curtain wall segment** (the walls between towers). `[Shared block] Subject: a straight stone curtain wall segment, 3:1 wide, granite blocks with moss, a walkway and merlons on top, flat vertical ends so copies line up side by side, no door, no figures, no flag.`
- **M2 Corner bastion.** `[Shared block] Subject: a round stone corner tower in granite with teal crenellations and a short wall stub on each side at ground level, dark slits, no flag, no door detail needed.`
- **M3 Genie, three faces** (happy, wow, sorry; separate prompts). `[Shared block] Subject: a friendly original genie rising from a thin smoke tail, blue skin #2F7FE0, gold arm bands, bare chest, turban in teal, expression: happy. No lamp, no sparkles, no text. Original design, no resemblance to any film character.`
- **M4 Well, M5 Haystack, M6 Bush or flower tuft** (terrace life, one prompt each). `[Shared block] Subject: a small round stone well with a wooden roof and a bucket` / `a round haystack with a wooden pitchfork leaning on it` / `a low bush with a few small flowers in cream and amber`. No people, no animals.

**Batch 2: map and people**
- **M7 Mountain range** (snow cap, and a bare variant), **M8 Hill** (rounded grassy mound with a few rocks), **M9 Sea serpent** (teal and cream, coiled, no face detail needed), **M10 Compass rose** (no letters: code adds N), **M11 Planted flag** (plain cream, on a short pole in a mound of earth). Map objects are decoration, never state.
- **M12 Oracle bust** (an owner-minded scholar: calm, spectacles, ink-stained cuffs, grey beard) and **M13 Partner bust** (a sharp-eyed sceptic: one raised eyebrow, folded arms, ledger under the arm). Neutral pale background, same bust framing and outline as Sal (images 19-21), original characters.
- **M14 Sal "cheer"** (arms up, grinning), same character as images 19-21.
- **M15 Store shopkeeper, five faces** (ready, promising, wait, pass, unknown: broad smile, small smile, flat patient, shake of the head, empty shrug). Skip if Sal busts are reused.

**Only if the sprint plan decisions go that way**
- Flagless spire and bastion (five materials each) and a flagless Great Keep: same prompts as images 37-41 and 17, with "no flag, no pennant on any roof".
- Awning-less stalls (four kinds): the same stall with "no awning, open timber frame at the top".
- Overlay sprites: ivy cluster, scaffolding frame, ladder, torch.

## 6b. Prompts for the rooms (Sprints 8 to 13, proposed)

Same shared block and review checklist as above. One object per image; for a set, generate the first image, then attach it as the reference for the rest so outline and light stay identical. A star marks the pieces that give a room the most identity for the least effort. Code draws every fact (seal state, ring, fog, gap, due date) over the neutral object.

**Batch 3, shared**
- ★ **Room crests** (one per room: council, records, circle, chronicle, map; later two more). `[Shared block] Subject: a round gilded medallion crest, brass rim with a teal enamel centre, one simple raised symbol in cream: [council = a round table seen from above with five small dots / records = a closed book with a ribbon / circle = three concentric rings / chronicle = an hourglass / map = an eight-point compass star]. No letters, no numbers.`
- ★ **Wax seal, intact** and **broken** (two prompts). `Subject: a round red wax seal pressed on a short parchment tab, intact, a plain star imprint` / `the same seal broken in two halves, a crack through the middle`. Red is the one deliberate exception (decision 12); shape carries the meaning.
- **Quill and inkwell.** `Subject: a brass inkwell with a white goose quill standing in it, no ink spill.`
- **Candle stand.** `Subject: a tall wrought-iron candle stand with three unlit white candles.` Code draws flames.

**Batch 4, Council**
- ★ **Round table.** `Subject: an empty round oak table in a three-quarter view, a teal cloth runner across the centre, iron-bound edge, nothing on it, no chairs.`
- ★ **Two chairs** (two prompts): `a tall high-backed chair in dark timber with gold studs and a teal cushion` and `a plain iron-framed chair with a straight back and a brown leather seat` (different silhouettes tell the advisors apart).
- **Agenda scroll:** `a half-unrolled blank parchment scroll with two wooden rollers, flat blank face, no lines, no writing.` **Gavel:** `a small wooden gavel resting on a round block.`
- Backdrop (optional, not keyed): `a wide candlelit stone council chamber interior, an arched window, a banner pole with a plain teal banner, an empty round table in the centre, no people, no text, 3:1 wide.`

**Batch 5, Records**
- ★ **Time-capsule casket.** `Subject: a small round-lidded iron-banded wooden casket with a leather strap, closed, no lock detail.`
- ★ **Bookshelf.** `Subject: a tall oak bookshelf with five shelves of closed books in slate, brown and teal spines, no lettering on spines, a few shelves partly empty.`
- **Tomes** (three prompts): a stack of three closed leather books with iron corners and a ribbon bookmark; a single closed book; a book lying open with blank pages.
- **Lectern:** `a slanted wooden reading desk on a turned post, a blank open book on it.` **Pigeonholes:** `a wooden pigeonhole cabinet of 3x4 small compartments, some holding rolled blank scrolls.`
- Backdrop (optional): `a stone archive hall, shelves along the wall, one long reading table, warm lamplight from the left, no people, no text.`

**Batch 6, Circle**
- ★ **Standing stone** (and a low leaning variant): `Subject: a single tall rough standing stone with a flat top and a faint teal moss line at the base, no carvings.`
- ★ **Brazier:** `a round iron fire basin on three legs, filled with dark unlit coals.`
- **Lantern post:** `a wooden post with an iron hook and a brass lantern, unlit, glass dark.` **Signpost:** `a two-armed wooden signpost with both arms blank, planted in a small mound.` **Telescope:** `a brass telescope on a wooden tripod, pointed up and to the right.` **Fog stake:** `a short wooden stake with a frayed rope tied around it.`
- Backdrop (optional): `a circular flagstone clearing at dusk seen from above at 45 degrees, empty, mist at the outer edge, no rings, no figures.`

**Batch 7, Chronicle**
- ★ **Hourglass:** `Subject: a brass-framed hourglass on a short wooden base, sand evenly split, no spill.`
- ★ **Strata block:** `a stone cross-section block showing five flat horizontal rock layers in slate, tan and teal-grey with a thin moss top, flat sides.` (tiles into the spine)
- **Sundial:** `a round stone sundial on a short pillar, a plain brass gnomon, no numerals.` **Chronicle book:** `a large closed book on a slanted brass stand, a quill lying beside it.` **Sconce:** `an iron wall sconce with an unlit torch` (dark by code for gap days). **Weathervane:** `a plain iron weathervane with an arrow pointing right, no letters.` **Cairn:** `a small cairn of five stacked flat stones.`
- No weather pictures (clouds, sun, rain): weather is data and stays code.
- Backdrop (optional): `a long stone timeline wall with five arched alcoves in a row, empty, soft light, no text, 4:1 wide.`

**Batch 8, Map table**
- ★ **Frame corner:** `Subject: an ornate brass corner bracket for a map frame with a small teal gem, flat inner edges, one corner only.` (mirrored four times by code)
- ★ **Dividers:** `brass drawing dividers (compasses) standing open.`
- **Rolled map:** `a rolled parchment map tied with a teal ribbon, one end slightly open.` **Pin:** `a round-headed brass map pin standing upright, no flag.` **Wave tile:** `a small cluster of stylised sea waves in teal and cream, flat on white, no boat.`
- The planted flag already exists (Sprint 6, unused): commission flags are data and stay code.

## 7. Pipeline (built in Phase A, generalised in Sprint 0)

`scripts/art/pack.py`: key the white background from the border (min channel at least 232) plus enclosed pure-white openings, crop to the object, shrink to 512 px at most, save WebP q82. Tested on all 52 Design_master images: 46 key cleanly at 18-65 KB. Four extra modes arrive in Sprint 0: sampled background (Sal busts), glow cut (fire arrow), erase shadow (port, first vault) and a lower threshold for the rotted keep. Masters stay out of `frontend/public/` (Vite ships everything in it); packed art lives in `frontend/src/assets/art/` with hashed names.
