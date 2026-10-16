# Game mode: full design review and Stitch picture plan (2026-10-16)

Status: **review only. Nothing in the app was changed.** Four lenses (art director, game/UX designer, frontend, QA/accessibility) applied to every game-mode room. Builds on the 2026-10-09 identity audit, the graphics guidelines and the 2026-10-15 map assessment.

**What was checked:** the live site (Game mode on) in the built-in browser at pane width (about 800 px): Fortress, Siege, Chronicle, Council, Records, Circle, Map, Marketplace, Dashboard, Journal, Holdings. Plus the art manifest, `roomArt.ts`, `mapArt.ts`, the picture budget test and where each picture is used.
**Not checked:** phone width, the Marketplace store page, Settings, Glossary, zoomed Map, and anything behind a click inside a room. Scores below are my read, not measured.

## 1. Where things stand

Since the 2026-10-09 audit the rooms have crests, backdrops, props and seals, and the Map is painted. The audit's "five rooms at 0 to 1" is now out of date. What is left is a different set of gaps:

| Room | Looks like a game now? | What is still bare |
|---|---|---|
| Fortress | Yes, the best page | Smallest label is 6 px at 100% (phone); weather and the top HUD are plain icons |
| Siege Simulator | Mostly | Crest missing (still a shield); a bordered empty box sat above the slider in my screenshot (see 3.3) |
| Chronicle | Mostly | Days the worker was off have no picture of their own |
| Council | **Weakest right now** | On a quiet night: eight hollow banners each saying "none found", no advisors visible, nothing to look at |
| Records | Yes | Fine; the bookshelf works |
| Circle | Partly | The map is plain rings and numbered dots; no Stitch pictures on the sectors |
| Map | Yes | Holding pictures are tiny; labels cut off ("Alfred Berg Nor..."); the picture is small (open decision E1) |
| Marketplace | Partly | Street page and store cards are data boxes; the market hall and booths only appear on the Fortress |
| Journal | No | No crest, no banner, no props, plain cards |
| Dashboard, Holdings, holding page | No (skin only) | Letter circles instead of pictures; Holdings is a bare table; no tower picture on the holding page |
| Settings, Glossary | No | Skin only (low priority) |

## 2. Use what already exists first (no new Stitch picture needed)

| # | Idea | Reuses | Why it is safe |
|---|---|---|---|
| R1 | **Circle: draw each sector as its own sector picture** instead of a numbered dot | the 10 `map-*` sector pictures from the Map | Picture chosen from the sector name alone, same rule as the Map; ring position and the words still carry the status |
| R2 | **Dashboard, Holdings and the holding page: sector picture instead of the letter circle** | same 10 pictures | Same sector-only rule; never changes with weight or verdict |
| R3 | **Marketplace street banner:** market hall and booths across the top; each store's awning shows its sector picture | `market-hall`, `market-booth-*`, sector pictures | Decoration only; price words and gates stay |
| R4 | **Journal banner** with the inkwell and half-rolled scroll, like the Council banner | `room-inkwell`, `room-scroll` | Props only |
| R5 | **Loading and waiting states** use the hourglass; **Night Watch header** gets the lantern | `room-hourglass`, `ledger-lantern` | Decoration only |
| R6 | **First visit welcome** (Game mode is now on by default) with the happy genie | `genie-happy` | The genie art already exists and is loaded elsewhere |
| R7 | **Tower portrait on the holding page** (idea D4 from the 2026-10-09 review, never built) | the scene's tower pictures | Same tower the Fortress already draws from stored rules |
| R8 | **Two pictures are not used anywhere:** `prop-bridge`, `circle-stone-low` (27 KB). Use them (a bridge on the Siege strip, a low stone in the Circle) or delete them | | |

R1 and R2 are the biggest gain for the least work.

## 3. Things that are not art but would improve the experience

1. **Council on a quiet night.** Eight "none found" banners say the same thing eight times. Collapse them into one picture and one short line ("nothing on the agenda; that only means no rule fired, not that all is well"). This follows the standing "one idea once" rule and the Next Bell idea (B7).
2. **Map labels are cut off** at normal size ("Salmon Evolutio...", "Alfred Berg Nor...") and the holding pictures are very small. Larger pictures or shorter labels. Check the live Map after the next deploy before choosing.
3. **Siege page:** a bordered empty box sat above the "Measured against" toggle in my screenshot. It may just be a picture still loading (lazy) or the World banner; **I did not confirm it**. Look at it on the live page.
4. **Journal data to check, not a game issue:** the Alfred Berg sell (6 Oct) shows "-99.8% since then, in your favour" with a price of 50,000 NOK. That looks like a total amount typed where the price per unit goes. Please check that entry; if so, edit it and the game numbers on Records and the Chronicle follow.
5. **Fortress labels are 6 px** at 100% on a screen this size ("press Read labels" helps). You decided to keep the sideways scroll on phones, so this is just a reminder.
6. **Empty and error states** have no look of their own anywhere (see S9).

