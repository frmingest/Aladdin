# Game visual identity (standard)
Rule: every game tab must look like a game, not like the normal app with a sepia filter. Visuals replace words; they never replace truth, accessibility or performance (see `game-ui-standards.md`, which wins on conflict). Method: `.claude/skills/game-visual-identity/SKILL.md`. Sprint gate: `docs/game/game-sprint-checklist.md`.

## 1. Identity ladder (score per game page, 0-3)
- **0 Generic.** `PageHeader` + `Card` + list/table. Same page would work in normal mode. (Today: Circle, Records, Siege rows, Marketplace cards.)
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
Visuals replace words, they do not add to them. Each added visual must remove or shorten text on the same page, or the page word count must stay inside its budget (`lib/wordBudget.ts`; Records 141 words is the benchmark). Lean is the target, not plain: Records is the lean benchmark for words, not for looks. A scene header carries at most one caption line; the number and its source stay one tap away (tooltip/detail), never only in the picture.

## 4. Direction memory (read before designing; update when the look changes)
Today's look, as built on `main`:
- **Skin.** `data-skin="study"` re-points neutrals to candlelit study (dark `#140F0B/#1F1812/#2A2119`, ink `#EEE4D3`, accent gold `#D6A85A`; light parchment `#ECE3D0/#F6EFE0`, accent `#926218`). State colours (positive/negative/caution) are never overridden. Headings use `font-display` (Marcellus). Defined in `frontend/src/index.css`.
- **Frame and HUD.** `.game-frame` dark iron with gilded rule and four cast corners; `.game-hud` resource bar (`components/fortress/GameFrame.tsx`). Gold gradient `#fff0b8 > #d9a93e > #6e4a12`, ink `#2a1a06`, seal red `#7a1d18`.
- **Painted scene.** Fortress SVG (`FortressScene.tsx`, `sceneWorld.tsx`, paint per weather in `lib/fortressArt.ts` `worldPalette`). Towers = holdings (height by weight class, wall material = balance sheet, crack = knife-edge), moat = moat rating, siege camp on far hills = weather (`siegeCamp`), fog = unknown, ravens = new reports (`RavenMark.tsx`), lamp/genie (`MagicLamp.tsx`, `GenieArt.tsx`), Oracle/Partner/Sal advisors, quiet life layer on terraces (never status).
- **Scrolls and seals.** Parchment scroll reader with wax seal and rollers (`ScrollStage.tsx`, `.scroll-*`, `.library-seal` in `index.css`), Scrolls library shelf.
- **Pages by score (re-scored 2026-10-13, Sprint 7, by eye from screenshots on demo data, dark and light, phone and desktop; not yet seen on real data):** Fortress 3; Scrolls/reader 3; Marketplace 3; Map 3; Records 3; Circle 3; Siege Simulator 2 (scene header and crest, a bespoke strip of the towers under attack, but the body is still panels and figures).
- **Motifs to reuse, in order:** tower, moat, wall, fog, raven, scroll, seal, lamp, crest, banner, map ring, hourglass for time. Add a new motif only with a spec naming the fact it carries.
- **Files:** `docs/game/game-mode-fortress-2026-10-01.md` (concept to data map), `docs/game/fortress-art-pass-2026-10-09.md` (last art decisions), `docs/game/game-mode-noise-audit-2026-10-07.md` (word budgets), `docs/game/game-mode-team-review-2026-10-09.md` (D3 style bible, D1 Plain lens).
- **Object art addendum (Faiz, 2026-10-11):** raster object pictures in the Stitch Master style (ink outline `#26253B`, teal roofs `#0CA5B0`/`#075960`, slate stone, timber `#8A5432`) are allowed for objects only, which show whenever Game mode is on (since 2026-10-12 there is no separate art switch; `lib/stitchArt.ts`, `ObjectArtImage.tsx`), with the SVG as the fallback and what Game mode off shows. Object pictures are now the look of game mode on every game page (Sprint 7, 2026-10-13). Teal and moss are decoration, never status; state colours are unchanged. A picture carries no fact (no status colour, count or text); a slot whose look encodes data stays SVG. The Stitch UI system (Rubik, chunky buttons, rewards) is not adopted. See `docs/game/stitch-master-object-art-2026-10-11.md` (style and rules) and `docs/game/design-master-sprint-plan-2026-10-11.md` (which objects, in which order). The earlier "hand-painted, not cartoon" direction applies to the app's chrome, scenes and kits; object pictures use the Stitch Master look.
- **Faiz's direction (2026-10-09):** visibly a game on every game tab (painted fortress, scrolls, ravens, seals); visuals added rather than paragraphs; never at the cost of truth, accessibility or performance.

## 5. Shared kit contract
Owned by `game-feel-engineer`. Location: `frontend/src/components/fortress/kit/` (page scene header, parchment panel, seal badge, crest, banner, fog patch, plain-view toggle) with tokens in one file (`lib/gameTokens.ts` plus CSS variables), pure mapping in `lib/pageScene.ts` with tests. New pages compose from the kit; a missing piece is added to the kit first, not inlined.

## 6. Game voice (Faiz, 2026-10-15; applies to every game page, dialog, caption, button, empty state and error)
Game mode talks like a game, not like a methods section. Faiz on Blindfold Years: the first copy "doesn't engage me like a game should but rather a lot of text opting me to try to understand." The numbers stay exact; only the words change.
- **Say it in one breath.** A caption is one short sentence a first-time reader gets without re-reading. Under about 12 words per sentence, everyday words, no hedges stacked in a row. If it needs a second clause to be safe, move that clause to the tooltip or "Show the rules".
- **Verbs for the player's act, nouns from the world.** Plant your stakes, Reveal the answer, Peek at the name, Caught it, Missed. Not "Stake Year +1 owner earnings", "Show the stored figure", "Lift the mask (this weakens the exercise)". Use the existing motifs (tower, moat, raven, scroll, seal, lamp, fog) when a word is needed.
- **Win and miss feel different, and neither scolds.** A result line names what happened in plain words ("Caught it: inside your stakes", "Missed: it landed above"). No grades, streaks or praise that the plan forbids; no lecture either.
- **Say it with a picture first.** If the scene or a kit piece already shows it, delete the sentence (this stands with the word budgets in section 3).
- **Short beats complete.** Put the long caveat (method, restatements, data gaps) in the rules foldout or a tooltip, never as a paragraph above the play. The truth rules still hold: unknown stays "unknown" or fog, no number is softened, "practice" pages still say so in one line.
- **Numbers as people say them.** "3.39 bn", "caught 4 of 8", "80% sure"; not "80 times in 100", not raw digit strings, not statistical jargon (confidence interval, n of 8) on the page face.
- **Same voice everywhere.** Reuse the same word for the same thing across pages (stakes, answer, mystery company, tally). Check the glossary before inventing a term.
- **Plain view and normal mode** keep exact, neutral wording; the playful voice is for game mode only. Norwegian copy follows the same rules and is reviewed by Faiz (plan decision D6).
- **Test it:** read every new string aloud. If you stumble, or a friend would ask "what does that mean?", rewrite it. Reviewers (`game-ux-designer`) score copy as part of the identity score; a page with heavy copy cannot score 3.
