# Winter Rehearsal (E2), 2026-10-15

Status: **written and tested, not merged, not deployed.** Branch `feature/winter-rehearsal`, one PR for Faiz to review. Part of [Contest 3, sprint E2](../sprints/game-design-sprint-plan-2026-10-15.md). Seen only in a built copy of the page against mock data (desktop and phone, Game mode and the plain view); not seen against the real database or the live site.

## What it is

A new Fortress room, `/fortress/winter` (tab "Winter"). In calm weather you write one line: "If the market falls hard, I will first check…". Then you walk a slider down the worst real fall of today's book in the stored prices. Each step shows the day, the kroner against the peak, the fall in percent, the days under water and the frost. At the bottom the page shows only your own words and the numbers: no score, no outcome, no advice.

## How it behaves

- **The replay** (`backend/app/services/game/winter.py`, pure, no database): today's holdings, each weighted by its share of the covered value, held at constant weights through the days they all have a stored NOK close on. The worst peak-to-trough fall of that replay is the winter. Kroner are scaled to what the covered holdings are worth today (the peak equals today's covered value). "Days under water" counts stored trading days since the peak. This is a backcast, not what was held, and the page says so.
- **Not the benchmark's fall.** It is the book's own worst fall (the Siege back-test, C1, uses the benchmark's fall; this uses the book's). The two windows can differ.
- **Coverage is always stated**, with its "of": "5 of 8 holdings had stored prices". A holding without usable stored prices or without a value on file is fog with its reason, never filled in, and it is left out of the replay. Fewer than two covered holdings, or fewer shared days than the Siege scenarios need, gives "nothing to walk down yet" with the reason.
- **"No real winter on file."** If the worst fall is under 10% (`backend/app/domain/game_mapping/winter_v1.py`, versioned) the page says so, with the worst dip, and shows no slider. A fall of exactly 10% counts. A small dip is never dressed up as a storm.
- **The bottom** shows your order (or "You have not written one.", with no nag) and "Down X kr, Y%, for N days under water". A test checks that none of the words win, lose, score, buy, sell, hold or should appear there.
- **Read-only.** `GET /game/winter-rehearsal` reads stored data only: no provider call, no LLM, no write, no migration. Demo mode says there is no stored history.
- **Your order stays in this browser** (`aladdin.winter.order.v1`, one line, 200 characters). It is never sent to the server. A static test shows the winter code is imported only by the game API and its own view, so nothing typed here reaches the blind pass or any analysis (architecture rule 4).

## Identity (game-visual-identity checklist)

| Page | Before | After | Kit pieces | Fact encoded visually | Plain view |
|---|---|---|---|---|---|
| Winter (new) | none | 3 (target) | room banner with the war-room backdrop, crest, `NightPanel`, `GameFooter` | five candles go out one by one as the replay moves toward the bottom; frost climbs and up to three icicle ledges hang as the day gets deeper | the table of every stored day, plus the slider and the readout |

- **Visual verb + scene:** endure, a war-table at dusk.
- **Pictures** (packed from the Stitch batch in `frontend/public/art/design sprint`): `winter-war-table`, `winter-icicles` (copied by code, one to three), `winter-tablet` (beside your order at the bottom), `backdrop-winter` (the war-room, also the banner), `backdrop-winter-snow` (only on the "no real winter" state). 94 KB in all. Pictures carry no fact and have empty alt text; candles, frost, icicle count and labels are drawn by code, and the scene is hidden from assistive technology because the page says every fact in words and in the table.
- **Colour is never the only signal:** a candle that is out loses its flame and shows a dashed smoke wisp, and the scene prints "3 of 5 candles lit" and "Frost: 56% of the worst day".
- **Motion:** none. The scene changes only when the slider moves; no looping animation and no Play button.
- **Art budget:** the guard test allowed seven backdrops; raised to nine with the reason in `artAssets.test.ts`.

## Decisions taken (defaults; tell me if any is wrong)

- **The order is kept in the browser, not the journal.** The plan (D5) said a journal note, but a journal entry is tied to one holding and one trade decision (action buy/add/trim/sell/hold/pass, holding required), and a winter order belongs to the whole book. Forcing it in would put it into the temperament and calibration counts. If E3 The Hearth should show your order back, it needs a server copy: either a small table or a new journal entry kind. Say which you want before E3.
- **Cut, per the plan's cut line:** the optional "model winter" (beta times fall) for books with no real fall, the frost art beyond the icicles and overlay, and a Play button (the plan had it off by default; there is no button at all).
- **Not built:** a link from the Siege page; the page has its own tab.
- **Fixed by me, small:** the winter-order sentence is capped at one line of 200 characters.

## Not checked

- Against the real database: how deep the book's worst stored fall really is, and how many of the eight holdings have stored prices.
- The live site, and a real phone.
- The snow-field picture was packed as a backdrop (not a drift object), so it only appears on the "no real winter" state.
- The candles are placed by eye along the table runner; if they look off on the real page they are one function (`candleSpots`).

## Files

Backend: `domain/game_mapping/winter_v1.py`, `services/game/winter.py`, `services/game/winter_view.py`, the endpoint in `api/game.py`, schemas in `schemas/game.py`, `active_winter_version` in settings; tests `tests/unit/test_game_winter.py` (10) and `tests/integration/test_game_winter_api.py` (5). Frontend: `pages/WinterRehearsalPage.tsx`, `components/fortress/kit/WinterScene.tsx` (+ css), `lib/winter.ts`, the crest, nav, route, room art and manifest entries, five packed pictures; tests for the page, the scene and the helpers.
