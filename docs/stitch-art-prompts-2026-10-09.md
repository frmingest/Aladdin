# Aladdin art pack: Google Stitch prompt library — 2026-10-09

Status: **proposal, nothing built in the app.** Written by the design agent from the existing visual-identity docs ([game-visual-identity-2026-10-09.md](game-visual-identity-2026-10-09.md), [game-visual-identity-standard-draft-2026-10-09.md](game-visual-identity-standard-draft-2026-10-09.md), [fortress-art-pass-2026-10-09.md](fortress-art-pass-2026-10-09.md)). Used for a first Stitch round on 2026-10-10; the resulting art pack was merged (#94) and reverted (#95), see [art-pack-trial-2026-10-10.md](art-pack-trial-2026-10-10.md). Lessons from that round are in [stitch-handoff-2026-10-10.md](stitch-handoff-2026-10-10.md). Prompts below were tested only lightly; expect to iterate.

## 1. What Stitch can do today (verified vs. unverified)

Sources are third-party reviews; no official Google documentation was found, and figures vary by source date.

| Question | Finding |
|---|---|
| Illustrations or UI screens? | Stitch is UI-screen-centric (app/website screens on a canvas). Not described as a standalone illustration tool. A "Redesign" option using Nano Banana (Google's image model) appears in the model selector. |
| Models | Gemini 3 Flash default (fast, lower quality). Gemini 3.1 follows prompts better. |
| Reference images | Yes (images, sketches, screenshots). A Jan 2026 source said Experimental-mode only and not exportable to Figma; may be outdated. |
| Follow-up prompts | Yes. Chat edits create new screens, keep originals; branch from any screen; Shift-select several screens to apply one prompt; Mark / Direct Edit / Select tools. |
| Style memory | Stitch generates a DESIGN.md (colours, typography, layout rules); you can add negative constraints. Re-importing one is not confirmed. |
| Exports | HTML/CSS, Tailwind, React, ZIP, Figma (Auto Layout), MCP, AI Studio, Jules, prototype link. |
| Limits | About 400 credits/day (new project ~9, edit ~2-5; reviewer estimate). Free in beta. |

**Not verified (treat as unknown, test early):** fixed aspect ratios / pixel sizes; direct single-image PNG export (plan on canvas image download or screenshot); transparent backgrounds; seamless tiles; reliable object counts ("exactly 7 tents").

Sources: Zapier (May 2026) zapier.com/blog/google-stitch · Unite.AI (Mar 2026) unite.ai/google-stitch-review · uithings (Jan 2026) uithings.com/what-is-google-stitch · DEV Community (Stitch + DESIGN.md) · MindStudio overview.

### Recommended workflow
1. **Style anchor first.** Run P1 with the best model available (Gemini 3.1, or Redesign/Nano Banana). Keep the best of 3-4 variants.
2. **Attach the anchor as a reference image** to every later prompt. Re-paste the inline style block anyway; a reference alone drifts.
3. **Keep the DESIGN.md.** Put palette, Marcellus serif and the avoid-list in it.
4. **Ask for a screen that is only an illustration.** Every prompt opens "Design a [device] screen that is a single full-bleed illustration, no UI chrome, no text".
5. **Use a fallback tool** (Gemini / Imagen / Nano Banana, set aspect ratio there) for transparent sprites, seamless tiles and exact counts; clean up in Photopea or Figma.
6. **Budget credits:** plan ~4 variants per asset.

> **Fallback note (all prompts):** if Stitch won't give a pure illustration, delete the first sentence ("Design a ... screen that is ...") and paste the rest into Gemini/Imagen with the stated aspect ratio.

## 2. Style bible

**Full block (anchor + DESIGN.md):**

```
ALADDIN STYLE BIBLE
Medium: hand-painted digital gouache and oil, matte finish, visible soft bristle-brush grain, faint paper tooth, slight desaturation. Not 3D, not photoreal, not glossy, not vector-flat.
World: a candlelit scholar's study fused with a walled medieval fortress; heavy stone, aged iron, parchment, brass, wax. Original design, no resemblance to any existing game, film or artwork.
Palette (only these): deep browns #140F0B, #1F1812, #2A2119; ink-cream #EEE4D3; aged gold #D6A85A with highlight #fff0b8 and shadow #6e4a12; parchment #ECE3D0 and #F6EFE0; seal red #7a1d18 ONLY on wax seals. Neutral warm greys derived from the browns are allowed. No green, no blue-green, no bright red.
Light: one warm candle or torch source, low-key, soft pool of light with falloff to #140F0B at the edges (vignette). Long soft shadows, no hard rim light.
Line and shape: bold simple silhouettes that read at 44px; painted edges, no black outlines; thin gilded rules (1 to 2px equivalent) as accents; pattern/hatching/dashes used for state, never colour alone.
Perspective: calm frontal or slightly elevated three-quarter view, shallow depth, no extreme foreshortening or fisheye.
Mood: grave, quiet, trustworthy, a little austere. Nothing celebratory.
Semantics: unknown or unsurveyed things are drawn as cold-neutral grey fog with dashed edges, never as pleasant or safe. Danger is shown by shapes and counts, never by red.
AVOID: any text, letters, digits, rune-like glyphs, logos, brand names, real people or celebrities, watermarks, green or red verdict tints, neon, lens flare, cartoon or anime, chibi, clutter, photoreal faces, gore, modern objects.
```

**Compact block (inlined in every prompt below):**

```
STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; candlelit study-fortress world; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), parchment #ECE3D0/#F6EFE0, seal red #7a1d18 only on wax seals; single warm candle light, vignette to #140F0B; bold silhouettes, no black outlines, thin gilded rules; calm frontal/slightly elevated view; grave quiet mood. AVOID: text, letters, numbers, rune glyphs, logos, real people, green or bright-red tints, neon, cartoon/anime, 3D render, photoreal faces, clutter, watermarks, copies of existing games/films.
```

## 3. Prompt library

Pixel sizes are master exports. Ship WebP quality 80-85 plus a 1x downscale. Safe zones are % of width/height.

---

### P1. Style anchor (generate first)
- **Where used:** reference for every later prompt.
- **Spec:** 16:9, 2400x1350, PNG, opaque, dark only, no UI overlay.
- **Prompt:**
```
Design a desktop screen that is a single full-bleed illustration, no UI chrome, no text. Subject: a dark candlelit study at the top of a stone fortress tower, seen from a slightly elevated three-quarter view. A heavy oak desk holds an unrolled parchment map, a brass candlestick with one flame, a closed scroll with a dark-red wax seal, and a small ornate oil lamp with a curved spout. Through an arched stone window behind the desk, a distant walled fortress with five towers of different heights sits on a hill under a dim, cloudy sky. Low-key lighting: the candle is the only warm light, falling in a soft pool on the desk and fading to near-black at the edges. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), parchment #ECE3D0, seal red #7a1d18 only on the wax seal; bold silhouettes, no black outlines, thin gilded rules; grave quiet mood. AVOID: text, letters, numbers, rune glyphs, logos, real people, green or bright-red tints, neon, cartoon/anime, 3D render, photoreal faces, clutter, watermarks, copies of existing games/films.
```
- **Follow-ups:** (1) "Keep composition. Reduce saturation by 15% and push the corners darker toward #140F0B." (2) "Simplify the desk objects into larger, bolder shapes so each reads at thumbnail size." (3) "Same scene in morning parchment light: darks become #ECE3D0 and #F6EFE0, flame light a warm #D6A85A glow, same composition."
- **Acceptance:** no text/glyphs; fortress not glowing or triumphant; no green/red except the seal; eyedropper palette stays in the bible; legible at 400px wide.

---

### P2. Shared page header banner
- **Where used:** top of every room page (title plate sits over it).
- **Spec:** 20:3 (6.67:1), 2400x360, WebP, opaque. Keep left 8% and right 8% for crests; centre 50% free of bright detail (title overlay). Phone: crop to central 1200x360, key motif inside central 50%. Dark + parchment variant.
- **Prompt:**
```
Design a wide desktop banner screen that is a single full-bleed illustration, no UI chrome, no text. Aspect 20:3. Composition, symmetric: a horizontal band of dark stone wall with a thin aged-gold rule running along the top and bottom edge. At far left and far right, a wrought-iron wall bracket holding a lit torch whose flame is a small warm gold #D6A85A glow. At the left and right thirds, a small carved heraldic crest (a simple tower shape inside a shield) in aged gold. The centre 50% is an empty, calm, slightly lighter stone panel (#2A2119) with a faint fluted plate outline in gold, left empty for a title. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12); single warm torch light, vignette to #140F0B; bold silhouettes, no black outlines. AVOID: any text or letters in the plate, numbers, rune glyphs, logos, real people, green or bright-red tints, neon, 3D render, clutter, watermarks.
```
- **Follow-ups:** (1) "Make the centre panel 10% darker and flatter so overlaid cream text keeps contrast." (2) "Parchment variant: stone becomes #ECE3D0 / #F6EFE0 paper, gold rules #926218, torches become ink-brown wall sconces with no flame glow." (3) "Only the left half (crest + torch), to be mirrored in code."
- **Acceptance:** centre dark enough for cream title (4.5:1+ against #EEE4D3); no text in plate; torches read as decoration, not an alert.

---

### P3. Council chamber hero
- **Where used:** Council page. Eight fixed seats (one per agenda kind), advisors seated, "what the council cannot see" fog alcove, sealed folios.
- **Spec:** 16:9, 2400x1350, WebP, opaque. Bottom 22% quiet (folio list overlay), top 15% for header. Phone: centred 4:5 crop keeps table + alcove.
- **Prompt:**
```
Design a desktop screen that is a single full-bleed illustration, no UI chrome, no text. Subject: a round stone council chamber seen from a slightly elevated three-quarter view. A large circular oak table in the centre has exactly eight high-backed carved chairs evenly spaced around it. Seats 1, 3 and 6 hold simple seated silhouettes in robes (faces in shadow, no portraits); the other five are empty. On the table: several parchment folios, each sealed with a dark-red wax seal (#7a1d18), and one brass candlestick. In the back-left wall is a deep arched alcove filled with cold-neutral grey fog with a dashed, ragged edge, clearly murky and unlit (it must look unknown and uncomfortable, not mystical-pleasant). A round iron chandelier with candles hangs overhead and throws a pool of warm light on the table. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), parchment #ECE3D0, seal red #7a1d18 only on wax seals; single warm candle light, vignette to #140F0B; bold silhouettes, no black outlines; grave quiet mood. AVOID: text, letters, numbers, rune glyphs, logos, real people, green or bright-red tints, neon, cartoon/anime, 3D render, clutter, watermarks, copies of existing games/films.
```
- **Follow-ups:** (1) "Make the eight chairs identical in size and spacing, like a clock face." (2) "Make the fog alcove more clearly murky and ragged-dashed; remove any glow or sparkle." (3) "Reduce floor/wall detail by 30% so overlay cards read cleanly on the bottom edge."
- **Acceptance:** exactly 8 chairs (count; regenerate or fix in Figma); fog reads "can't see", not "magic reward"; no faces; no text on folios.

---

### P4. Circle of Competence ring-map hero
- **Where used:** Circle page hero/background.
- **Spec:** 1:1, 1600x1600 WebP, opaque (crop to 16:9 works). Centre 60% holds the ring map; corners free for UI. Dark + parchment variant.
- **Prompt:**
```
Design a screen that is a single full-bleed illustration, no UI chrome, no text. Subject: a top-down view of a drawn ring map on aged parchment, like a surveyor's chart. Concentric circles from the centre outward: the inner zone has a thick solid gold ink ring (#D6A85A) with fine, dense hatching inside (known ground). A middle band straddles the line: a double ring made of alternating solid and dotted gold segments. The outer zone beyond the line has sparse widely spaced hatching drawn in faint brown ink. At the outermost rim, the edge breaks up into a dashed, ragged cold-grey fog band (unmarked, unsurveyed). A simple star shape at the very centre. Warm candle vignette at the corners, fading to #140F0B. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), parchment #ECE3D0/#F6EFE0; bold simple shapes. AVOID: text, letters, numbers, compass letters, rune glyphs, logos, real people, green or bright-red tints, neon, 3D render, clutter, watermarks.
```
- **Follow-ups:** (1) "Make the three states distinguishable in greyscale: solid line, solid-dotted alternating line, dashed fog." (2) "Remove the centre star; leave a plain empty small circle so the app can place a marker." (3) "Parchment variant: paper #F6EFE0, ink #926218, fog band as neutral grey hatch."
- **Acceptance:** greyscale still separates the three zones by pattern; outer fog not a soft pleasant glow; inside not green; no letters.

---

### P5. Cartographer's table / realm map
- **Where used:** Map page (five fog patches per tower, drawn realm map, commission flags; numbers overlaid by UI).
- **Spec:** 4:3, 2000x1500 WebP, opaque. Bottom 15% and right 20% clear for panels. Phone: centred 1:1 crop. Realm in the middle 70%.
- **Prompt:**
```
Design a desktop screen that is a single full-bleed illustration, no UI chrome, no text. Subject: a cartographer's oak table seen from directly above. A large sheet of aged parchment (#ECE3D0) with a hand-inked map of an original fictional realm: a walled fortress at the centre with small tower marks, a ring-shaped moat, a river, a ridge of hills to the north, and a pattern of simple tree marks. Rolled corners are held down by four small brass weights. Beside the map: a brass divider compass (tool), an inkwell with a quill, and three empty pole-shaped brass flag stands with blank plain cream pennants (no marks on them). Five areas of the map are covered by cold-neutral grey fog patches with dashed ragged edges, so the terrain under them is unreadable. Warm candlelight from the top-left. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), parchment #ECE3D0/#F6EFE0, seal red #7a1d18 only on wax seals; vignette to #140F0B. AVOID: text, letters, place names, numbers, rune glyphs, logos, real geography, real people, green or bright-red tints, neon, 3D render, clutter, watermarks.
```
- **Follow-ups:** (1) "Fewer map details, bigger shapes; the central fortress must read at 300px wide." (2) "Make the fog patches uniform in size so they read as five distinct patches." (3) "Remove all objects from the right edge; leave only dark table wood."
- **Acceptance:** exactly 5 fog patches; no place names; fog not decoratively pretty; terrain not green. (Fog is data in the app: do not use a painting with baked fog patches.)

---

### P6. Fog patch tile (transparent overlay)
- **Where used:** fog on towers, map regions, Circle rim, Council alcove.
- **Spec:** 1:1, 1024x1024 PNG with alpha → WebP lossless (~80 KB). Cold-neutral grey #8a8d8f at 40-70% opacity, 5 variants. Same asset for dark and light.
- **Prompt:**
```
Design an image that is a single isolated illustration on a fully transparent background (if transparency is not possible, a flat pure white #FFFFFF background that is easy to key out), no UI chrome, no text. Subject: five separate patches of dry-brush painted fog, each a ragged cloud shape with a visibly dashed, broken outer edge, arranged in a 3x2 grid (leaving one cell empty). Colour: cold neutral grey #8a8d8f with lighter #c9cbcc streaks, soft and semi-transparent, with a faint diagonal hatching texture inside so it reads as a pattern as well as a shade. It must look obscuring and unknown, not magical or pleasant. STYLE: hand-painted gouache/oil, matte, soft brush grain, desaturated. AVOID: text, letters, numbers, glow, sparkle, green or bright-red tints, neon, hard black outlines, gradients that fill the whole canvas, watermarks.
```
- **Follow-ups:** (1) "Make every patch's outer edge more clearly dashed and ragged." (2) "More transparent in the middle (~55%), denser at the edge." (3) "One patch as a long horizontal band, 4:1."
- **Acceptance:** works over dark and parchment; visible in greyscale thanks to hatch + dashed edge; no gold/warm glow; clean alpha edges.

---

### P7. Parchment panel texture (seamless tile)
- **Where used:** panels, cards, folios.
- **Spec:** 1:1, 1024x1024 WebP, opaque, seamless. Light (#ECE3D0 / #F6EFE0) and dark leather-paper (#1F1812 / #2A2119). Low contrast.
- **Prompt:**
```
Design an image that is a flat seamless tileable texture, no UI chrome, no text, no objects, no border. Subject: aged parchment surface, very low contrast, fine fibre grain and faint mottling in #ECE3D0 and #F6EFE0, with no creases, tears, stains, burn marks or vignette. Edges must match opposite edges so the texture tiles seamlessly. STYLE: hand-painted, matte, soft brush grain, faint paper tooth. AVOID: text, letters, numbers, rune glyphs, visible borders, folds, coffee stains, green or red tints, lighting gradient across the canvas, watermarks.
```
- **Follow-ups:** (1) "Reduce contrast by half; darkest and lightest differ by <6%." (2) "Dark variant: same fibre pattern, base #1F1812 varying toward #2A2119." (3) "Make the grain finer by half."
- **Acceptance:** tile 3x3, no seams or repeating blotches; body text #2a1a06 on light and #EEE4D3 on dark stays above 7:1. Stitch likely won't guarantee seamlessness; fix with Photopea Offset filter.

---

### P8. Wax seal set
- **Where used:** report scrolls, council folios, commission seals (never as status colour).
- **Spec:** 3:1 sheet, 1800x600 PNG with alpha; 6 seals, 256x256 each, readable at 44px. One red (#7a1d18); differences come from emblem and edge shape only.
- **Prompt:**
```
Design an image that is a single sprite sheet on a fully transparent background (if not possible, flat white #FFFFFF to key out), no UI chrome, no text. Six round wax seals in a row, each about the same size, seen from directly above, dark red #7a1d18 with a slightly lighter edge highlight and a darker centre imprint. Each seal has a different simple raised emblem and edge: (1) tower, smooth round edge; (2) shield with a crack line, scalloped edge; (3) closed eye shape, ragged edge; (4) crossed keys, round edge with a notch; (5) hourglass, smooth edge; (6) blank seal with no emblem, with a small tear in the wax. STYLE: hand-painted gouache/oil, matte, soft brush grain, desaturated. AVOID: text, letters, numbers, rune glyphs, logos, green tint, bright-red, glossy plastic look, 3D render, shadows that bleed beyond the seal, watermarks.
```
- **Follow-ups:** (1) "Make each emblem bolder and ~30% larger within the seal." (2) "Add a neutral flat soft shadow under each seal as a separate layer if possible." (3) "Render again in parchment-friendly lighter wax #8b2a22."
- **Acceptance:** each emblem identifiable at 44px; none implies approval/rejection by colour; no letters.

---

### P9. Crest / banner emblem
- **Where used:** page-header crests, loading screen, favicon source, banner cloth.
- **Spec:** 1:1, 1024x1024 PNG with alpha, plus a simplified one-colour variant for SVG tracing. Readable at 32px.
- **Prompt:**
```
Design an image that is a single isolated emblem on a fully transparent background (or flat white to key out), no UI chrome, no text. Subject: a heraldic crest: a shield with a simple crenellated tower shape in the centre, ringed by a thin circle (a moat ring) at the bottom third, topped by a small raven silhouette perched on the shield's upper edge. Fill: aged gold gradient from #fff0b8 (top-left highlight) through #d9a93e to #6e4a12 (bottom shadow), engraved-metal look, matte, dark iron backing #2A2119. Flat symmetrical frontal view. Generate a second version below it: the same crest as a single flat solid gold shape on transparent, no gradient, for vector tracing. STYLE: hand-painted gouache, bold silhouettes. AVOID: text, letters, numbers, crown with jewels, lions, eagles, real coats of arms, real logos, green or bright-red tints, 3D render, watermarks.
```
- **Follow-ups:** (1) "Simplify so tower and raven read at 32px; remove all inner ornament." (2) "Remove the raven; tower and ring only." (3) "Add a plain empty banner cloth hanging from a pole, ready to hold the crest."
- **Acceptance:** not a copy of a real coat of arms; flat variant traces cleanly to SVG; no text.

---

### P10. Room tab-strip emblem set (8 icons)
- **Where used:** room tab strip (assumed: Fortress, Council, Circle, Cartographer, Records, Chronicle, Siege, Marketplace; confirm).
- **Spec:** 8:1 sheet, 2048x256 PNG with alpha. Eight emblems on identical 256x256 grid, 24px padding, same stroke weight, readable at 44px and 24px. Gold on dark, plus mono-gold variant for SVG tracing.
- **Prompt:**
```
Design an image that is a single icon sheet on a fully transparent background (or flat white to key out), no UI chrome, no text. Eight emblems in one horizontal row on an identical square grid with equal spacing, each in aged gold (#D6A85A, highlight #fff0b8, shadow #6e4a12) inside a thin round gilded ring on a dark iron disc #2A2119. Emblems, simple bold silhouettes with the same stroke weight: (1) fortress tower; (2) round table with eight dots; (3) three concentric rings with a dashed outer ring; (4) unrolled map with a compass divider; (5) closed scroll; (6) open book with a quill; (7) tent beside a banner pole; (8) market stall with an awning. STYLE: hand-painted gouache, matte, bold simple silhouettes, no outlines. AVOID: text, letters, numbers, extra detail, glow, green or bright-red tints, real logos, 3D render, watermarks.
```
- **Follow-ups:** (1) "Strokes 20% thicker; remove interior detail below 4px." (2) "Flat one-colour #D6A85A version of all eight for SVG tracing." (3) "Second row with active state: same icons with a #fff0b8 inner ring."
- **Acceptance:** all eight distinguishable at 24px in greyscale; consistent stroke weight; Stitch won't hold an exact grid, so re-slice and align in Figma.

---

### P11. Siege weather backdrops (calm / gathering / besieged)
- **Where used:** Siege simulator and fortress scene far hills.
- **Spec:** 21:9, 2520x1080 WebP, opaque, 3 files. Lower 35% free. Enemy on the far hills (middle band) only. Dark mode primary.
- **Approach:** generate the **calm** plate once, reuse as reference for the other two. AI counts are unreliable: verify, or composite sprites (P11b) for exact numbers (gathering = 3 tents / 7 soldiers; besieged = 7 tents / 20 soldiers / 3 engines / 5 fire-arrow arcs, per `siegeCamp()` in the app).
- **Shared base (add one block below):**
```
Design a wide desktop screen that is a single full-bleed illustration, no UI chrome, no text. Subject: a view across a river valley to a far ridge of dark rolling hills under a flat overcast sky, painted in layered hazy bands, with a thin gilded rule along the top edge. The same composition, light and palette in all three versions; only the enemy camp differs. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), neutral warm greys; one dim warm light; vignette to #140F0B. AVOID: text, letters, numbers, banners with symbols, real people, green or bright-red tints, neon, gore, cartoon/anime, 3D render, clutter, watermarks.
```
- **Block A, calm:** `ENEMY: none. The far hills are completely empty: no tents, no people, no smoke. Do not add any fog patches on the hills.`
- **Block B, gathering:** `ENEMY: exactly 3 small canvas tents on the far hills and 7 tiny soldier silhouettes standing in loose groups, a few dark pennants on short poles, one thin camp fire smoke line. No siege engines, no fire.`
- **Block C, besieged:** `ENEMY: exactly 7 canvas tents and 20 tiny soldier silhouettes in ranks, 3 large wooden siege engines (trebuchet, ram frame, siege tower) with simple silhouettes, and 5 small fire arrows in flight drawn as thin streaks in warm #D6A85A with #fff0b8 tips; low heavy smoke across the ridge. No red.`
- **Follow-ups:** (1) "Keep sky and hills identical to the first image; change only the camp." (2) "Make tents and soldiers 25% larger so counts are easy to read." (3) "Make the calm version slightly paler so it doesn't look like a safe-green meadow; keep neutral greys."
- **Acceptance:** counts match; calm has no enemy and isn't tinted pleasant; state readable without colour; no red/green.
- **P11b (sprite layer, transparent):** `Design an image on a transparent background: a sheet with one canvas tent, one soldier silhouette, one trebuchet, one battering-ram frame, one siege tower, one fire-arrow streak, each isolated and in a consistent style (bible as above).` Composite into the calm plate in code/Figma.

---

### P12. Chronicle / Records header
- **Where used:** top of Chronicle and Records (two crops from one illustration).
- **Spec:** 20:3, 2400x360 WebP, opaque; same safe zones as P2.
- **Prompt:**
```
Design a wide desktop banner screen that is a single full-bleed illustration, no UI chrome, no text. Aspect 20:3. A dark library wall painted in layers. At the left third, rows of rolled scrolls in pigeonholes, each with a tiny dark-red wax seal. At the right third, a lectern with an open blank ledger and a feather quill in an inkwell. A brass hourglass sits beside the lectern. The centre 50% is a calm empty stretch of dark stone wall (#2A2119) left blank for a title. STYLE: hand-painted gouache/oil, matte, soft brush grain, faint paper tooth, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), seal red #7a1d18 only on wax seals; one warm candle, vignette to #140F0B. AVOID: any text or letters on pages or spines, numbers, rune glyphs, logos, real people, green or bright-red tints, neon, 3D render, clutter, watermarks.
```
- **Follow-ups:** (1) "Ledger pages blank, only faint ruled lines." (2) "Chronicle variant: replace the scroll shelf with a hanging timeline cord with six plain blank tags." (3) "Reduce detail in the centre 50% by 50%."
- **Acceptance:** nothing readable on pages; centre dark enough for overlay text; hourglass doesn't signal urgency.

---

### P13. Advisor portrait set (Oracle, Partner, Sal)
- **Where used:** chat avatars, council seats, advisor cards.
- **Spec:** 1:1 each, 768x768 PNG/WebP, opaque, one consistent style. Readable at 64px. Face centred in the top 60%.
- **Prompt (pick one CHARACTER line):**
```
Design a square screen that is a single full-bleed portrait illustration, no UI chrome, no text. Subject: bust portrait inside a thin gilded oval frame on a dark #1F1812 background, shoulders in a three-quarter view, soft candle light from the left. CHARACTER: [pick one]
ORACLE: an original elderly scholar with a long grey-cream beard, deep-set calm eyes, a plain dark hooded robe with a single small gold brooch in the shape of an eye; a faint pale halo of fog behind the head.
PARTNER: an original middle-aged person with short grey-streaked hair, a patient look, a dark scholar's coat with gold buttons and a folded blank scroll tucked in the belt.
SAL: an original young quick-eyed clerk with a short cap, ink-stained fingers, a satchel strap, a quill behind the ear and a slightly wry half-smile.
Original characters, not based on any real person, actor, or known character. Keep expressions neutral and honest, not flattering. STYLE: hand-painted gouache/oil, matte, soft brush grain, desaturated; palette only #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A (hi #fff0b8, shadow #6e4a12), skin tones in warm muted browns; vignette to #140F0B. AVOID: text, letters, numbers, logos, real people or celebrities, photoreal faces, cartoon/anime, glowing eyes, smiles that imply approval, green or bright-red tints, watermarks.
```
- **Follow-ups:** (1) "Simpler face, larger shapes, reads at 64px." (2) "Same lighting and framing as the other two portraits." (3) "More neutral expression: no smile."
- **Acceptance:** three distinct silhouettes at 64px; none resembles a real person; no expression implying good/bad news; no text. (Check the existing in-app advisor designs first; these are descriptions of intent, not of the current portraits.)

---

### P14. Raven and lamp/genie sprites (transparent)
- **Where used:** raven = new reports; lamp + genie = assistant button and chat.
- **Spec:** 2:1 sheet, 2048x1024 PNG with alpha, 2 rows. Row 1: raven in three poses (384px each). Row 2: lamp closed, lamp with smoke wisp, genie bust rising from smoke. Static only.
- **Prompt:**
```
Design an image that is a single sprite sheet on a fully transparent background (or flat white to key out), no UI chrome, no text. Row one: a raven in three poses, perched, wings folded; wings spread in flight; head turned, each as a bold dark silhouette in #1F1812 with a faint #EEE4D3 rim highlight and a tiny gold #D6A85A eye. Row two: a small brass oil lamp with a curved spout, closed; the same lamp with one thin cream smoke wisp rising; and a stylised friendly genie bust rising from the smoke, in a plain turban, with a calm attentive expression, skin in warm muted brown, smoke tail below. Original designs, no resemblance to any existing film or franchise character. STYLE: hand-painted gouache/oil, matte, soft brush grain, bold silhouettes, no outlines; palette #140F0B #1F1812 #2A2119, cream #EEE4D3, aged gold #D6A85A. AVOID: text, letters, logos, blue skin, neon, sparkles, green or bright-red tints, 3D render, shadows beyond the sprite, watermarks.
```
- **Follow-ups:** (1) "Raven more compact and simple so it reads at 48px." (2) "Genie more neutral, less smiling; no sparkles." (3) "Repeat the sheet as flat #D6A85A silhouettes for tracing."
- **Acceptance:** clean transparent edges on dark and parchment; genie copies no known character (no blue skin); raven carries no alarming connotation. (The app already has `RavenMark.tsx`, `MagicLamp.tsx`, `GenieArt.tsx`; these would replace or supplement procedural SVG. Keep the SVG as fallback.)

---

### P15. Iron game-frame corner pieces
- **Where used:** dark iron game frame with gilded rule and four cast corners.
- **Spec:** 1:1, 512x512 PNG with alpha, one top-left corner (mirror/rotate in CSS), plus a 1024x64 iron edge strip. Inner 70% free; works at 48px.
- **Prompt:**
```
Design an image that is a single isolated corner piece on a fully transparent background (or flat white to key out), no UI chrome, no text. Subject: the top-left corner of an ornate cast-iron picture frame, seen frontal. Dark iron #2A2119 with a thin aged-gold rule #D6A85A along the inner edge, a small raised round rivet at the corner, a simple stepped crenellation motif, and a tiny tower silhouette in relief. The two arms of the frame extend straight to the canvas edges, 12% of canvas width thick, so they can be extended in CSS. Matte, hand-painted metal with soft highlights in #fff0b8 on the top-left edges. STYLE: hand-painted gouache/oil, matte, bold silhouettes, no outlines. AVOID: text, letters, numbers, filigree swirls, skulls, real logos, rust-red, green tints, glossy chrome, 3D render, watermarks.
```
- **Follow-ups:** (1) "Simplify: remove the tower relief; keep rivet and step motif." (2) "Arms perfectly straight and constant width so they can repeat." (3) "A straight edge segment of the frame, 1024x64, tileable horizontally."
- **Acceptance:** arm cross-section constant; no rust-red; mirrors cleanly; readable at small size.

---

## 4. Integration notes

- **Folder:** `frontend/public/art/` with `anchor/ banners/ rooms/ siege/ textures/ sprites/ portraits/ frame/`; masters in `_source/` outside `public/`.
- **Naming:** `<group>-<name>-<variant>@<scale>.<ext>` (e.g. `banner-page-dark@2x.webp`, `siege-calm-dark.webp`). A `manifest.json` records prompt id (P1-P15), model, date, Stitch project link.
- **Formats/budget:** WebP q80-85 for scenes; PNG alpha → lossless WebP for sprites/fog. Banners <150 KB, heroes <300 KB, tiles <60 KB. Lazy-load below the fold; fixed width/height to avoid layout shift.
- **Dark/light:** separate files where lighting matters (banners, textures); CSS tint for sprites/fog.
- **Handoff:** image files plus a README (file, intended size, safe zone, alt text). Alt text states the fact in words ("enemy camp: 3 tents, 7 soldiers") so meaning never depends on colour or the image alone.
- **SVG fallback (required):** crest, tab emblems, seal emblems, ring-map lines, frame corners get an SVG (trace the one-colour variants from P8-P10 with Figma/Illustrator/potrace). Components render the SVG if the raster fails.
- **Pre-merge checklist:** no baked text; no green/red verdict colour; greyscale test; 44px test; counts verified for P3 (8 chairs), P5 (5 fog patches), P11 (3/7 and 7/20); static art only.
- **Repo hygiene:** pre-commit blocks document uploads outside `docs/`; images in `frontend/public/art/` should pass. No real portfolio data in any asset.

## 5. Open questions for Faiz

1. Is the tab strip exactly Fortress, Council, Circle, Cartographer, Records, Chronicle, Siege, Marketplace? (Changes P10.)
2. Exact counts: composite sprites in code/Figma (recommended) or one painted image per state with manual checks?
3. Is it OK to use Gemini/Imagen (Nano Banana) for P6-P9, P14, P15 (transparency, tiles, sprites) and Stitch for scenes?
4. Light mode: parchment variants for every scene, or only banners and textures (cheaper)?
