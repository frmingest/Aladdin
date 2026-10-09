# Game visual identity (standard)
Rule: every game tab must look like a game, not like the normal app with a sepia filter. Visuals replace words; they never replace truth, accessibility or performance (see `game-ui-standards.md`, which wins on conflict). Method: `.claude/skills/game-visual-identity/SKILL.md`. Sprint gate: `docs/game-sprint-checklist.md`.

## 1. Identity ladder (score per game page, 0-3)
- **0 Generic.** `PageHeader` + `Card` + list/table. Same page would work in normal mode. (Today: Council, Circle, Records, Siege rows, Marketplace cards.)
- **1 Skinned.** Study skin colours and Marcellus headings only. Better, still not a game.
- **2 Game page (minimum to ship).** All of: (a) a scene header or bespoke illustration at the top of the page, not a stock icon; (b) uses the shared kit (parchment panel, seal, crest, raven, scroll, frame corners) instead of one-off hex and `ui-card`; (c) encodes at least one real fact visually (shape, size, position, fill level, crack, fog), and that fact is named in the spec; (d) a Plain view toggle (same facts as labelled blocks); (e) passes truth, colour-blind, reduced-motion, keyboard, phone, performance.
- **3 Signature.** Also has one memorable object tied to the page's verb (e.g. a sealed minutes scroll, a circle drawn as a map ring) that a screenshot alone identifies as Aladdin; hand-painted or illustrated asset allowed when it has an SVG fallback.

Definition of done for any new or changed game page: score >= 2, with the score before/after written in the sprint doc. A changed page that scores below 2 is a blocker, not a nit.

## 2. Anti-patterns (each is a finding)
- "A Card with a list is not done." A `Card`, `PageHeader`, table or chip row is a container, never the visual.
- Emoji or a lucide icon standing in for an illustration.
- A new hex colour, shadow or gradient inline when a token or kit piece exists (this is also how `WALL_FILL` ended up twice).
- Decoration that encodes nothing, or that encodes status by colour alone.
- Art that flatters: unknown drawn as a default-good state, a weak tower made handsome, calm drawn when the data is unsurveyed.
- Adding a paragraph to explain a page that a picture could show.
- A second visual language per page (one page with a different frame, font or paper).
- Looping animation as identity. Identity is static composition first; motion is a bonus within budget.
- Copying the Fortress scene into every page. Pages get a small scene header or object, not a second 1,380-line SVG.

## 3. Balance with the noise audit
Visuals replace words, they do not add to them. Each added visual must remove or shorten text on the same page, or the page word count must stay inside its budget (`lib/wordBudget.ts`; Council 194 and Records 141 words are the benchmark). Lean is the target, not plain: Council and Records are the lean benchmark for words, not for looks. A scene header carries at most one caption line; the number and its source stay one tap away (tooltip/detail), never only in the picture.

## 4. Direction memory (read before designing; update when the look changes)
Today's look, as built on `main`:
- **Skin.** `data-skin="study"` re-points neutrals to candlelit study (dark `#140F0B/#1F1812/#2A2119`, ink `#EEE4D3`, accent gold `#D6A85A`; light parchment `#ECE3D0/#F6EFE0`, accent `#926218`). State colours (positive/negative/caution) are never overridden. Headings use `font-display` (Marcellus). Defined in `frontend/src/index.css`.
- **Frame and HUD.** `.game-frame` dark iron with gilded rule and four cast corners; `.game-hud` resource bar (`components/fortress/GameFrame.tsx`). Gold gradient `#fff0b8 > #d9a93e > #6e4a12`, ink `#2a1a06`, seal red `#7a1d18`.
- **Painted scene.** Fortress SVG (`FortressScene.tsx`, `sceneWorld.tsx`, paint per weather in `lib/fortressArt.ts` `worldPalette`). Towers = holdings (height by weight class, wall material = balance sheet, crack = knife-edge), moat = moat rating, siege camp on far hills = weather (`siegeCamp`), fog = unknown, ravens = new reports (`RavenMark.tsx`), lamp/genie (`MagicLamp.tsx`, `GenieArt.tsx`), Oracle/Partner/Sal advisors, quiet life layer on terraces (never status).
- **Scrolls and seals.** Parchment scroll reader with wax seal and rollers (`ScrollStage.tsx`, `.scroll-*`, `.library-seal` in `index.css`), Scrolls library shelf.
- **Pages by score today (assumed, re-score at review):** Fortress 3; Scrolls/reader 3; Marketplace/Store 1-2; Chronicle 1; Siege Simulator 1; Council 0-1; Records 0-1; Circle 0-1.
- **Motifs to reuse, in order:** tower, moat, wall, fog, raven, scroll, seal, lamp, crest, banner, map ring, hourglass for time. Add a new motif only with a spec naming the fact it carries.
- **Files:** `docs/game-mode-fortress-2026-10-01.md` (concept to data map), `docs/fortress-art-pass-2026-10-09.md` (last art decisions), `docs/game-mode-noise-audit-2026-10-07.md` (word budgets), `docs/game-mode-team-review-2026-10-09.md` (D3 style bible, D1 Plain lens).
- **Faiz's direction (2026-10-09):** visibly a game on every game tab (painted fortress, scrolls, ravens, seals); visuals added rather than paragraphs; never at the cost of truth, accessibility or performance.

## 5. Shared kit contract
Owned by `game-feel-engineer`. Location: `frontend/src/components/fortress/kit/` (page scene header, parchment panel, seal badge, crest, banner, fog patch, plain-view toggle) with tokens in one file (`lib/gameTokens.ts` plus CSS variables), pure mapping in `lib/pageScene.ts` with tests. New pages compose from the kit; a missing piece is added to the kit first, not inlined.
