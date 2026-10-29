# Fortress sections: more graphics (2026-10-29)

Status: **PR 1 merged on 2026-10-29 (#196; deploy not checked). PR 2 written and tested, not merged. Not yet seen in a real browser on real data.** Pictures render in a static harness only (desktop, dark skin).

## What shipped in PR 1 (`feature/fortress-section-art`)
- **Art packed (nine pictures, about 110 KB):** `vault-cutaway`, `scaffold-windlass`, `watch-turret`, `desk-lamp`, `study-shelf`, `spyglass`, `temperament-calm`, `temperament-panic`, `backdrop-night-parapet`. Art cap raised 3600 to 3800 KB and backdrops 10 to 11 (reasons in `artAssets.test.ts`).
- **Wired:** The whole fortress (keep + verdict flag: straight = no rule flags, swallowtail = mixed, torn = needs a look, blank "?" = cannot judge; unknown fogs the keep), Walls on the rise (scaffold header, the tower's own bastion per row, dimmed when unmeasured), Night Watch (turret + code flame: lit only for a watch that reported on time; a silent watch is a cold bowl), Vault (empty cutaway, gold drawn by code from the backend level, a pip per account; "cash not entered" is a "?" not an empty vault). The old `vault-stocked` picture is no longer used by the Vault card (the scene still uses it).
- **Pure mappings:** `lib/sectionScene.ts` (tests in `sectionScene.test.ts`, `fortressSectionArt.test.tsx`).
- **PR 2 (`feature/fortress-section-art-2`, written and tested, not merged, not deployed):** Spread of the realm (skyline of towers by weight, bracket on the top five, dashed equal-split row for the effective holdings, a hut per tiny position, a fogged "?" tower for a holding with no stored weight), Reports tabs (small pictures; Temperament shows the fixed calm and panic pair, never chosen from data), spyglass on the legend and "What the survey could not see", Study desk (desk lamp with a code-drawn flame; the clock is dropped in Game mode). Pure mapping `spreadScene` in `lib/sectionScene.ts`.
- **Not done:** footer (shared by every game page, little gain, left alone), the packed `study-shelf` and `backdrop-night-parapet` (no slot wired; both are packed and unused).
- Pictures show in Game mode only; with it off every card keeps its previous look.

## Decisions (Faiz, 2026-10-28)
All five objects; raise the art cap; Temperament = a calm vs panicked character pair; team calls on the Vault (empty cutaway + code gold), Study desk (keep desk-lamp, drop the clock) and order (Whole fortress, Walls, Night Watch first).

## Design-team brief and Stitch prompts (as generated)


Status: written, not committed, not generated. Team reports (designer, UX, feel engineer) were run on staged copies; `FortressPage.tsx` (legend, Spread card, survey-gaps notes) and `lib/` were NOT read, so those three sections are specified from field lists.

## How to use
Paste the SHARED BLOCK first, then one SUBJECT. Attach a reference image every time (keep-granite for stone/teal objects, council-candles for small props), composited on white at 1024. One object per image, square, pure white background. Code draws every fact on top (flames, coins, counts, fog, state colour).

### SHARED BLOCK
```
Design a square screen that is a single full-bleed illustration of ONE object, no UI chrome, no text.
STYLE (Stitch Master): hand-inked casual-fantasy game illustration, clean dark-indigo outline (#26253B, 2-3 px at 1024), soft cel shading with warm light from the top left, light painterly texture on stone and wood, chunky friendly proportions, slightly elevated three-quarter view (about 30 degrees), the object centred with a 10% margin on all sides. Palette: slate stone #6B6E8A-#A9ADBF with small moss patches, timber #8A5432 with shade #58321C, teal #0CA5B0 (shade #075960), iron bands, cream #EEE4D3 (never pure white on the object). Windows and glass are dark/clear and unlit.
BACKGROUND: flat pure white #FFFFFF everywhere around the object. No sky, no ground plane, no scenery.
AVOID: any text, letters, numbers, logos or emblems, people, animals, ground shadow, cast shadow, reflection, glow, flames, smoke, sparkles, red/amber/bright-green large areas, emoji, UI, frames, watermark, a second object.
Use the attached image as the style reference; keep outline weight, shading and colours identical to it.
```

## Subjects (5 objects + 2 temperament busts)

1. **spyglass** (legend "Read the picture" and "What the survey missed")
`Subject: a brass spyglass (telescope) with a leather-wrapped grip and a small teal band, lying diagonally, closed, lens glass clear and dark, no text.`

2. **scaffold-windlass** (Walls on the rise header)
`Subject: a small mason's wooden scaffold with a hand windlass, one coil of rope and one cut stone block hanging on a hook. No flag, no figures.`

3. **watch-turret** (Night Watch)
`Subject: a short round stone watch-turret with a teal roof edge and an EMPTY open iron brazier bowl on top, the bowl dark and cold. No fire, no smoke, no glow.`

4. **vault-cutaway** (Vault)
`Subject: a stone strongroom front with a wide arched opening. The opening is filled with ONE flat dark colour (#1B1A28), completely empty inside: no coins, no gold, no shelves. Iron-banded door frame, one plain teal pennant on the roof, no lettering.`
Note: the opening is measured after generation (code clips the gold level into it). Ask for a clear rectangle-ish arch.

5. **desk-lamp** (Study desk; cuttable, lowest value)
`Subject: a brass oil lamp on a small turned stand. The glass chimney is EMPTY and clear. No flame, no light, no glow.`

6. **temperament-calm** and 7. **temperament-panic** (Reports tab "Temperament": one dual picture, both always shown side by side)
Generate the calm one first, attach it as the reference for the panic one so it is the SAME character. Bust framing and outline match bust-oracle / bust-partner (attach one as the style reference). Original character, no resemblance to any known figure.
`Subject: bust of a friendly original steward, shoulders up, plain cream tunic with a teal collar, round face. Expression: CALM: relaxed half-smile, soft eyes, eyebrows level, shoulders down, hands not visible. Pale neutral background.`
`Subject: the same steward, same tunic and framing. Expression: PANIC: wide eyes, eyebrows raised and tilted, small open mouth, a few sweat drops at the temple, shoulders hunched. No red, no lightning, no text.`
Truth rule: the pair is a fixed emblem for the tab (it says "how steady is your hand"). Code never picks one face from portfolio status, and neither face is ever shown alone as a verdict.

## Optional wide backdrops (not keyed, 3:1; only if you want a scene behind a card)
- **Night parapet** (Night Watch): `a wide crenellated stone parapet at night seen from inside, flat dark indigo sky, no stars, no moon, no people, no text, 3:1 wide.`
- **Study shelf** (Study desk): `a wide dark timber desk shelf in three-quarter view, empty, a rolled blank scroll at one end, no lamp, no text, 3:1 wide.`

## Reused art (no new Stitch needed)
Whole fortress: keep-granite + code banner. Walls rows: bastion-* by wall rung. Reports tabs: bust-oracle/partner, siege-tent, raven; Temperament uses the new calm/panic pair. Spread: shack. Lamp corner: lamp. Footer: badge/crest.

## Team verdicts per section (identity now -> target)
- The whole fortress: 1 -> 3. Keep flies a verdict banner (shape + glyph, not colour alone); unknown = fogged keep + "?" flag. No 0-100 score ring, no green "all clear" tick. Do not reuse Records' wax seals.
- Walls on the rise: 2-3 -> 3. Rung stairs header (or scaffold), bastion thumbnail per row, seals for "Slipping"/"Thin cover". Gauge stays SVG. Phone pips ~4.7px, fix.
- Legend: ~1 -> 2. Pictured key of 7 items, only things the scene draws.
- Night Watch: 1 -> 3. Turret + code flame; "not reporting" = dark bowl + fog, never looks quiet.
- Reports tabs: 0-1 -> 2. Medallion/plaque tabs; raven seal count only when new > 0.
- Study desk: 1-2 -> 2. Lamp state is data (code flame). First to cut.
- Vault: 2 -> 3. Today stocked and deep share one full-looking picture: truth bug. Empty cutaway + code gold + per-account pips + hourglass if cash stale.
- Spread of the realm: ~0 -> 3. Skyline/ground plan by weight, bracket on largest and top five, ghost row of equal towers = effective holdings, shacks = small positions.
- Survey gaps: ~0 -> 2. Fog + spyglass; empty list says "No gaps noted", never "nothing hidden".
- Footer: 1 -> 2. Shared by every game page, do last. Lamp: leave.

## Decisions (Faiz, 2026-10-28)
1. All five objects: yes.
2. Raise the art pack cap above 2000 KB in the same PR: yes.
3. Temperament tab: a dual picture, calm character vs panicked character (two new Stitch busts above). Rename tab "Habits": not needed, keep "Temperament".
4. Vault (team call): empty vault-cutaway + code-drawn gold, per-account pips, hourglass when cash is stale. vault-1/2/3 stay on the scene only.
5. Study desk (team call): keep the desk-lamp object, drop the clock so the lamp is the only object on the shelf.
6. Build order (team call): kit pieces, then Whole fortress, Walls on the rise, Night Watch; then Vault and Spread; then Reports tabs, legend, gaps, footer last (footer touches every game page).
Still to confirm when building: "Feels like 6 equal keeps" wording, footer line "Look only. Nothing here trades.", and what the legend lists today.
