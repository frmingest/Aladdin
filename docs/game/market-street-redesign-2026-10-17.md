# Market Street redesign: critique and spec (2026-10-17)

Status: **built on `feature/market-street` (written and tested, not deployed).** Decisions D1-D7 taken as recommended. Two changes after the spec: plates show only the name, and a stall is a button that opens its card in place (tone, gap, ticker, pips, "Step inside"); stall art is 12.5 rem tall (square scaled down to cost less scroll). Original status: spec only. Covers the Game-mode Market Street on branch `feature/market-street` (PR #173), files `frontend/src/components/marketplace/MarketStreet.tsx`, `street.css`, `frontend/src/lib/marketStreet.ts`. Comes after `docs/game/marketplace-landscape-2026-10-17.md` (concept and Stitch list, still in force) and keeps the rules of `docs/game/stitch-master-object-art-2026-10-11.md`.

Trigger: Faiz looked at the live street (demo data, 2 stalls) and said "it's not looking good, we need to improve it". Inputs: his four screenshots (top of page, square plus first stall, second stall, gate), the code above, and the packed pictures in `frontend/src/assets/art/`.

**Visual verb + scene:** *Stroll down the lane.* A short rooftop band and the fountain square form the scene header. Below it **one cobbled lane runs down the middle of the page, with stalls on both sides facing it**. The gate closes the lane at the bottom. Mapping (pure, `lib/marketStreet.ts`): `status -> district (which stretch of the lane)`, `street order -> distance from the fountain` (closer to the fountain = closer to your price), `tone -> flag shape + printed word`, `no price -> the fog stretch at the gate end`. Unknown look: code-drawn mist over the fog stretch, a dashed-ring flag, the word "No price". Words it deletes: the demo/ticker hint strip, "Step inside →" on every plate, the "· yours" ledger line on the plate face, the dark district heading plates (the signpost board says it). Identity score: **2 before (as seen live), 3 after (target).**

---

## 1. Critique: what is wrong in the screenshots

Ranked by how much each one hurts the first look.

1. **The skyline is the whole first screen.** `.ms-skyline` is `width: 100%; height: auto` on a 900x286 picture. At about 1,150 px of content width it is about 365 px tall, plus a 2 rem sky pad. Add the page header and the HUD and the first stall starts two screens down. The page says "rooftops", not "market".
2. **There is no street.** The districts are stacked sections, each a centred `auto-fit` grid of 12 rem plots. With 1 stall per district, every stall sits alone in a centred column with about 40 rem of empty tan on each side. Nothing reads as a lane, a row or a place you walk.
3. **The ground reads as fabric, not cobbles.** The 64 px SVG tile is crossed S-curves at 11% ink. Under the extra top-to-bottom gradient it shows as horizontal bands and a basket weave. Stalls look pasted on a tablecloth.
4. **The plates are dark UI cards.** They are a raised/surface theme gradient with a 4 px tone edge and a hard 3 px ink drop, under a painted daylight picture. They carry 7 lines (name, ticker, tone and gap, price · yours on two lines, five pips, the verdict badge, "Step inside →"). Each plate is wider than its stall and about as tall. This is the "Card with a list" anti-pattern placed on a painting.
5. **Scale is broken on the square.** The fountain is 18 rem wide. Sal's counter shows at about 140 px and the Hype tent at about 130 px, so both look like toys beside it. The buttons look like app buttons (one gold, one dark: two styles side by side). The cobble patch is drawn at the same box as the fountain (`inset: 0`), and the fountain picture (72% wide, its own stone rim) covers it, so no paving shows.
6. **Props float.** The lamp, tree and signpost sit at the far left/right edges of the frame, away from any stall or lane. They stand on no shared baseline, at random sizes compared with the stalls (lamp 40 px wide beside a 136 px stall, tree 104 px). They read as stickers, not furniture.
7. **Copy drift.** The same fact goes by three words: HUD "Within 10% of it", district "Near your price", flag "Near". Also HUD "Stores open" against "stalls" everywhere else. The dark "Demo mode is on: the street is painted scenery." strip repeats the yellow site banner and covers the square.
8. **A word rule slips.** The plate face shows the stored analyst verdict as the word **"Buy"** / "Hold" (`VerdictBadge`). Game mode is meant to carry no buy/sell wording on its face. The verdict is already one of the five pips. Decision D2 below.
9. **The market hall picture says "Sale".** `market-hall.webp` has the word *Sale* painted on its sign. It is not used on the street today and must not be: it is text in a picture and it is selling wording.

What works and stays: the stall pictures, the code-drawn flags (shape plus word per tone, colour never alone), the gate with its fences, the fog idea, the Street/Plain switch, a real link per stall with a one-sentence `aria-label`, and the title and subtitle ("The Marketplace", "Who's near your price?").

## 2. What a player should feel

> "I'm at the top of a small market street. I can see the whole lane at a glance: the stalls by the fountain are the ones near my price, and it gets quieter and foggier toward the gate."

- **Arrival, not a banner.** The square and the first row of stalls are on the first screen at 1366x768 and above, and the first stall is on the first phone screen at 390x844.
- **Place means something.** Walking down the lane = moving away from your price. That is the one fact the composition carries; the flag and the plate word confirm it.
- **Calm, not a bazaar.** No crowds, no glow for "good", no motion. A few stalls look like a quiet lane, not a broken page. Thirty stalls look like a busy lane, not a wall of cards.
- **Read first, step in second.** Each plate says who, which flag and how far, in about 3 short lines. Everything else is inside the store.

## 3. The spec (template from `game-design-reward-knowing`)

| Field | Spec |
|---|---|
| Player verb | Stroll the lane, read the flags, step into a stall. |
| Real fact surfaced | Each watchlist company's stored status against the price you named (`status`: buy_zone / near / above / unpriced) and the signed gap (`distance_to_buy_pct`), in street order (`orderStreet`: in range, then smallest gap, then name). |
| Feedback | Position in the lane (distance from the fountain), flag shape plus printed word, signed gap printed on the plate, gate pips on the plate. Hover/focus lifts the stall 3 px and shows the focus ring (no animation under reduced motion). Nothing else changes. |
| Unknown / stale | No price, no price of yours, or a different currency: the stall stands in **the fog stretch** by the gate, paler, under code-drawn mist, dashed-ring flag, word "No price", plate gap omitted (never "0%"). Unknown gates show as dashed pips. Price age stays on the header `SnapshotStamp` ("Restock prices" refreshes). The street never draws stale prices as fresh, and no picture changes with price age. Loading: "Setting up the stalls…". Error: the existing `LoadError`. Empty: square plus gate, with one line in the lane "No stalls yet. Sal can raise one." |
| Rules kept | Read-only (stalls are links to the store, no action on the street). Deterministic (layout is a pure function of the ordered rows and the plots per side; prop picks come from the row index or a hash, never random at render). Unknown stays unknown (fog, dashed ring, "No price"; never a default-good flag). No buy/sell wording on the face (see D2; the market hall picture is never used). Demo mode wins (demo data only, the site banner says so; no extra strip needed). Truth over flattery (the fog stretch is always visible and never hidden behind a fold; a far-off stall is not drawn smaller or shabbier). Pictures carry no fact. Shape plus word per tone. Plain view keeps the same facts. |
| Rewards rejected | No counters of "stalls in range" as a score, no glow or fanfare when a stall enters range, no "visit daily", no streaks, nothing that makes acting feel better than waiting. |
| Cheapest prototype | CSS and layout only, behind the existing Street view: crop the skyline, swap the ground, the lane grid, the parchment plate. No new pictures. About 1 day. |
| How we will know it is good | Playtest question for Faiz: "Without reading, which stall is closest to your price, and which ones have no price?" A second one: "Does it look like one street, or like cards on a background?" |
| One thing to cut | The between-district `Furniture` rows and the every-5 `ms-decor` plots. Props move to fixed places in the lane grammar (section 5). |

## 4. Layout

### 4.1 Vertical budget (desktop 1366x768, after the app header)

| Band | Height | Contents |
|---|---|---|
| Page header + HUD | about 8 rem (as today, HUD on one line) | Title, subtitle, Street/Plain, stamp, Restock; HUD 4 plates |
| **Scene header** (skyline band + square) | **max 17 rem** | Rooftops cropped to a short band; the square in front of them |
| Lane rows | 13.5 rem per row | Stalls both sides of the lane |
| Gate | 9 rem | Gate across the lane, fences out to the edges |

The first stall row's top edge must be at or above 30 rem from the page top on desktop (it is about 75 rem today).

### 4.2 Scene header (compact)

- **Skyline band:** the `market-skyline` picture at `width: 100%`, `height: clamp(5.5rem, 11vw, 9rem)`, `object-fit: cover`, `object-position: 50% 0` (keep the roof peaks and chimneys, crop the lower walls). The sky above the roofs is a 1 rem gradient strip, not 2 rem plus a gradient behind the whole picture. The square's back kerb (a code-drawn 0.5 rem stone edge) overlaps the bottom 1.5 rem of the band so the crop never shows.
- **The square** sits on the ground in front of the band, one row, baseline-aligned: **Sal's counter | cobble patch with the fountain | Hype tent**. No wrap on any width. On phones all three shrink by the same factor.
- **Cobble patch visible:** the patch is the floor, not a frame behind the fountain. Patch width = 1.9x the fountain width, drawn first, centred under the fountain. The fountain's base sits at 62% of the patch height, so a ring of paving shows in front of and around the basin. Sal and the tent stand on the patch's left and right rims (their bottom edge at 75% of the patch height), so the paving joins all three.
- **Buttons as hanging boards:** "Ask Sal for a stall" and "Hear the hype" use **one** style: a code-drawn wooden board (timber fill, ink outline, two short rope lines) under each figure. Sal's board has the gold rim (primary action), the Hype board a plain timber rim. They stay real `<button>`s with the current refs and focus return.
- **Hint strip deleted.** In demo mode the yellow site banner already says the data is painted. In live mode the ".OL" ticker tip moves into Sal's dialog, next to the ticker field, where it is needed.

### 4.3 The lane (works for 2 stalls and for 30)

A three-column grid: `[left side] [lane] [right side]`.

- **Lane:** code-drawn cobbles (section 6), width `clamp(2.75rem, 9vw, 7rem)`. It runs from under the square to the gate without a break. Districts are marked *in* the lane, not by section headings.
- **Sides:** each side holds `perSide` plot columns. A plot is `12.5rem` wide at stall scale 1.0. Plots face the lane, so the inner column (next to the lane) fills first.
- **perSide (pure function, `lanePlots`):**
  - total stalls <= 6: `perSide = 1` on every width (a small street stays narrow and close);
  - total stalls > 6: `perSide = 2` at >= 1024 px, else 1.
- **Scene width = what the plots need**, centred in the page: `2 x perSide x 12.5rem + lane + 2 x 3rem edge`, capped at the content width. The skyline band, square and gate span the same width. For 2 stalls that is about 38 rem: a compact painted panel, not 70 rem of tan. (With `perSide = 2` it is about 62 rem.)
- **Fill order inside a district:** left-inner, right-inner, left-outer, right-outer, then the next row. **A district's first stall goes on the side opposite the previous district's last stall,** so a run of 1-stall districts zigzags down the lane instead of stacking on one side.
- **Each district starts a new row.** Between districts runs a **cross-street**: a 1 rem strip of the same cobbles across the full width, with a kerb line. That is the district boundary; no heading card.
- **District sign:** the `market-signpost` picture stands **in the lane** at the start of the district's first row (lane-centred, 0.6x stall height). Its board is code-printed: district word plus count, e.g. "In range · 1". On phones (lane under 4 rem), the board text moves onto the cross-street as a small code-drawn plank across the lane, and the signpost picture is dropped.
- **Phone (390 px):** `perSide = 1`, lane `2.75rem`, plot `minmax(0, 1fr)` (about 9.5 rem), stall scale 0.8. The same zigzag, the same cross-streets. No sideways scroll.

### 4.4 A district with 1 stall

One row. The stall stands on its side's inner plot (the side set by the zigzag rule). The opposite inner plot is a **street-furniture plot** from a fixed cycle by district index, never left as bare ground and never a stall-like picture:

| District index | Filler on the empty side |
|---|---|
| 0 | `market-crates` |
| 1 | `market-bench` |
| 2 | `market-handcart` |
| 3 | `market-tree` |

The filler stands on the same baseline as the stall, at its scale from section 5. With the signpost in the lane between them, a 1-stall district reads as a short stretch of street: stall, sign, crates. The two live demo stalls would look like this: row 1 "In range" with NVIDIA on the left, the signpost in the lane, crates on the right. Then a cross-street. Then row 2 "Further off" with the bench on the left and Costco on the right. Then the gate.

With `perSide = 2` and 1 to 3 stalls in a district, empty outer plots stay bare ground. Only the inner empty plot gets the filler, so the lane edge is always lined.

### 4.5 The fog stretch

The last district (if any stalls are unpriced) sits just above the gate. Code-drawn mist (existing `FogPatch` look, or the current `::after` gradient moved to the whole row band) covers both sides and the lane for those rows. Stalls are desaturated as today and stay links. The signpost board reads "The fog lane · n". It is never collapsed and never hidden.

### 4.6 The gate

`market-gate` straddles the lane at the bottom, centred on the lane. Its passage opening lines up with the lane width (gate rendered at about 2.4x lane width, max 17 rem). The two `market-fence` pieces run outward from the gate posts to the scene edges on the gate's baseline (the right one mirrored). The cobbles run into the gate passage and stop at the bottom edge of the scene.

## 5. Scale of every object (relative to one stall)

Stall height **S = 9.5 rem** on desktop (8 rem on phones). Heights are of the rendered picture; widths follow each picture's aspect.

| Object | Picture | Height | Where it stands |
|---|---|---|---|
| Stall | `stall-*`, `booth-goods`, `market-stall-cart`, `market-stall-shop` | 1.0 S | Its plot, baseline at plot bottom |
| Sal's counter | `sal-counter` | 1.0 S | Left rim of the cobble patch |
| Hype tent | `market-hype-tent` | 1.05 S | Right rim of the cobble patch |
| Fountain | `market-fountain` | 1.0 S (about 1.15 S wide) | Centre of the patch, base at 62% of patch height |
| Cobble patch | `market-cobble` | 1.6 S (about 1.9x fountain width) | Floor of the square |
| Lamp post | `market-lamp` | 1.15 S | Lane edge, both sides, at each cross-street (a pair flanking the lane) |
| Signpost | `market-signpost` | 0.6 S | In the lane, first row of each district (desktop only) |
| Tree | `market-tree` | 1.2 S | Filler plot (index 3), or the outer scene edge every 3rd row when `perSide = 2` |
| Crates | `market-crates` | 0.5 S | Filler plot |
| Bench | `market-bench` | 0.45 S | Filler plot |
| Handcart | `market-handcart` | 0.5 S | Filler plot |
| Gate | `market-gate` | 1.5 S | Across the lane bottom |
| Fence | `market-fence` | 0.4 S | Out from the gate posts |
| Flag (code) | SVG | 0.28 S, pole top at 0.95 S | Right shoulder of the stall roof, as today |
| Plate (code) | parchment board | about 0.45 S | Hangs under the stall, max width 0.95x plot |

All pictures share one baseline per row and one soft contact shadow (an ellipse at 0.25 opacity, 0.12 S tall), so nothing floats. Drop-shadow filters on every picture go; the contact shadow replaces them (cheaper on phones too).

## 6. Ground

- **Sides:** flat packed-earth tan (`--ms-ground-a`) with a very faint large-scale grain: one 160 px SVG of a few scattered pebble dots at 6% ink. No lines, no curves, no top-to-bottom gradient band.
- **Lane and cross-streets:** a code-drawn cobble tile. A 48x32 SVG of running-bond rounded stones (two rows, the second offset half a stone), slate fill (`#9a96a6` at 0.9), ink outline at 30%, mortar gaps showing the tan. A 0.35 rem kerb line (`--ms-ink` at 35%) on each lane edge. 0 KB of pictures.
- **Square:** the `market-cobble` picture (it is round paving and stays the square's floor).
- These are new scene paint values. Add them as variables in `street.css` next to the existing `--ms-*` ones, or move them into the kit tokens (decision for `game-feel-engineer`). No inline hex in the TSX.

## 7. The stall plate

The plate becomes a **parchment hanging board**, not a dark card. It uses the light parchment tokens from the kit (`ParchmentPanel` palette) with ink text, a 1.5 px ink outline, the tone edge kept as a 3 px **top** rule (shape and word still carry the tone), and two short code-drawn pegs joining it to the stall's counter. Same look in the dark and light theme (it is scene paint, like the Fortress). Text contrast must be at least 4.5:1 for every line against the parchment.

Face (3 lines plus pips):

```
[II]  Costco Wholesale              <- name, Marcellus, 2 lines max, ellipsis
      COST · Yours                  <- ticker; "Yours" only if owned (replaces "In your fortress")
      [blunt flag] Above · +9%      <- tone mark + word + signed gap (gap omitted when unknown)
      o x x o o                     <- five gate pips, 14 px
```

- **Moved off the face:** the price ledger "USD 930.00 · yours USD 850.00" goes to the stall's tooltip (`title`) and stays in the `aria-label`, the Plain view and the store. See D3.
- **Deleted:** "Step inside →" on every plate. The whole stall is the link; hover/focus underlines the name and lifts the stall. "Not analysed yet" becomes 5 dashed pips (the same fact, shown as fog).
- **Verdict badge:** see D2.

## 8. Copy (game voice, standard section 6)

One word per fact, used everywhere (HUD, signpost, flag, Plain view headings).

| Place | Today | New |
|---|---|---|
| HUD 1 | Stores open | Stalls |
| HUD 2 | In your price range | In range |
| HUD 3 | Within 10% of it | Near |
| HUD 4 | No price to compare | No price |
| District sign, range | In range | In range · n |
| District sign, near | Near your price | Near · n |
| District sign, above | Further off | Further off · n |
| District sign, fog | The fog lane | The fog lane · n |
| Flag words | In range / Near / Above / No price | unchanged |
| Square buttons | Ask Sal for a stall / Hear the hype | unchanged (Hype caveat stays in the tooltip) |
| Hint strip | Demo mode is on: the street is painted scenery. / ticker tip | deleted (site banner; tip moves into Sal's dialog) |
| Plate action | Step inside → | deleted (whole stall is the link) |
| Plate owned | In your fortress | Yours |
| Empty street | No stalls yet. Sal can raise one. | unchanged, printed on a board in the lane |
| Foldout | Show how to read the street | How to read the flags |
| Foldout body | 3 long lines | 4-item key with the drawn flag marks: "In range · Near · Above · No price", then one pip line "Pips: moat, fair price, your price, analyst word, freshness. Dashed = unknown." |

The "Near" word: the HUD tooltip keeps the exact rule ("within 10% of the price you named"). Plain view and normal mode keep their exact wording.

## 9. Pictures: which goes where

| Picture | Use | Notes |
|---|---|---|
| `market-skyline` | Scene header band, cropped to the top | Opaque fallback acceptable |
| `market-cobble` | Floor of the square | Larger than the fountain (section 5) |
| `market-fountain` | Centre of the square | |
| `sal-counter` | Square, left | Fallback `SalesRep` SVG |
| `market-hype-tent` | Square, right | Blank chalkboard stays blank |
| `stall-smithy`, `stall-armoury`, `stall-provisions`, `booth-goods`, `market-stall-cart`, `market-stall-shop` | Stalls, stable pick by id (`stallArtId`) | No fact; the flag is drawn by code |
| `market-signpost` | In the lane, start of each district (desktop) | Board text by code |
| `market-lamp` | Pairs at the lane edges at each cross-street | Unlit; no glow (glow would read as status) |
| `market-crates`, `market-bench`, `market-handcart`, `market-tree` | Filler plots and, for `perSide = 2`, outer edges every 3rd row | Fixed cycle, deterministic |
| `market-gate`, `market-fence` | Bottom of the lane | |
| `market-booth-1`, `market-booth-2`, `market-booth-produce` | **Not on the street** | They look like stalls; as fillers they would read as stores that are not there |
| `market-hall` | **Never in game mode** | "Sale" is painted on its sign |
| `map-fountain-square`, `map-market-stall` | Map page only | Different scale and angle |

No new pictures are needed for this redesign. Optional later: a straight paving strip or kerb piece from Stitch, only if the code cobbles look too flat in the look-and-judge round (decision D5).

## 10. Pure mapping (to add to `lib/marketStreet.ts`, with tests)

```
lanePlots(districts: District[], width: "wide" | "narrow") -> {
  perSide: 1 | 2,
  rows: Array<{
    districtId: DistrictId,
    first: boolean,               // first row of its district: signpost + lamps at the cross-street above
    left:  Slot[],                // length perSide, index 0 = inner (next to the lane)
    right: Slot[],
  }>
}
Slot = { kind: "stall", row: WatchlistRow, place: number }
     | { kind: "prop", id: "market-crates" | "market-bench" | "market-handcart" | "market-tree" }
     | { kind: "ground" }
```

Tests: 0 rows gives no rows (the square, gate and empty board still render). 2 stalls in 2 districts give 2 rows that zigzag (L stall / R prop, then L prop / R stall). 30 stalls give `perSide` 2 on wide, every stall exactly once, `place` unchanged from `orderStreet`, districts in order range, near, above, fog. The output is the same for the same input, and does not depend on the viewport except through `width`. Props are never stall pictures.

## 11. Plain view, accessibility, performance

- **Plain view:** unchanged facts (today's grid plus the unpriced disclosure). Rename its HUD labels to the same words (section 8).
- **Keyboard order** = street order (`place`), not visual left/right. The DOM order is by place, and the grid places items with explicit `grid-column`, so tab order never zigzags against reading order. Focus ring as today.
- **Screen reader:** `stallLabel` unchanged. Signposts and props are `aria-hidden`. Each district row group gets `aria-label` "In range, 1 stall".
- **Colour-blind:** tone stays shape plus word plus position. The tone top rule is extra, never the only signal.
- **Reduced motion:** the only motion is the 3 px hover lift, which is off under reduced motion.
- **Performance:** fewer pictures per screen than today (the every-5 decor plots and furniture rows go), drop-shadow filters swapped for one contact-shadow pseudo-element, pictures below the fold stay lazy. Check at 390 px on a mid phone with 30 demo stalls.
- **Print:** hidden as today.

## 12. Identity score

| | Score | Why |
|---|---|---|
| Before (as seen live, 2026-10-17) | **2** | Scene pictures, code flags, Plain view, fact in district order. But the plates are dark cards, the layout is a centred card column, the first screen is rooftops, and the copy drifts (blocks a 3). |
| After (target) | **3** | Signature object: the cobbled lane lined with stalls running from the fountain to the gate. It is identifiable from a screenshot, and position in it carries the one fact. Lean game-voice copy. |

## 13. Build order (one PR on `feature/market-street`, after Faiz's decisions)

1. `lanePlots` plus tests (pure).
2. Scene header: skyline crop, square composition with the cobble patch, hanging-board buttons, hint strip removed.
3. Lane grid, cross-streets, signposts, lamps, filler plots, gate alignment. Remove the `Furniture` and `ms-decor` code.
4. Ground paint (sides, cobble tile, kerbs).
5. Parchment plate, copy changes, foldout key.
6. Look-and-judge screenshots (below), identity score in the sprint doc, `docs/README.md` line for this file, `docs/PROGRESS.md` and `claude/progress.md` updated in the same PR (not done in this spec pass).

## 14. Look-and-judge (screenshots for Faiz, one question each)

1. Desktop 1366x768, demo (2 stalls), first screen. *Is the first stall row on screen without scrolling?*
2. Desktop, 30 demo stalls (if the demo set can be widened, or a fixture). *Does it read as one street, or as cards?*
3. Phone 390 px, top. *Do Sal, the fountain and the Hype tent look like the same size world?*
4. Phone 390 px, fog stretch and gate. *Can you tell which stalls have no price without reading the plates?*
5. Plain view, desktop. *Same facts, same words?*
6. Light theme, one plate close up. *Does the plate look painted into the scene or pasted on?*

## 15. Decisions needed from Faiz

- **D1. Small street width.** When there are 6 or fewer stalls, the scene narrows to fit them (about 38 rem for 2 stalls, centred, dark page around it). The alternative is to keep it full width and fill the sides with trees and fences. *Recommendation: narrow; it removes the empty tan without inventing scenery.*
- **D2. The "Buy"/"Hold" badge on the plate.** The stored analyst verdict word shows on the street face. Game mode carries no buy/sell wording on its face, and the verdict is already a pip. Options: (a) remove the badge from the street plate, keep it in the Plain view and inside the store; (b) replace it with the store-level word ("Gates open", "Wait for the price", "Pass for now", "Cannot judge yet"). *Recommendation: (a).*
- **D3. The price ledger on the plate.** Move "USD 930.00 · yours USD 850.00" off the face into the tooltip, Plain view and store, keeping only the signed gap on the face. Or keep it as one small line. *Recommendation: move it off; the gap is the fact the street is about.*
- **D4. Zigzag versus same side.** A run of 1-stall districts alternates sides (recommended). The alternative puts every first stall on the left.
- **D5. Paving picture.** Try code-drawn cobbles first (0 KB). Generate a Stitch paving strip only if the code cobbles look flat in round 1. *Recommendation: code first.*
- **D6. HUD words.** Rename "Stores open / In your price range / Within 10% of it / No price to compare" to "Stalls / In range / Near / No price" in Game mode (the exact rule stays in each tooltip). Confirm.
- **D7. The market hall picture.** It has "Sale" painted on it. Keep it out of game mode for good, or ask Stitch for a blank-sign version if a hall is wanted at the top of the lane later.
