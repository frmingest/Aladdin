# 3D courtyard S13: every flat page reachable from the world (2026-11-01)

**Status: written and tested (tsc, lint, 1131 tests, build), in PR `feature/game3d-parity-layer-2`. Not merged, not deployed, not yet seen in a real browser (no headless screenshot taken in this change).**

## What a sprint is for (plain words)
Faiz's rule: every page of the normal Game mode must be reachable from the 3D game. This sprint makes that true for all pages today, with no new art, and adds a test so a future page cannot be forgotten. Pages are *reachable* (level A); drawing their facts in the world (B) and playing them (C) come in S14 to S18.

## What you get
- **Signpost** just inside the gate, east of the road (code-built post, three arrow boards, teal pennant). Press **E** at it.
- **"Where to?" menu**: also the toolbar button and the **G** key, from anywhere. Pages are sorted into places: The Fortress, Market Street, The Town, Town Hall, The Workshop, The Keep.
- **World panel**: picking a page shows that page itself, inside the world, with **Open the flat page**, **← Where to?** and close. Esc backs out of a page, then the menu.
- **← Plain view** (the old "Flat fortress" link) opens the flat fortress, so a 3D failure never hides data.
- Taps from a cold load: walk to the sign and press E, pick a page (2); or G, pick (2). Counted from the code, not yet measured in a browser.

## How it works
- `game3d/parity3d.ts`: the register (route, place, level, sprint, one playful line). Param routes (`/holdings/:id`, `/sectors/:sector`, `/fortress/marketplace/:holdingId`) have no door of their own: they are reached through their listed parent page. The Printer is a `planned` row (S19) with no route.
- `parity3d.test.ts` reads `App.tsx` and fails if a route has no row (and if a row names a route that is gone). Tested with a removed row and an added route.
- The panel is a frame of the page itself with `?embed=world`; `Layout.tsx` then drops the sidebar and top bar but keeps the demo-mode strip. Every number is therefore the flat page's own, nothing copied. A frame was chosen because the flat pages need the app's router, which cannot be nested.
- `signpost.ts` (+ test): position, range, clearance from pads, people, desk, drill post, market, props, scenery, torches and the spawn point.
- Words are in `worldWordsV1.ts`.

## Checklist answers (game sprint checklist, section A)
1. Pages touched: `/game3d` only; flat pages unchanged except that `?embed=world` hides their sidebar.
2. Identity score: unchanged (3); a new world object (the signpost) and a menu in the game's voice.
3. Visual wins: the signpost.
4. Words: short and playful, in a new version file.
5. Unknown stays fog, models carry no fact, no red or green, no motion.

## Not done / risks
- Not seen in a real browser: check the frame loads (no `X-Frame-Options` or frame-ancestors rule was found in `nginx.conf`, `index.html` or the backend, but a host-level header on Railway could still block it; if the panel is blank, the Open the flat page link still works).
- A frame loads a second copy of the app, so it is heavier than a native panel; acceptable for a menu used now and then. S15 and S18 replace the busiest pages with real buildings and rooms.
- Level of most pages is A only; see the register for the sprint that lifts each.
