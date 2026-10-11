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

## 7. Pipeline (built in Phase A, generalised in Sprint 0)

`scripts/art/pack.py`: key the white background from the border (min channel at least 232) plus enclosed pure-white openings, crop to the object, shrink to 512 px at most, save WebP q82. Tested on all 52 Design_master images: 46 key cleanly at 18-65 KB. Four extra modes arrive in Sprint 0: sampled background (Sal busts), glow cut (fire arrow), erase shadow (port, first vault) and a lower threshold for the rotted keep. Masters stay out of `frontend/public/` (Vite ships everything in it); packed art lives in `frontend/src/assets/art/` with hashed names.
