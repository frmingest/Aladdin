# Marketplace landscape: concept and Stitch object list (2026-10-17)

Status: **brief, nothing built, nothing deployed.** Written for Faiz to generate the pictures in Google Stitch. Inputs: game-designer, game-ux-designer and game-feel-engineer reviews (2026-10-17), the existing art manifest and `docs/game/stitch-master-object-art-2026-10-11.md` (style, truth rules, review checklist: still in force).

## 1. Direction

**Visual verb + scene:** *Stroll.* You walk from the town gate up a cobbled street to a fountain square; Sal's counter and the Hype Booth stand on the square, the market hall closes the view. Stalls are the existing teal-and-cream pictures standing on a landscape instead of in cards.

- **Vertical street**, gate at the bottom, square at the top, skyline behind. No sideways scroll (phone friendly).
- **Stalls stand on a grid of plots**, any count 3 to 30+ (street order stays: in range, then nearest, then name; brass numeral stays). Empty plots are code-drawn "plant your stakes" outlines. Every 3 lanes a prop (well, lamp, signpost) breaks the rhythm.
- **Ground is drawn by code** (gradient plus a tiny SVG cobble pattern, 0 KB). Stitch tiling is unreliable, so no ground tile is requested.
- **Each stall is a real link**; name, tone word and signed gap are always printed on a plate under it (never hover-only); the full ledger opens on focus/tap. **Plain view** (today's grid) stays behind a toggle and is the fallback if art fails.
- **Pictures carry no fact.** Code draws: pennant on a bare pole (shape plus word per tone), price stake, pips, verdict plaque, owned bunting, age chalk, fog, HUD plates hung from the gate. No crowds, villagers, weather or damage.

Existing pictures reused as-is (do not regenerate): 4 stalls (smithy, armoury, provisions, goods booth), 3 small booths, market hall, Sal's counter and busts, 5 shopkeeper faces, well, pines, bush, haystack.

## 2. What to generate

Paste the shared block from `stitch-master-object-art-2026-10-11.md` section 5 at the start of every prompt and attach `spire-granite` plus one existing stall as style references. Ask for square; we crop. One object per image, pure white background, no text.

### MUST (8)

| # | Object | Prompt subject line (after the shared block) | Used for |
|---|---|---|---|
| M1 | **Town gate** | `Subject: a wide stone-and-timber street gate: two round stone gate posts joined by an arch with a plain empty wooden bar hanging under it, open passage, teal roof tiles on the posts, no doors, no flag, no lettering.` | Street entrance; HUD plates hang from it (code) |
| M2 | **Rooftop skyline** | `Subject: a long row of town rooftops seen from the front: timber-and-plaster houses with teal tiled roofs, chimneys, a few dormers, one slightly taller roof in the middle, flat straight bottom edge, 3:1 wide, no sky, no people, no smoke, no text.` | Backdrop strip at the top (keyed; opaque fallback ok) |
| M3 | **Fountain** | `Subject: a round tiered stone fountain, wide low basin, a short centre column and a small top bowl, still pale-teal water, no figures, no coins, no spray.` | Centre of the square; Sal and Hype stand beside it |
| M4 | **Street lamp post** | `Subject: a tall slim iron street lamp post with a scrolled arm and a small brass lantern, glass dark and unlit, narrow stone base.` | Block junctions (code can add glow) |
| M5 | **Blank signpost** | `Subject: a wooden signpost with two blank arrow-shaped boards pointing opposite ways, nothing written, set in a small stone footing.` | District signs (code prints the words) |
| M6 | **Cobble square patch** | `Subject: a round patch of grey flagstone paving, worn and slightly uneven, a few moss cracks at the edge, seen from above at about 30 degrees, flat, no objects on it.` | Floor of the square under the fountain |
| M7 | **Crates and barrels** | `Subject: a small cluster of wooden crates and two barrels with iron bands, closed lids, no goods spilling out, no sacks.` | Fills gaps between stalls |
| M8 | **Hype Booth tent** | `Subject: a small round-topped fairground tent in teal and cream stripes with a brass horn on a pole at the front, closed flap, plain blank chalkboard on a stand beside it, no text.` | The Hype Booth has no picture today |

### SHOULD

- **S1** Round leafy tree, teal-green leaves (pairs with the pines).
- **S2** Low stone wall or timber fence section, 3:1, tiles sideways (lane edges).
- **S3** Handcart: two-wheeled wooden cart with a few cloth-covered bundles, no horse, no figure.
- **S4** Wooden bench with a plain back.
- **S5** Stall variant: open cart-style stall, cream awning, **unlit** lantern, no flag.
- **S6** Stall variant: tall two-storey shopfront stall with a shuttered hatch, no flag, unlit lantern.

### NICE (only if the street feels thin)

Stone steps up to the square; a washing line; a second market-hall angle; hedge row. A cat or pigeons need your OK (animals).

### Watch for when judging results

- Stitch adds sky, sun, shadow, fog or people: reject (checklist in the master doc section 3).
- White halo on cream walls after keying (skyline, gate): if it shows, we use the opaque version or a code roofline.
- Perspective must match the stalls (about 30 degrees, light from top left).

## 3. Heads-up on the existing stalls

The four stall pictures show **glowing yellow lanterns baked in**. A lit/unlit lantern therefore cannot encode status on them. Plan: tone is a **pennant on a code-drawn pole plus printed word and stake**, never the lantern. S5/S6 are drawn with unlit lanterns so a code glow could be used on those only.

## 4. Decisions needed from Faiz

1. **Unpriced stores** (no price of yours, no price, different currency): designer wants them standing in a **fog lane** at the far end as full stalls; UX reviewer wants them in a **"Quiet stalls" row** after the street (as the collapsed list today). Recommendation: fog lane, always visible, still tappable.
2. **Which stall a company gets:** keep the stable pick by id (pure variety), or pick by **sector** (smithy for industrials, provisions for staples). Sector is a real fact drawn honestly; recommendation: by sector once S5/S6 exist.
3. **Orientation:** vertical street (recommended) or sideways street.
4. **Villagers:** none for now (they read as popularity). Confirm.

## 5. Page copy (game voice, proposed)

Title "Market Street"; subtitle "Who's near your price?"; Sal: "Ask Sal for a stall"; Hype: "Hear the hype" (caveat in tooltip); empty: "No stalls yet. Sal can raise one."; stall plate: "In range · +3%", "Above · +12%", "No price", action "Step inside". The long subtitle and the 4-line legend go; at most a 4-item inline key.

## 6. Build order (after the pictures arrive)

1. Pack M1-M8 (`scripts/art/pack.py`, key mode; register in `artManifest.ts`). 2. Scene shell: code ground, skyline, gate, square with Sal and Hype. 3. Plot grid with stalls, plates, focus ring, Plain view toggle. 4. Code overlays (pennant, stake, pips). 5. Screenshots at 390 px and desktop, identity score before/after (now 2, target 3). Branch `feature/market-street`, PR against `main`, not merged by Claude.
