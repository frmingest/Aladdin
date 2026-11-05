# 3D asset plan A6: the Market Quarter (2026-11-04)

**Status: written and tested on `feature/game3d-a6-market-quarter`, off `main` at `0cca4cd` (A5 merged as #296). Seen only in a headless software-WebGL render (no real GPU, no fps), not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md), earlier plan: [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) (S30).

## What a sprint is for (plain words)

The courtyard's market street holds eight stalls and sits in a crowded corner. This sprint gives the market a place of its own: a lane you walk up, with one stall for every company on your watchlist. The art is art we already own (`market-quarter.glb` was packed and never drawn).

## What you will see

- **A timber arch in the east of the courtyard**, between the market corner and the raven perch. Over it: "Market Quarter" and a short line, "12 stalls, 3 in range". The line is the flat page's own word and stays blank while the watchlist is unread. Press E there: **"Press E to stroll into the Market Quarter"**.
- **One lane of stalls, up to twelve, six rows of two.** The stall nearest the arch is the one nearest your price, then the next, in the same order as the flat Marketplace. A sign where the boardwalk starts says: "Closest to your price first."
- **Each stall wears what the flat page says**: its pennant shape (two flags in range, one long near, one short above, none for no price), its plate (name, word, signed gap such as "+4%") and nothing else. These are the same pieces as the courtyard street.
- **Goods beside each stall**: cloth, provisions, crates or a cellar corner, from the packed Resource Bits pieces. The set is picked from the company id alone, every set has three pieces, and nothing grows with a gain.
- **The quiet stretch.** Stalls with no price stand at the far end, after a gap, behind a far gate and a pale mist, under the words "No price yet". They say "No price", never "0%".
- **Boardwalk and banners**: plank tiles down the lane, blue banner poles at the entrance and along the lane, a house closing the far end. All fixed.
- **E at a stall** opens that company's store, the flat store page itself, over the world (same as the courtyard stalls). **E at the post at the south end** rides you back out beside the arch. `?at=quarter` opens the quarter directly.

## What changed

- `quarterPlan.ts` (new, pure): the arch, the lane, `buildQuarter` (street order, twelve stalls, the quiet stretch, counts for the arch), the fixed goods sets and the fixed lane dressing. Imports only the street order, the watchlist type, `yawToward` and `streetPlan`.
- `quarterWordsV1.ts` (new): the words (version 1 file) and the arch line.
- `QuarterArch.tsx`, `MarketQuarter.tsx` (new): the arch and the place. Ground, invisible walls, plates, pennants, exit post, far gate and mist are code-built, so a failed model load leaves a bare but working lane (two separate failure guards: stalls from `town-market.glb`, goods and dressing from `market-quarter.glb`).
- `areas.ts`, `near.ts`, `areaWordsV1.ts`, `Scene.tsx`, `Game3DPage.tsx`: `quarter` becomes a place, with its door, E answers (a stall, or the road back), name plate, prompt, Esc and B. `RESERVED_AREA_IDS` is now empty (the reserved name `market` became `quarter`).
- `streetPlan.ts`, `MarketStreet.tsx`: `toStall` and `StallPiece` are exported so the quarter reuses them. Nothing else changed; the courtyard street is untouched.
- `quarterPlan.test.ts` (new, 27): order, twelve at most, every mix of priced and unpriced stays on the ground and apart, fronts face the lane, the quiet stretch and its gap, counts, goods and dressing nodes exist in the file, equal sets, the plan takes only a watchlist, the arch is clear of everything and every other reach, the way back, the place registration, E answers, `?at=quarter`, words with no buy or sell wording and no red or green.
- **No new model file, no backend change, no migration.**

## The art never carries a fact

Where a stall stands says how near your price it is (the flat order) and whether it has a price at all (the quiet stretch). Its pennant and plate say the rest, from `toStall`, the courtyard street's own function. Goods, boardwalk, banners and house are fixed lists pinned by tests. Condition is shape and words, never colour. No red or green.

## Decisions (Claude's call)

- **The courtyard street stays for now.** The plan says the courtyard keeps a small decorative corner. Removing its eight stalls is a small follow-up once you have walked the quarter; two copies of the stalls exist until then.
- **Sal and the Hype Booth stay in the courtyard.** Moving them into a square, the price clerk (restock prices, decision D12), the wax seals and the eight gate posts on each stall front are not built here. They need data this slice does not read (the top mark, the gates).
- **No fountain.** The plan's "nearer the fountain" is "nearer the arch" here.
- **The arch stands at (29, 8)**, found by searching the courtyard with the same clearance rules as the Siege Field gate; a test keeps it clear of every prop, person, tower, plot, booth and reach.

## Game sprint checklist, section A

1. Pages touched: `/game3d` courtyard (arch) and the new quarter; no flat page. 2. Identity: market corner 2 to 3 (the lane order is the price distance). 3. Visual win: a lane where distance to your price is how far up you walk. 4. Visual verb + scene: *stroll the market.* Walking a boardwalk between stalls. 5. Words: a handful of short strings in a version-1 file. 6. Kit: `StallPiece` (pennant, plate), `StaticBatch`, `PAL`, the area machine. 7. Cut line: banners and the house first, then the goods. 8. Rules: above. 9. Taps: arch = walk up and 1 E; a store = walk up and 1 E; back = 1 E.

## Seen so far, and not checked

Seen in a headless Chrome render with a mocked 8-company watchlist: the arch, the lane order, stalls with plates ("Above", "Near", "In range", "No price"), goods beside the stalls, banners, the far house, the mist over the quiet stretch, a board saying "No price yet", and walking up to the first stall brought "Press E to step into Kongsberg Gruppen's store" and E opened the store. The lane sign and "No price yet" are painted boards in the world (words only), not screen-sized overlays.

Not checked: a real GPU, fps and draw calls (press P, group "quarter"), phone width, twelve stalls at once, and your real holdings. The boardwalk (`floor_wood`) reads terracotta red-brown: it passes the colour audit (0% red) but looks warm, so say if you want it swapped for a plainer stone. Tell Claude if a spot is bad or a word is off.