## 4. New Stitch pictures to generate

Standing rule: each is something you generate. Short, plain descriptions. Same cartoon-fantasy look as the existing crests and props; transparent or plain background as before.

| # | What to generate | What it is for | Size |
|---|---|---|---|
| S1 | **Siege crest:** round gold medallion like the other room crests, showing a siege tower or battering ram | Siege Simulator banner and tab (today a shield) | about 13 KB |
| S2 | **Marketplace crest:** same medallion, showing a striped market awning with a coin | Marketplace banner and tab | about 13 KB |
| S3 | **Fortress crest:** same medallion, showing the castle keep | Fortress banner and tab | about 13 KB |
| S4 | **Journal crest:** same medallion, showing a quill and an open book | Journal banner and tab | about 13 KB |
| S5 | **Eight small round badges for the Council agenda,** one style, each readable at tiny size: a tripwire cord between two posts; a rolled scroll with a question mark; a small vault door; a ring of stones with one stone outside; a closed casket with a cracked seal; a cracked wall; a dusty old scroll; a bare wall with no ditch in front | Replace the hollow banners with a picture per agenda kind (the words stay) | about 7 KB each |
| S6 | **A quiet council room:** the round table with the chairs pushed in and one candle burning, a calm and empty room. Not a happy or "all clear" scene | Council page when nothing is on the agenda | about 25 KB |
| S7 | **Four tiny sky badges:** calm sun, clouds gathering, a storm cloud, dark smoke over a wall | Next to the weather word in the top bar (the word stays) | about 8 KB each |
| S8 | **A plot covered by a canvas sheet** (nothing was recorded here) | Chronicle days the worker was off, so they never look calm | about 10 KB |
| S9 | **Empty state:** an empty open chest or a blank parchment with a quill beside it | "Nothing yet" messages in all rooms | about 12 KB |
| S10 | *(optional)* **A brass barometer** | Temperament card (a picture of the gauge, not its reading; the number stays real) | about 12 KB |
| S11 | *(open decision E1)* **The Map, re-rendered larger with land and borders only and no text** | Map: sharper at zoom, labels drawn by the app, fits phones | see 2026-10-15 assessment |

Pictures that must **not** be made: anything whose look would show a figure or a verdict (a fuller or emptier vault, a taller or shorter wall by performance). That would carry data in a picture, which the graphics rules forbid. Those slots stay drawn by code.

## 5. Budget

The packed set is **2600 of 2800 KB** (118 pictures), so about **200 KB is free.** S1 to S9 come to roughly 190 KB. That fits, but only just, and a phone check of the heaviest page is needed.

Space can be freed: if the old drawn map (`?map=classic`) is retired, about **300 KB** of pictures only it uses can go (island, hills, four mountains, serpent, compass, frame corner, palms, ship). That is your call (D3 below).

## 6. Suggested order

1. **R1 and R2** (sector pictures on Circle, Dashboard, Holdings): large visible gain, no Stitch work.
2. **Council quiet night** (3.1) with S6, then S5.
3. **S1 to S4 crests** plus R3 and R4 (Marketplace and Journal banners).
4. **S7, S8, S9** (sky badges, covered plot, empty state).
5. **R7 tower portrait** on the holding page.
6. Map: decide E1 first, then S11.

Each step follows the graphics guidelines (budget test, art-off fallback, `alt=""`, readable at 360 px, page row in the e2e spec).

## 7. Decisions for Faiz

- **D1** Go ahead with R1 and R2 first? (Recommended.)
- **D2** Make the Council quiet-night change (one picture, one line instead of eight "none found")?
- **D3** Retire the old drawn map to free about 300 KB, or keep `?map=classic`?
- **D4** Which of S1 to S10 will you generate, and in what order? S1 to S4 and S6 are the cheapest wins.
- **D5** Settings and Glossary: leave plain, or give them a banner later?
- Please also check Journal entry 3.4 and the Siege box 3.3 on the live site.
