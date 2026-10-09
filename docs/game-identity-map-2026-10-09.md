# Game identity: Map fog patches, slate and commission seals — 2026-10-09

Status: **written and tested, not merged, not deployed. Seen only in headless Chromium with synthetic fixtures (desktop 1280 px and phone 390 px), never with real data and never in your browser.** Frontend only: no backend, API, migration, dependency or `survey.ts` change (survey-v1 text untouched). Stacked on PR #89 (`feature/game-page-kit-council`); retarget to `main` after #89 merges. Design: `claude/map-design-2026-10-09.md` (project doc), wins 1 to 4 only. The drawn realm map (win 5) is not built.

`survey.ts` check: `git log -- frontend/src/lib/survey.ts` shows the Sprint 28 change is already on `main` (PR #87 merge is this branch's base), so this PR builds on it directly.

## What changed

- **Win 1, fog patches.** The green `bg-positive` bar and the "n of 5 surveyed" line are gone. Each tower is a fixed silhouette with five fixed patch slots in `SURVEY_CHECKS` order (roof, two shoulders, two base corners). Fog = hatched scalloped cloud with "?"; clear = small solid ring with a dot; not judged = small dashed ring with a dash. Shape, pattern and glyph differ; fog is larger and at least 0.9 opaque. Unreadable facts already arrive as fog and stay cloud. Fog returns only because the input changed (recomputed each load; nothing remembers a past clear state).
- **Win 2.** The banner comes from `PageHeader` automatically. Body is two `ParchmentPanel`s; subtitle 13 words, intro 17 words; the rules line moved into `GameFooter`.
- **Win 3, slate.** Each tower is one button (roving tab stop, arrow keys, Home/End). Pressing it opens a slate with the five checks: patch, printed word, label, reason (touch devices get the reasons). Pressed tower gets a heavier double frame. The old text list sits in a closed "Show the survey as a list" disclosure.
- **Win 4, commissions.** Numbered wax seals (shape per kind: square, hexagon, diamond, ring, down-triangle, coin). Pressing a seal plants a numbered flag on the covered towers; nothing is flagged until pressed. The numbered `<ol>` with its links is unchanged in logic and stays the accessible source of truth; holding chips moved into a closed "which towers" disclosure.
- **Plain view and game mode off** render the previous card content (same checks and reasons, no bar, no count).
- New: `lib/realmMap.ts` (+ tests), `components/fortress/kit/{FogPatch,CommissionSeal,TowerSlate,RealmMapBody}.tsx`, `kit/realmMap.css` (index.css untouched; `wordBudget.ts` untouched, budgets live in `realmMap.ts`). `fogLevel` and its tests are kept; the page no longer imports it.

## Decisions applied

Neutral palette (no green anywhere); "n of 5" removed; wins 1 to 4 only; no wall plinth; one fog look; no flags until a commission is pressed (the prompt's choice over the design's default of commission 1).

## Deliberate deviations

- **Cash commission** is a numbered seal but not a button: the Keep is drawn with the realm map, so there is nothing to plant on. `flagsFor` already returns the Keep flag (tested) for that PR.
- Commission seal "ring" vs "coin" are told apart by an inner ring versus a thick gilt rim, plus number and title; check this on your screen.
- The slate does not outline the individual slot; the pressed tower's frame changes instead.
- Disclosure buttons and footer button got 44 px height through CSS in `realmMap.css` (no edit to `ui.tsx` or `GameFooter`).

## Verified

`tsc --noEmit` clean; ESLint 0 errors (the 2 existing warnings only); vitest 463 passed (44 files); `npm run build` ok. New tests: exhaustive fog slot states, distinct looks, unknown stays fog, fog never fainter (opacity, radius, contrast), fog returns, grid keys, flags, wording guard, no progress count, no `positive` tokens in page and kit sources, word budgets (chrome 44 of 45 words; body measured 153, budget 160). Chromium: game, Plain view, normal, pressed tower plus commission, opened list, demo, at 1280 and 390 px; no horizontal overflow; no HTML text under 11 px; no target under 44 px on the phone; keyboard Right+Down moved focus as expected and Enter opened the slate; one tab stop for the tower grid. Screenshots: `/tmp/claude-0/shots/map-*.png`.

## Not verified

Real data; your browser; protanopia/deuteranopia simulation (only reasoned: state is shape, pattern, glyph and word); screen readers; real touch devices; reduced-motion toggle was only set in the target-size run (there is no animation in this change); a 20-tower realm; the console showed external-resource load failures in the sandbox (no network), unrelated to the page. `docs/PROGRESS.md` not edited, as instructed.

## Look-and-judge for Faiz

1. Do the hatched clouds read as fog, or as flowers/badges? Is a fully fogged tower too hidden?
2. Does a tower with five dots look merely "looked at", never "good"?
3. Are the six seal shapes distinguishable at a glance (ring vs coin especially)?
4. Is "Press a tower for its five checks." enough of a cue, and is the slate below the grid easy to find on a phone?
5. Is the cash seal being non-pressable acceptable until the Keep exists?

## Identity before / after (inferred, to be re-scored)

Map 1 (two Cards, a green bar) -> about 2 (banner, parchment, shared kit pieces, real facts as shapes, Plain view); 3 needs the drawn realm map.
