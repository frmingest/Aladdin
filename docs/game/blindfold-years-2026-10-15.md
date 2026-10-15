# Blindfold Years (E1), 2026-10-15

Status: **written and tested, not merged, not deployed.** Branch `feature/blindfold-years`, one PR for Faiz to review. Part of [Contest 3, sprint E1](../sprints/game-design-sprint-plan-2026-10-15.md). Seen only in a built copy of the page against mock data (desktop and phone, game mode); not seen against the real database or the live site.

## What it is

A new Fortress room, `/fortress/blindfold` (tab "Blindfold"). The app picks a holding and a past fiscal year, hides the name, the currency and the real years ("Year -3" to "Year 0"), and shows what had been filed by then: revenue, operating and net margin, owner earnings, net debt, ROIC. You stake a low and a high figure for the next year's owner earnings. Then the stored figure is shown, with whether it fell below, inside or above your range, and the name is lifted. Practice, not measurement.

## How it behaves

- **Eligibility** (`backend/app/domain/game_mapping/blindfold_v1.py`, versioned): five consecutive annual periods (three before the last year shown, that year, and the next), each with computable owner earnings, one currency across all five, no data-quality flag, and a non-financial sector. A gap, a missing input (the Kongsberg and Bouvet D&A case) or a flagged year means the puzzle is never offered. Banks and insurers never appear.
- **The answer stays on the server.** The puzzle payload has no answer, name, ticker, currency, real year labels or file names (API test over the raw response). The slider range comes from the years shown only (test: changing the answer year does not move it).
- **The server decides every comparison** (`backend/app/services/game/blindfold.py`): inside is plain `low <= actual <= high`, a value equal to a bound counts as inside, a reversed range is a 422. Range width is classed narrow / medium / wide (25% and 60% of last year's owner earnings, in `blindfold_v1.py`).
- **Counts only.** Answers are kept in this browser (`aladdin.blindfold.v1`), nothing is saved server-side (decision D4). A tally opens at 8 answered and is always printed as "held 5 of 8"; width groups open on their own count of 8. No grade, streak, trend arrow or praise (wording test).
- **Read-only.** `GET /game/blindfold`, `/game/blindfold/reveal`, `/game/blindfold/name`. No LLM, no price, no write, no migration. Demo mode shows no real filings. Nothing here is imported by the analysis or journal code (static test), so nothing typed or staked reaches the blind pass (architecture rule 4); there is no typed text in this sprint.
- **Stored figure caveat:** it is the figure on file today (latest filing for that year), so it may include later restatements; the reveal says so. Restated figures are not detected separately because only one value per period is stored.

## Identity (game-visual-identity checklist)

| Page | Before | After | Kit pieces | Fact encoded visually | Plain view |
|---|---|---|---|---|---|
| Blindfold (new) | none | 3 (target) | room banner with river backdrop, crest, `NightPanel`, `GameFooter` | stakes and range band on a gauge scale, years as tide marks, water rising to the stored figure | the table of years, plus number fields for the stakes |

- **Visual verb + scene:** stake the flood line, on a river bank with a gauge post.
- **Pictures** (packed from the five Stitch images in `frontend/public/art/E1`): `blindfold-gauge-post`, `blindfold-stake` (flipped by code for the high stake), `blindfold-veiled-tower` and `blindfold-scroll` (packed, not used on the page yet; reserved for B2 Fresh-Money Duels and the optional "why" line), `backdrop-blindfold`. 55 KB in all. Pictures carry no fact and have empty alt text; scale, marks, stakes and labels are drawn in code above them, and the scene is hidden from assistive technology because the page says every fact in words and in the table.
- **Colour is never the only signal:** the range is a hatched band, the stakes are labelled "Low" and "High" and differ in shape, the position is a shape (▼ ● ▲) plus words.
- **Motion:** the water rises once on reveal (CSS transition on the rect), none under reduced motion, no looping animation.
- **Art budget:** the guard test allowed six backdrops; raised to seven with the reason in `artAssets.test.ts`.

## Decisions taken (defaults from the plan; tell me if any is wrong)

- D4 (browser state, no server table) and D8 (E1 first) as recommended. D5 and D6 do not apply to E1.
- Cut from this sprint, per the plan's cut line: the optional tier-band question, the Circle of Competence hint, and the one-line "why".
- Two deviations from the plan text, both because the plan contradicted itself:
  - **"Tallies by company" is not built.** With about three puzzles per holding a per-company count can never reach the n-of-8 gate, so it would never show. The tally is overall and by range width.
  - **"Size class" is not shown**, only the sector. A size class needs a currency conversion, and the currency is hidden on purpose. Say if you want it (it would be a small versioned FX table).
- The stakes start at the same two spots (35% and 65% of the slider range) so the scene always has two stakes to move; the reveal button stays disabled until you move one. This is a mild anchor; the range comes from the years shown, not the answer.

## Not checked

- Against the real database: how many puzzles there actually are. The plan guessed 20 to 30; the strict rule (five complete, unflagged years in one currency) may give fewer. The page says plainly when the pool is empty or used up.
- The live site, and a real phone.
- The two unused pictures (`blindfold-veiled-tower`, `blindfold-scroll`) are packed so the art set is complete for E1; they add about 20 KB and can be dropped from `scripts/art/manifest.json` if you would rather not ship them before they are used.
