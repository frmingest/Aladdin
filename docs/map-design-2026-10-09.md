# Map (Cartographer's table): making fog look like fog

Role: game-designer + art director. Date: 2026-10-09. Proposal only; nothing built, nothing under `$HOME/mnt` touched.
Paths relative to `frontend/src/`. Read: circle-council-design.md, game-pages-identity-audit.md, `pages/CartographerPage.tsx`, `lib/survey.ts` + test, sprint-28 doc, sprint-plan v2 (G34/G35), `lib/fortress.ts` (layout), `lib/fortressArt.ts`, `GameFrame.tsx`, `TowerSurvey.tsx`, `wordBudget.ts`, parts of `FortressScene.tsx` (`GhostKeep`) and `sceneWorld.tsx`.
NOT verified: nothing seen in a browser; `lib/sceneNav.ts` (named in the Circle doc) not opened; `Disclosure` in `ui.tsx` (whether closed children are in the DOM, which matters for word-count tests) not opened; word counts below are estimates from code; backend untouched/unread.

## 1. Diagnosis (why it is normal mode, and what is wrong with the fog)

- `CartographerPage.tsx:12-16` promises "the realm as a map of fog" and `:119` titles a card "The map", but no map is drawn. `:117` and `:139` are two `Card`s; `:104-112` is the plain `PageHeader` (no game branch); `:114` loading is a grey sentence. Identity audit scored the page 1.
- Fog is a progress bar. `:53-59`: an 8 px `h-2 rounded-full bg-raised` track with a child `bg-positive` of width `(1 - fogLevel) * 100%`. It fills green as fog clears. That is the form-widget idiom, and green is the state colour for "good" (the study skin deliberately leaves state colours alone, so it stays green in game mode). A full green bar on a tower reads as "this tower is fine", exactly what `survey.ts:7-8` and `:15` of the page say must never be implied. The clear-count is also the bar's whole meaning, so it is a score in disguise (`fogLevel`, `survey.ts:170`; `surveyText` "3 of 5 surveyed", `:60`).
- Fog is drawn fainter than clear. `:63` gives clear rows `text-ink` and fog rows `text-ink-faint`, and `:64` uses "●" for clear versus "○" for fog. The unknown thing is the dim one, which is backwards for a game whose rule is "unknown must look at least as important as known" (Circle doc, truth rules). Not-judged "–" is also faint, so fog and not-judged differ only by a glyph and a shade.
- State is carried by text glyph plus `title={c.reason}` (`:63`), a hover tooltip that does nothing on touch; the reason is otherwise `sr-only` (`:66`). The sighted phone user never sees why a check is fog.
- Order does not match the home scene. `surveyRealm` maps `state.towers` in API order (`survey.ts:165-167`); the Fortress places heaviest first via `sortTowers`/`layoutTowers` (`fortress.ts:101, 128`). The grid at `:132` therefore does not look like the realm.
- Words: the intro paragraph (`:124-127`) is about 48 words and repeats what the picture should say; every tower adds 5 labels plus a count plus 5 sr-only reasons (`:60-67`), so the default DOM is hundreds of words (estimate). Commissions repeat the tower names as chips (`:149-166`) the map would show.
- Commissions (`:139-179`) are a divided list with no spatial link to the towers they concern; sprint-plan G35 said "drawn as map markers".
- Smaller: `fogLevel` is imported only to drive the bar (`:44`); the footer (`:178`) is grey 12 px text, not `GameFooter`; link logic at `:155` is correct and must be kept.

## 2. The hero: a realm map where each tower's five checks are five fog patches

### 2.1 Scene
A parchment map (`ParchmentPanel`, neutral ink-on-paper palette) inside `GameFrame`, under `GamePageHeader` (Crest: compass over a tower). Decorative terrain only: ink hill hatching, a drawn moat line echoing the home scene, a compass rose, torn border. Terrain carries no data and is `aria-hidden`. The Great Keep is drawn as a small landmark at the centre of the top row exactly where `layoutTowers` puts it (`keep` in `FortressLayout`). It is not a holding, has no fog, and is where the cash commission pin (below) stands.

### 2.2 Placement: same as the home scene
Pure `lib/realmMap.ts`, wide mode: call `layoutTowers(state.towers)` (it takes `GameTower[]`, which the page already has as `state.towers`; `TowerFog` has the same `holdingId`). Use each `PlacedTower` `x + w/2` as the plot centre and `row` for the terrace, compressing the row pitch from 290 to about 150 so a 20-tower realm fits in roughly 3 terraces. Result: biggest holding next to the keep, rows and neighbours identical to the Fortress. Narrow mode (below 640 px): a 3-column grid in `sortTowers` order, `viewBox` 360 wide so 1 unit is 1 CSS px at 390 px; the keep is a banner row on top. Mode comes from a `matchMedia` hook (render one SVG, not two, to avoid duplicate ids; tests pass the mode explicitly). A map that needs a 720 px minimum like the home scene (`FortressScene.tsx:1403`) is rejected for phones.

### 2.3 The tower silhouette (neutral on purpose)
Every holding gets the same ink line-drawing of a tower, height from `weightScale` only (bounded 0.9 to 1.15, `fortress.ts:109`), width from the size class via `towerDimensions`. It does NOT vary by wall material, verdict, thesis, or survey state. So surveying a tower never makes it prettier, and a weak tower is not drawn weak either (it is not drawn at all on this page; see D2 for an optional plinth). Funds and gold (`not_judged` checks) use the same silhouette, shorter via `structure` height as at home. Label under each: `shortLabel(name, ticker)` and weight text (`weightText`), HTML text at least 11 px.

### 2.4 The five patches: exact mapping
Each tower has five fixed slots, in `SURVEY_CHECKS` order, so a slot never changes meaning and never moves when a state changes:

| index | check id | slot (fraction of the tower box, x,y from top-left) |
|---|---|---|
| 0 | `report` | roof (0.50, 0.00) |
| 1 | `analysis` | left shoulder (0.12, 0.30) |
| 2 | `thesis` | right shoulder (0.88, 0.30) |
| 3 | `circle` | left base (0.12, 0.78) |
| 4 | `valuation` | right base (0.88, 0.78) |

Slot positions are a tunable table in `realmMap.ts` (`SLOT_AT`), not a design truth; they only need to be distinct, symmetric and stable. Patch radius about 0.30 of tower width, minimum 16 px radius so the drawn patch is large enough to see and tap through.

State to look (input is only `TowerFog.checks[i].state`; `reason` goes to the slate and aria):

| state | shape | pattern | glyph | covers tower? |
|---|---|---|---|---|
| `fog` | cloud puff (lobed path), solid edge | diagonal hatch fill, mid-grey mist `#8f98a8` at opacity 0.9, ink hatch lines | "?" in ink, 14 px | yes, it hides the tower line-work underneath |
| `clear` | no cloud; the ground and tower show; a small ink ring marks the empty slot (so the slot is still findable) | none | small filled dot in the ring | no |
| `not_judged` | dashed circle (no cloud), clearly an empty socket | dotted | "–" | no, but visibly NOT the clear mark (dot vs dash, solid ring vs dashed ring) |

Rules: fog is never drawn fainter, smaller or lower contrast than clear (constant `FOG_OPACITY >= 0.85`, asserted in a test). A fully fogged tower is mostly hidden behind five patches, which is the correct picture of "I know nothing checked here". Unknown readings (report list unreadable, journal unreadable, circle unreadable: `survey.ts:79, 106, 118`) already arrive as `state: "fog"`, so they cannot look clear. Not colour alone: shape (cloud vs ring vs dashed ring), pattern (hatch), glyph ("?" / dot / dash), and in the slate the printed word.

Patches are drawn static: SVG `<pattern>` fill for the hatch, no filter, no blur (the home scene's `fs-mist` gradient may be reused as a soft edge only if given a page-local id; I recommend a plain hatched cloud instead, so the grammar is the same as Circle's dashed "?" fog and Council's fog alcove: hatch + "?" + dashed edge). One shared `FogDefs` supplies the pattern with a `useId` suffix.

### 2.5 Interaction and the slate
- The tower is the single focusable unit (`<button>` over the plot, at least 44 x 44 CSS px; towers are 48 to 118 units wide, so use a transparent hit rect with `min` 44 like the home scene). Roving tabindex, arrow keys move in layout order (reuse the Circle doc's `sceneNav` idea; VERIFY the module). Five patches are never separate tab stops (a 20-tower realm would be 100 stops).
- Press selects the tower: a "survey slate" (parchment panel below the map, or a bottom sheet on phones) lists the five checks, each with the patch glyph, the printed word ("In fog", "Clear", "Not judged") and the existing `reason`, plus the link to `/holdings/:id`. This replaces the always-on 5 bullets per tower and the hover `title` (`:63`). The tower's slot being read is outlined with a thicker stroke (shape change, not just colour).
- A "survey as a list" `Disclosure`, closed by default, holds the old `<ul aria-label="Fog by tower">` text list as the accessible source of truth (exact same labels and reasons). The SVG is `aria-hidden` apart from the buttons; each tower button's `aria-label` is "Name, N of M weight, 2 checks in fog: Analysis fresh, Circle marked" (built from `checks`, no new facts).

### 2.6 When the analysis goes stale: fog returns
Fog "returns" because the map is recomputed from stored state each load: the `analysis` slot (index 1) goes from clear back to a hatched cloud when `freshness` leaves `fresh` (`survey.ts:90-96`). Nothing remembers a past clear state (no storage, no streak, no "you lost progress" message, no animation of loss). To make the return legible without inventing a state, the slate says it with the existing reason ("The analysis is weathered and is due a fresh run." vs "No analysis has been run."). The map face cannot tell "never" from "aged" using `TowerFog` alone (distinguishing them means parsing `reason` strings, which I reject). Optional additive field `cause?: "never" | "aged"` on `SurveyCheck` (D3); with it the aged cloud could be drawn thinner-hatched (still opacity at least 0.85, still hides the tower, still "?"), never lighter in importance. Not needed for the first build.

### 2.7 What the map must NOT imply
- Fully clear is not good. A tower with five dots looks like an ordinary tower with the cloud lifted, same silhouette and ink, no glow, no gold, no flag, no sparkle, no sun ray, no "well done". The caption says it once: "Clear means looked at, not sound."
- No score: remove the "n of m surveyed" text from the map face and from the slate header (it is a count of progress). It can live in the aria-label as "2 checks in fog". No percentage anywhere; no whole-realm "x% revealed" meter, no HUD "fog level", no total. If the realm has a lot of fog it shows as a lot of cloud, that is the whole message.
- No streak, no timer, no "newly cleared" highlight, no confetti, no "finish all commissions" completion state. Empty commissions show the existing honest sentence ("Nothing is in fog by these five facts. That says what you have looked at, not that all is well.") with no flag, no fanfare, and the map simply shows rings.
- Not weight-faded: heavy fogged towers stay the biggest picture on the map.
- Weak towers are not made prettier: the silhouette is identical regardless of survey state, and wall material/verdict are not read on this page (D2 optional).
- Do not show device-dependence silently: the report check depends on this browser (`opened`); the report slot's `reason` already says "on this browser".

### 2.8 Palette (decision, recommended: neutral)
Neutral parchment map tones: paper `#d9c9a3` to `#c9b88f` family (same family as `.scroll-paper`), ink `#2b2118`, mist `#8f98a8`, hatch ink `#3a3f4a`. No `bg-positive`/green/red anywhere on the map; state colours would turn "looked at" into "good". The page loses the green bar entirely. Check mist-versus-paper non-text contrast at 3:1 and "?" ink on mist at 4.5:1 in Chromium (VERIFY; not computed here). The Keep and compass may use gilt as ornament; gilt carries no state.

## 3. Commissions as map markers, list stays the truth

- Each commission becomes a numbered seal token (SealMark family, shape per commission kind: report = square, analysis = hexagon, thesis = diamond, circle = ring, valuation = triangle-down, cash = coin-round; shape + number + the title text, never colour alone). The number is its position in the existing weight order (`commissionsFor`, `survey.ts:224-241`).
- Pressing a seal (a 44 px `<button aria-pressed>` at the left of the list item, `aria-label="Show on the map: Refresh the analysis"`) plants a flag with the same seal and number on every tower the commission covers (`commission.holdings[].holdingId` matches a plot) and dims nothing. Cash (`id: "vault"`, `holdings: []`) plants its pin on the Keep. Default selection: commission 1, so markers are visible on first load without a click (D5; alternative: none).
- The flags are decoration over the tower button (`aria-hidden`); the commission `<ol aria-label="Commissions">` stays the accessible source of truth with its existing links ending at the same targets (`c.to`, or per-holding `/holdings/:id` with `?tab=documents` / `?tab=analysis` for `report` / `valuation`, `:155`). Link logic unchanged.
- Words: the holding-name chips (`:149-166`) go inside a closed `Disclosure` per commission ("Which towers", 2 words) because the map now shows them; commission `text` sentences stay (one line each) since they are the reason. Intro shortened (see below). The "Rules survey-v1. Finishing a commission earns nothing." line moves into `GameFooter` (keeps the no-reward statement; it is a rule, not decoration).
- No path/route drawn between flags (no order to follow; a route implies a quest).

### Word budget
- Header subtitle: "Which parts of the realm are surveyed, and which are still in fog." (13 words, from 14).
- Intro (replaces `:124-127`, about 48 words): "Five facts per tower. Clear means looked at, not sound; fog comes back when an analysis ages." (17 words). The browser-only note is already in the report check's reason; keep it there.
- New budget keys in `wordBudget.ts`: `cartographerChrome: 45` (header subtitle, intro, caption, slate headings, flag aria excluded), and a page-default target of about 150 visible words plus tower names (estimate; today several hundred, unmeasured). The per-tower text list is closed by default, so it is not in the default view.

## 4. Low-hanging wins, ranked (impact per effort)

1. **Fog patches replace the green bar (S, ~3 h).** Replace `Fog` card internals (`CartographerPage.tsx:43-70`) with a `FogCluster` of the five patch slots around a fixed silhouette, still in the existing grid of tower cards (no map layout yet). Removes the quality-looking meter immediately and shows fog as fog. Primitive: `FogPanel` hatch/"?" (shared `FogDefs`), new `lib/realmMap.ts` (`fogSlots`). Files: `lib/realmMap.ts`, `components/fortress/kit/FogPatch.tsx`, `CartographerPage.tsx`. Drop `fogLevel` import (keep the function and its tests).
2. **Header, parchment, shorter text, GameFooter (S, ~2 h).** `GamePageHeader` with a map Crest, wrap the page in `ParchmentPanel` inside `GameFrame`, shorten the intro to 17 words, move the rules line into `GameFooter`. Primitives: all from the Circle/Council kit step 1 (no new work beyond the Crest). Files: `CartographerPage.tsx`, `kit/Crest.tsx` (+1 glyph).
3. **Tower slate replaces always-on bullets and hover titles (S, ~2.5 h).** One selected tower shows five checks with word, glyph and the reason; the full text list sits in a closed `Disclosure`. Primitive: `ParchmentPanel`, `Disclosure`. Files: `CartographerPage.tsx`, `kit/TowerSlate.tsx`. Cuts hundreds of default words; fixes touch-device reasons.
4. **Commission seals and flags (S-M, ~3 h).** Numbered seal toggle per commission; flags on covered towers; cash pin on the Keep; holdings chips into a closed Disclosure. Primitive: `SealMark` (extended with commission shapes in `lib/seals.ts`). Files: `lib/realmMap.ts` (`flagsFor`), `kit/SealMark.tsx`, `CartographerPage.tsx`.
5. **The map layout itself (M, ~6 h).** `realmMap(towers, mode)` using `layoutTowers` (wide) and `sortTowers` grid (narrow), terrain, Keep landmark, roving-tabindex keyboard. Do this after 1 to 4 prove the patch grammar in the simple grid; the grid view from step 1 is the narrow fallback anyway.

Accessibility for all five: tower buttons at least 44 px; text in HTML at least 11 px over decorative SVG; arrow-key roving focus; visible focus ring in gold/ink, not green; reduced motion: the page has no required animation (header torches only, `fortress-flicker` is already `no-preference` only, `index.css:223-226`); no SVG filters or turbulence (hatch is a static `<pattern>`); colour-blind: state by shape + hatch + glyph + printed word; test in protanopia and deuteranopia (the palette is neutral, so little to lose); `aria-hidden` on terrain, flags, patches.

## 5. Tests to add

`lib/realmMap.test.ts` (pure, vitest, same style as `survey.test.ts`; reuse its `tower()/state()/inputs()` helpers or export them to a `testKit`):
- `fogSlots`: always 5 slots in `SURVEY_CHECKS` order; `clear` -> {no cloud, dot}, `fog` -> {cloud, hatch, "?"}, `not_judged` -> {dashed ring, dash}; the three looks are pairwise distinct on shape, pattern and glyph (not only a colour field); exhaustive over `SurveyState`.
- Unknown stays fog: reuse the inputs with `documents: {}`, `records: null`, `competence: null` and assert the corresponding slots are cloud.
- Fog is never fainter: `FOG_OPACITY >= 0.85`, fog radius >= clear ring radius, fog contrast constants.
- Silhouette independence: `plotFor(tower)` is identical for the same tower under all-clear and all-fog inputs (surveying never changes the drawing); height only from `weightScale`.
- Layout wide: plot order and rows equal `layoutTowers(...).items`; every plot within the viewBox; no two plots overlap; empty realm -> no plots, Keep still placed. Narrow: order equals `sortTowers`; 3 columns; within 360 wide; ids unique.
- `flagsFor(commission, plots)`: a flag per covered holding exactly; none for holdings not on the map; `vault` commission -> one flag on the Keep; number equals list position; default selection is commission 1 (or none, per D5).
- Fog returns: take a tower with `freshness: "fresh"` (analysis slot clear), re-survey with `"weathered"`, the analysis slot becomes cloud with no other slot changing.
- Wording: all new strings (captions, aria, slate headings) do not match `/\b(buy|sell|trim|add to|invest|purchase|points?|score|streak|reward|level up|unlock|well done|complete(d)?)\b/i`, and the map markup contains no `%` next to "clear"/"surveyed"/"revealed", and no "of 5"/"of N surveyed" on the face.
- Source guard: `CartographerPage.tsx` and kit files contain no `bg-positive`/`text-positive` (cheap regex over `?raw` imports, or a render check on class names).

`lib/gameModeNoise.test.tsx` / `wordBudget.test.tsx`: `renderToStaticMarkup(<CartographerPage-pieces/>)` with `countWords <= WORD_BUDGET.cartographerChrome` for the chrome (header subtitle, intro, caption, empty state) and a page-level default ceiling with towers of fixed names excluded or fixed in the fixture (VERIFY `Disclosure` renders no children while closed; if it does, test with the pieces, as the file does today). Add the Map to the read-only smoke list (open item from the sprint-28 doc).

## 6. Place in the sprint slice

Circle/Council slice order was: kit foundation, Council quick wins, Council hero, Circle, verification. Map goes after Circle because it reuses the fog grammar Circle fixes first (dashed outline + "?" + hatch) and the `SealMark` shapes:
1. In the existing kit step (about 3-4 h): also add the shared `FogDefs` hatch pattern, the map Crest, and commission shapes in `lib/seals.ts`. (+1 h)
2. After Circle (about 8 h): wins 1, 2, 3 on the Map (about 7.5 h, can slot beside Circle's C3/C4), then win 4 (3 h). Win 5 (the layout, about 6 h) is its own follow-up PR so the wall-free fog fix ships early.
3. Verification as in the slice: Chromium at 390 and 1280 px, reduced motion, protanopia/deuteranopia pass, keyboard path, word counts, `tsc`, lint, vitest, build; write "written, not yet deployed, not seen on real data" (the sprint-28 state also still says not merged: PR #79; Map redesign builds on that branch's `survey.ts`, so merge or rebase first).
Cut first: win 5 terrain, cash pin, `cause` field. Keep: wins 1 and 3 (they remove the misleading meter and the hover-only reasons).

## 7. Decisions for Faiz

- D1 Palette: neutral parchment/ink/mist (recommended) or keep green for clear? Green turns "looked at" into "good".
- D2 Wall plinth: should each tower show its wall material as a plain base line (a second axis, so the map says both "looked at" and "how sturdy")? Default no: survey stays about what you have looked at, and the home scene already shows walls.
- D3 Aged-versus-never fog: allow an additive `cause` field on `SurveyCheck` (no rule change, survey-v1 text unchanged) so returned fog can be drawn differently? Or keep one fog look.
- D4 Remove "n of 5 surveyed" from the map face (my recommendation; it is a progress count) or keep it as small slate text.
- D5 Default commission selection: commission 1 flagged on load, or no flags until pressed.
- D6 Same layout as the home scene (wide mode uses `layoutTowers`; recommended) or a map-specific arrangement.
- D7 Scope: ship wins 1 to 4 first and treat the full map as a second PR?
- D8 The Keep on the map: show it (landmark and cash pin) or leave the cash commission as list-only.

## 8. Decisions (Faiz, 2026-10-09)

| # | Decision | Answer |
|---|---|---|
| D1 | Palette | **Neutral** (parchment, ink, mist); no green for "clear" |
| D4 | "n of 5 surveyed" on the map face | **Removed** (it is a progress count) |
| D7 | Scope | **Wins 1–4 first; the drawn map as a second PR** |
| D2, D3, D5, D6, D8 | Smaller calls | **Accepted as recommended**: no wall plinth (survey stays about what was looked at); one fog look (no `cause` field); commission 1 flagged on load only if the design doc's default says so, else none until pressed; wide layout reuses the home scene's `layoutTowers`; the Keep and cash pin are shown. Confirm D5 when building |
