# Circle of Competence and Council Chamber: making them feel like game screens

Author role: game-designer + art director. Date: 2026-10-09. Status: proposal only, nothing built, nothing under `$HOME/mnt` touched.
Read: CLAUDE.md, the 2026-10-01 fortress doc, art pass, noise audit, team review, sprint plan v2, `.claude/standards/game-ui-standards.md`, the three skills, `CompetencePage.tsx`, `CouncilPage.tsx`, `components/fortress/*`, `lib/fortressArt.ts`, `lib/rituals.ts`, `index.css`, `lib/types.ts` (Council, Competence).
Not read (not in the snapshot): the backend (`rituals.py`, `competence.py`, `rituals_v1.py`) and `tailwind.config.js`. Anything that depends on them is marked VERIFY.
Paths below are relative to `frontend/src/`.

---

## 1. Diagnosis

### 1.1 Why each page reads as normal mode

Neither page imports a single painted component. `CompetencePage.tsx:1-7` imports only `ui` (`Button, Card, EmptyState, PageHeader`) and `lib/rituals`. `CouncilPage.tsx:1-7` imports `ui` plus `Line` from `AdvisorsCard`, whose 44 px `Portrait` is the only drawing on either page.

**CompetencePage.tsx**
- `:125-133` plain `PageHeader` (title, grey subtitle, a text link "Back to the Fortress"). No banner, no crest, no frame. Compare the Fortress, which wraps its scene in `GameFrame` plus `GameHud`.
- `:138, :167, :187` three stacked `Card`s. In game mode `.ui-card` only gains a gilded edge (`index.css:99-106`), so the layout is the same card-on-card stack as every normal page.
- `:148-154` the "circle" is a 12 px tall progress bar (`h-3`). That is a form-widget idiom, and it is not a circle. The legend under it (`:155-162`) is dots plus percentages.
- `:14-20` `SEGMENT_FILL` and `rituals.ts:52-59` `STATUS_CLASS` encode inside/edge/outside with green/amber/red pills. Two problems: (a) pills are the normal-mode idiom; (b) green/red turns "do I know this sector" into a quality verdict, which is the flattery risk in the standards (rule 1).
- `:172-183` holdings as a divided list with a pill per row. This is a table in disguise, and it duplicates `data.towers`, which the ring can show.
- `:55-68, :89-97, :98` a native `<select>`, a text input and a secondary Button on every sector row, repeated for every sector in `data.sectors`. This is the biggest block of the 345 words in the noise audit (section 1).
- `:135` loading text "Drawing the circle…", with no skeleton or designed empty state.

**CouncilPage.tsx**
- `:89-97` plain `PageHeader`; `:102` one `Card`; `:111-116` a `divide-y` `<ol>`. That is a to-do list.
- `:20, :22-28` "1." numbering plus a grey/amber pill carrying the kind label. `:32-46` holdings as `rounded-md border` chips. `:48-67` plain accent links.
- `:119-128` "What the council cannot see" is a `list-disc` bullet list. Unknown is the game's most important visual state (fog) and here it is plain bullets.
- `:130-138` the advisors are a divided list. `Line` (`AdvisorsCard.tsx:55-88`) already has a `Portrait`, so this is the closest thing to a game element. It lacks the speech-bubble treatment that the Marketplace merchant and Sal already use (`index.css:397-415`).
- `:140` a grey disclaimer paragraph. The other four game pages already use `GameFooter` (noise audit, G2-2); Council and Records do not.

**Shared cause.** The study skin (`index.css:60-117`) is global and cheap, but it only recolours. Identity on the Fortress, Marketplace, Genie and Scroll pages comes from painted SVG pieces with fixed colours, and the two ritual pages got none. They were also deliberately kept short by the noise audit, so the fix has to be visual, not textual.

### 1.2 What already exists and can be reused at near-zero cost

| Primitive | Where | What it gives |
|---|---|---|
| `GameFrame` (iron and gilt frame, 4 cast corners) | `components/fortress/GameFrame.tsx:31-41`, `index.css:308-338` | Frames any hero panel; instantly the same family as the Fortress |
| `GameHud` / `HudIcon` (coin, chest, tower, sky, scales) | `GameFrame.tsx:45-129`, `index.css:341-375` | A "resource bar" of real facts. Hard-wired to `GameState`; needs an `items` prop (5-line refactor) |
| `Portrait` (Oracle, Partner busts) | `AdvisorsCard.tsx:25-53` | Characters. Exported, scalable (`className`) |
| `.market-bubble` speech bubble with tail | `index.css:397-415` | Speech banner. Used by Merchant and Sal |
| `Awning`, `Merchant` | `components/marketplace/MarketArt.tsx:17, 49` | Header ornament pattern (Marketplace) |
| Wax seal CSS (`.library-seal`, `.scroll-seal`, opened/cracked state) | `index.css:737+`, `.library-seal` | Wax seal with a "broken" variant |
| Parchment (`.scroll-paper`: token re-point to dark ink, paper gradients, noise tile) | `index.css:737-760` | A readable parchment panel in both themes. Currently tied to `data-phase` clip-path transitions, but the default (no `data-phase`) is the open paper |
| `.library-plaque`, `.library-shelf`, `.library-plank` | `index.css` (G30) | Gilded name plate and wooden shelf |
| Capsule marks (sealed, unsealed, opened) | `lib/capsules.ts` | A shape-and-text status vocabulary already approved for the Records |
| Medallions "!" (breach) and "i" (review) | `FortressScene.tsx:743-804` (`ThesisMarks`) | Status that carries a symbol, not only colour. Private to the scene; needs extracting |
| `Torch` (+ `fortress-flicker`) | `FortressScene.tsx:203-215` | Torch with flame. Uses the global gradient `#fs-glow`, so it needs its own gradient id outside the scene |
| `Banner` pennant | `FortressScene.tsx:158` | Pennant for holdings or items |
| `GhostKeep` ("?" ghost plan, dashed stakes) | `FortressScene.tsx:465` | The fog/unknown visual language |
| Fog gradient `fs-mist` | `sceneWorld.tsx:27-31` | Fog band. Defined inside `SceneDefs`, so a page-local copy with a unique id is needed |
| Weather palette (`worldPalette`) | `lib/fortressArt.ts:217` | Sky colours per level; could tint a banner. Not needed for these two pages |
| `WALL_FILL` | `lib/chronicle.ts:23` | Wall colours for miniature towers |
| `MiniScene` (small tower silhouettes) | `pages/ChroniclePage.tsx:36-100` | Precedent for a self-contained page-level SVG with its own gradient id |
| `useSceneRunning` | `components/fortress/useScenePause.ts` | Pause loops when the tab is hidden or the element is off-screen |
| `GameFooter` | `components/fortress/GameFooter.tsx` | One-line promise plus a disclosure; Council and Records do not use it yet |
| `Disclosure`, `TabBar` | `components/ui.tsx:311, 354` | Word-budget tools |
| `.font-display` (Marcellus, only in the study skin) | `index.css:92` | Title face |
| Pure-mapping test style | `lib/rituals.test.ts`, `lib/gameModeNoise.test.tsx` | `renderToStaticMarkup` plus `countWords` against `WORD_BUDGET` |

No new dependency is needed for anything below. No animated SVG filter is needed. Every new motion is `transform` or `opacity`.

---

## 2. Page proposals

Scoring: impact 1-5 ("feels like a game screen"), effort in hours. Ranked by impact / effort; the build order in section 5 differs where one piece enables another. Size S = under about half a day, M = about one day.

### 2.A Council Chamber

Real fields available (`lib/types.ts:2372-2413`): `items[]` with `kind` (8 fixed kinds in a fixed order: tripwire, thesis_review, review_due, weak_walls, no_moat, stale_analysis, outside_circle, cash), `tone` (warning or note), `title`, `text`, `holdings[]` (holding_id, name, weight_pct), `more` (count not named), `facts[]` (unused on the page today); `advisors[]` (advisor, tone, rule, text, holding, facts); `unknowns[]` (free text); `summary`; `disclaimer`; `as_of`; `demo`; `rules_version`.

**N1. Dossier cards with wax seals (impact 3, S about 3 h; ratio 1.0).**
- User sees: each agenda item is a parchment folio with a seal at its corner instead of "1." and a pill. A warning item carries a red wax seal with a triangle and "!"; a note item carries a seal with a circle and "i". The kind label sits on the folio as a gilded plaque. Holdings named in the item are pennants with their weight. Links sit at the foot, unchanged.
- Fact encoded: `item.tone`, `item.kind` (label via `COUNCIL_LABEL`), `item.holdings` and `item.more` (pennants plus "and N more"), the holding weight.
- Reuses: `.scroll-paper` token re-point (extract as `.parchment`), `.library-plaque`, the `ThesisMarks` medallion extracted as `SealMark`, `Banner` as a pennant.
- Files: `index.css` (new `.parchment`; `.scroll-paper` composes it), new `components/fortress/kit/{ParchmentPanel,SealMark}.tsx`, new `lib/seals.ts` (pure mapping tone to shape/label, tested), edit `CouncilPage.tsx` (the `Item` component only).
- Colour-blind: the seal differs by shape (triangle versus circle), glyph ("!" versus "i") and a visible text label ("Warning" / "Note"), never by red versus amber alone. Keep the text label that is there today in the kind plaque.
- Phone: folios stack full width; the seal is 28 px at the top-right, the pennants wrap. Targets stay at least 44 px for links (add padding).
- Reduced motion: nothing animates.
- Caution: inside `.parchment` the state colours (`bg-caution-subtle`) are not re-pointed and would look like dark chips on paper. Use `SealMark`, not the existing pills, inside parchment.

**N2. Advisors seated with speech banners (impact 3, S about 2 h; ratio 1.5).**
- User sees: the Oracle bust on the left and the Partner on the right of one "speaker row"; each line is a speech bubble attached to its speaker, with a tone glyph on the bubble corner ("!" for warning, "i" for note, a small moon for calm). "Why this line" stays a disclosure.
- Fact encoded: `line.advisor`, `line.tone`, `line.text`, `line.holding_*`, `line.facts` (in the disclosure). Nothing is added.
- Reuses: `Portrait` (render at 56-64 px via `className`), `.market-bubble` (alias as `.speech-bubble`; the tail flips for right-hand speakers), `Line`'s logic.
- Files: new `kit/Speaker.tsx`; `AdvisorsCard.tsx` exports `Line` (keep it for the Fortress card; add a `bubble` variant) or `CouncilPage.tsx` renders the new `Speaker` directly.
- Colour-blind: tone has glyph plus the existing text chip ("Warning" / "Note" / "Calm" from `ADVISOR_TONE_LABEL`).
- Phone: portrait above the bubble, one column. Reduced motion: none needed (static).
- Honesty: lines are hand-written and rule-triggered and are not quotations from Buffett or Munger. Keep the disclaimer (`council.disclaimer`) inside `GameFooter`.

**N3. Fog alcove for "What the council cannot see" (impact 2, S about 1.5 h; ratio 1.3).**
- User sees: a misty dashed-outline panel (not a bullet list), one line per unknown with a "?" lantern glyph. It is never collapsed, because it is honesty-critical.
- Fact encoded: one tile per `council.unknowns[]` entry, nothing more.
- Reuses: the fog gradient (page-local copy with a `useId` suffix), the ghost-plan dashed stroke and "?" from `GhostKeep`.
- Files: new `kit/FogPanel.tsx`; edit `CouncilPage.tsx:119-128`. Reusable in Circle (unmarked), Siege ("Not modelled"), Chronicle (gap days).
- Colour-blind: dashed border plus "?" plus text. Reduced motion: static. Phone: full width.

**N4. The chamber: a round table with the eight seats (impact 5, M about 5-6 h; ratio 0.9, but it is the hero).**
- User sees: at the top of the page, inside a `GameFrame`, a painted stone chamber (arches, two torches, banner) with a round table and eight chairs in the fixed agenda order. A chair with an item has a lit candle, a dossier stack and a seal; a chair with no item is plain with an outline. Pressing an occupied chair scrolls to its folio below and highlights it. At the head of the table the Oracle and the Partner portraits sit.
- Facts encoded, one for one:
  - 8 chairs = the 8 fixed `CouncilKind`s (`types.ts:2372`), in `rituals.py` order.
  - Occupied = an `items[]` entry with that `kind`. Seal shape = `item.tone`.
  - Dossier stack height = `item.holdings.length + item.more`, capped at 5 papers, with the true number printed ("7"). The number is the real count, not a score.
  - A plaque on the table: "Stored state of <date>" from `as_of`.
  - Two portraits = the two advisors that exist.
- What it must NOT imply:
  - An empty chair is not "all well". It is drawn as a neutral outline chair, not green, with no candle and no checkmark, and its label reads "<kind>: nothing found". The page already says that an empty agenda is not proof (sprint 25 doc, "Council" row); the scene must not contradict it.
  - If the agenda is completely empty, show eight neutral chairs and the existing plain sentence. No "all clear" banner, no fanfare, no animation. Clearing the agenda must not feel like a reward (standards rule 7, "no rewards"). Never print "3 of 8".
  - No gavel and no hourglass. A gavel implies a decision was made (nothing is decided here), and an hourglass is a timer (banned by rule 7). The skill rule is that decoration must map to a fact or imply none.
  - VERIFY, and a possible additive field: a seat for a kind whose input is unknown (for example `outside_circle` when no sectors are marked, or `stale_analysis` with no analyses) should be a fogged chair, not a neutral one. Today `unknowns[]` is free text, so the front end cannot map it. Proposal: an additive `kinds_unevaluated: CouncilKind[]` on `Council` (backend, not versioned text). Until then, all non-occupied seats are neutral and labelled "nothing found", and the fog alcove (N3) carries the unknowns. Decision D3 below.
- Reuses: `GameFrame`, `Portrait`, `Torch` (extracted, own gradient id), `SealMark`, `Banner`, pure `seatPositions(8)` (angle table), `COUNCIL_LABEL`.
- Implementation shape (solves text size on phones, the problem the team review flagged for the Fortress scene at `min-w-[720px]`): decorative SVG backdrop at `viewBox 0 0 720 260` (floor, arches, table ellipse), with the chairs as real HTML `<button>`/`<div>` elements positioned by percentage from `seatPositions`. Labels are therefore HTML at least 11 px, targets at least 44 px. Below 640 px the table ellipse is dropped and the seats form a 2 x 4 grid under a short banner.
- Files: new `components/fortress/kit/{CouncilChamber,Torch,SealMark}.tsx`, new `lib/councilSeats.ts` (+ test: order, occupancy, count cap, empty agenda), edit `CouncilPage.tsx` (render above the Card; keep `<ol aria-label="Council agenda">` as the accessible source of truth and mark the SVG `aria-hidden`).
- Accessibility: seat buttons have `aria-label="Reviews owed: 2 holdings. Press to jump to the item"`; empty seats are not buttons. Focus ring reuses the gold ring style (`index.css:253-261` colours; not green: the team review item D3 flags the green selection ring as reading "good").
- Reduced motion: torches static (`fortress-flicker` is already inside `prefers-reduced-motion: no-preference`, `index.css:223-226`). The only loop on the page is two torch flames, paused by `useSceneRunning` when off-screen.
- Word budget: the scene adds the 8 kind labels (about 20 words, already existing strings) and one plaque. Remove the duplicate kind pill from the folios to stay level (N1 does that).

**N5. Candle at the table centre = data age (impact 1-2, S about 1 h; VERIFY).**
- A candle at the centre of the table that is lit, dim or out using the existing `lampReading(as_of, now)` (`lib/fortress.ts:802`). Same rule and wording as `StudyDesk`'s lamp (lit within 7 days of the stored state).
- VERIFY first that `Council.as_of` has the same meaning as `GameState.as_of` (the snapshot date). If it is the compute time of the response it is always "today" and the candle would lie. Skip this win if unverified.

Not recommended for the Council: a gavel, an hourglass, a seat count, a "quorum" bar, applause or fanfare when the agenda is empty.

### 2.B Circle of Competence

Real fields (`types.ts:2445-2480`): `sectors[]` (sector, `level` know/partly/outside or null, `note`, `marked_at`, `weight_pct`, `holdings[]` {id, name, weight}); `towers[]` (holding_id, name, sector or null, `weight_pct` or null, `status` inside/edge/outside/unmarked/unclassified/not_applicable); the five aggregate weights (inside/edge/outside/unmarked/unclassified, as strings; funds and gold are excluded); `summary`; `note_max_chars`; `demo`.

Semantics that the art must preserve (from the `CompetencePage.tsx:9-12` comment and sprint 25): the app never infers a mark; no mark is "unmarked" and that is not "inside"; a holding with no sector is "no sector set"; funds and gold are "not judged".

**C1. The ring map (impact 5, M about 6 h; ratio 0.8, the hero).**
- User sees: a round map in a `GameFrame`. A drawn circle line is the boundary of what you know. Sector markers sit at fixed angles around it and move radially with their mark:
  - know: inside the circle (solid, filled marker);
  - partly ("On the edge"): ON the circle line, straddling it (half-filled marker);
  - outside: beyond the line in open ground (hollow marker with a cross-hatch);
  - unmarked: in a fog band at the outer rim (dashed outline, "?");
  - holdings with no sector: one "No sector set" mist cloud at the rim, listing its holdings by name (the backend gives `unclassified_weight_pct` and the tower names);
  - funds and gold ("Not judged"): a small camp by the gate at the bottom, count printed, not placed in any zone.
- Marker size follows the sector's real weight (`sector.weight_pct`), area proportional, bounded (reuse the bounded-scale idea of `weightScale()`, `lib/fortress.ts:109-117`). Names print only for the largest markers; the rest are numbered pins matching the list under the map. Holdings in a sector show on press (tooltip/disclosure), as in the Fortress "Quick look".
- Why this is the right metaphor: Munger's circle is a boundary, and "partly" is genuinely on the line. The data has exactly three levels plus two unknowns, which map to three zones plus fog.
- Truth rules built in (these matter more than the look):
  1. Unmarked is never drawn inside or lit. It is drawn as full-size, dashed, with "?". Unknown weight must not look small or faded: size comes from weight, opacity stays at 0.85 or higher.
  2. The big outside and unmarked markers are as visible as the big inside ones. Nothing is dimmed, hidden or shrunk to look comfortable.
  3. Inside does not mean "good holding". Add one caption line inside the map ("Inside means you know the sector, not that the holding is sound"; counts toward the budget, see section 4). Do not use green/gold glow for the inside zone; use neutral parchment and ink.
  4. Palette: do not reuse the state colours (`bg-positive/negative`) for knowledge, because green and red carry quality meaning (the study skin deliberately leaves state colours untouched, `index.css:55-58`). Decision D2 below; the default I recommend is the neutral map palette.
  5. If nothing is marked "know", the inside disc is simply empty (outline only). Do not decorate an empty circle with a lit lamp or glow; that would flatter an empty circle.
  6. Funds and gold stay unplaced ("not judged"), consistent with `survey.ts:125`.
- Layout, pure and tested (`lib/circleMap.ts`): input `Competence`, output markers `{key, angleDeg, band, r, radius, label, weight}`. Angles are fixed by sector name order (stable across marking, so a marker slides radially, never jumps around). Marker counts above 12 collapse the smallest into "N smaller sectors" (a count, no hidden facts: the list below still has them).
- Feel (optional, 15 minutes): when a mark is saved, the marker glides to its new radius in 300 ms (`transform` transition; instant under reduced motion). Fog lifting by real work is the approved progress idea (sprint plan v2, D1). No sound, no confetti, no counter.
- Reuses: `GameFrame`, fog gradient, `GhostKeep` dashed-"?" language, `WALL_FILL` not used (neutral), `Torch` pair at the sides (static), `Disclosure` for the list equivalent, `circleSegments` (kept for the legend and the `aria-label`).
- Files: new `lib/circleMap.ts` (+ test), new `components/fortress/kit/CircleMap.tsx`, edit `CompetencePage.tsx` (replace `:148-165` bar block; move `:167-185` holdings list into a `Disclosure` named "the holdings as a list").
- Colour-blind: zone is encoded by radius (position), marker fill pattern (solid / half / hollow / dashed) and printed zone names on the rings; the existing legend row stays and gains the same pattern swatches.
- Phone: `viewBox 0 0 360 360`, `width: 100%`, max-width about 520 px on desktop. At 390 px the scale is about 1.0, so 11 px labels stay 11 px. Markers are 44 px minimum targets (tap area larger than the drawn marker, like the tower hit-rect at `FortressScene.tsx` `fill="transparent"`).
- Reduced motion: static. Keyboard: markers are focusable buttons in angle order; Enter focuses the matching mark control (C4); arrow keys step through them (reuse `lib/sceneNav.ts` idea).

**C2. Shape-coded three-state control plus boundary stones (impact 3, S about 2 h; ratio 1.5).**
- User sees: the sector row's native select becomes a segmented control of three tokens with a clear unmarked state: "Know", "Edge", "Outside", plus a small "clear" action. A set mark shows a boundary stone (a small stone with the glyph and the date `marked_at`) beside the name, and a tiny scroll glyph when `note` is non-empty.
- Fact encoded: `sector.level`, `sector.marked_at`, `sector.note !== null`. Nothing is added; no "age" fade, because no rule defines a stale mark (see D5).
- Reuses: `SealMark`, `LEVEL_LABEL`, the existing `api.putCompetence/deleteCompetence` calls and `changed` logic (no logic change).
- Files: `CompetencePage.tsx:22-105` (`SectorRow`) and `kit/SealMark.tsx`.
- Colour-blind: glyph and label on each segment (solid / half / hollow). Phone: the segments are 44 px high and wrap under the name.
- Reduced motion: none. Demo mode: control disabled as today (`demo || busy`).

**C3. Marks list: trim the noise it adds (impact 1, S about 0.5 h; ratio 2, but it protects the word budget).**
- Sectors with nothing held and no mark go behind a `Disclosure` ("N other sectors, nothing held, unmarked"), closed by default. VERIFY in the backend that `sectors[]` is the full sector list (the "nothing held" branch at `CompetencePage.tsx:70-72` suggests it is), and check the real number of sectors.
- The holdings Card (`:167-185`) becomes the disclosure from C1 (the list stays available, so nothing is only a drawing).
- Together with C1 this takes the page from the 345 words the audit measured towards 300 including the map's own labels.

**C4. Press a marker, mark the sector (impact 2, S about 1 h; ratio 2).**
- Pressing an unmarked marker scrolls to its row and focuses the segmented control. This is the page's one verb ("mark what you know"), now spatial. It uses the existing write only; no new endpoint, no new write. No counter, no reward for finishing.
- Files: `kit/CircleMap.tsx` callback, `CompetencePage.tsx` ref map.

**C5. HUD strip of four facts (impact 2, S about 1.5 h; ratio 1.3).**
- User sees: under the map a resource-style bar: Inside, On the edge, Outside, Fog (unmarked plus no sector set), each with its weight percentage from the five existing aggregate strings. This replaces the legend percentages (same words, new place), so net words stay level.
- Reuses: `GameHud` generalised to `HudBar({items})` (the current `GameHud` becomes a thin wrapper), `HudIcon` style.
- Do not add a sum or a "coverage score". Show what the backend returned. Fog is the sum of two backend strings; to avoid new arithmetic in the front end, show them as two items ("Unmarked", "No sector set") rather than adding.

**C6. Optional second pass: wall rim on holding markers (impact 2, M).**
- Join `GET /game/state` (stored, read-only, as `survey.ts` already does) and show each holding's wall material as a rim colour on the marker's tooltip entry only. Risk: two axes in one picture (knowledge versus wall strength); a weak-walled tower inside the circle must not look "good". Defer until the first pass has been seen on real data. Decision D4.

Not recommended for the Circle: a fill-up progress ring toward 100% inside, a "completion" percentage, a badge for marking every sector, a coloured "danger" for outside.

---

## 3. Shared "page-scene kit"

Folder: `components/fortress/kit/`. All pieces use fixed painted colours (like the existing painted pieces), their own `useId` suffix for gradient ids (so two copies on a page do not clash, as in `MiniScene` and `GenieFigure`), and are `aria-hidden` unless they carry a label.

| Component | What it is | Built from | Circle | Council | Records | Chronicle | Siege | Marketplace |
|---|---|---|---|---|---|---|---|---|
| `GamePageHeader` | `PageHeader` replacement: dark banner strip (about 72 px phone, 96 px desktop) with a `Crest` at the left, Marcellus title plate, subtitle, actions slot, two static torches. Keeps the same props as `PageHeader` | `PageHeader` (`ui.tsx:23`), `.font-display`, `Torch`, `.game-frame` rule colours | yes | yes | yes | yes | yes | optional (has awning) |
| `Crest` | Heraldic shield with a glyph per page: Circle = ring with a compass tick; Council = round table; Records = open book; Chronicle = scroll with date ticks (no hourglass, no timer); Siege = ladder and ram; Marketplace = awning stripes | New small SVGs, 20 lines each | yes | yes | yes | yes | yes | yes |
| `ParchmentPanel` | Static parchment panel for ritual content | `.scroll-paper` token re-point extracted to `.parchment` (the scroll reader keeps its transitions and composes it) | marks list notes | folios | record folios | "What changed" lines | explanation text | the case |
| `SealMark` | Wax seal status marker with shape + glyph + text: `alert` (triangle, "!"), `notice` (circle, "i"), `sealed` (filled), `opened` (cracked, as `.library-seal[data-opened]`), `unknown` (dashed, "?"), `none` (empty ring) | `ThesisMarks` medallions, `lib/capsules.ts` marks, `.library-seal` | boundary stones | folios | 6/12-month capsules (swap their text-glyph for the seal) | gap days = `unknown` | not-modelled = `unknown` | gates already have `DoorIcon`/`Pip`; keep |
| `FogPanel` | Dashed, misted panel for unknowns with a "?" glyph | fog gradient, `GhostKeep` stroke | unmarked and no-sector | unknowns alcove | empty archive | "worker off, nothing recorded" | "Not modelled (N)" block | "Not analysed yet" |
| `HudBar` | `GameHud` with an `items` prop | `GameFrame.tsx:99-129` | four composition facts | agenda counts per tone (two numbers) | records and reviews owed | frames, stored, rebuilt | the four tiles when a result exists | already used in the store |
| `Speaker` | Portrait plus speech bubble, tail left or right | `Portrait`, `.market-bubble` | optional | advisors | optional | optional | optional | merchant already |
| `TorchPair` | Two static torches (own gradient); flame uses `fortress-flicker` | `Torch` | yes | yes | yes | yes | yes | no |
| `CircleMap`, `CouncilChamber` | Page-specific heroes | above | yes | yes | | | | |

Rules for the kit:
- At most 2 looping animations per page (torch flames), both under `prefers-reduced-motion: no-preference` only, paused via `useSceneRunning` when off-screen (the page-level `[data-paused="true"]` rule at `index.css:240` already handles this if the root carries the attribute).
- No SVG filters in the kit at all (no turbulence). Texture is the existing static data-URI noise tile on `.parchment`, which is pre-rendered, not animated.
- Everything text is HTML (at least 11 px, targets at least 44 px) on top of decorative SVG, so the phone problem of the 720 px-minimum scene is not repeated.
- Pure mappings in `lib/` with tests: `seals.ts`, `councilSeats.ts`, `circleMap.ts` (standards rule 8). Components render only.
- Cost: no new dependency. Pages are already lazy route chunks (`App.tsx:16-30`), so default mode pays nothing.

Cross-page notes: Records already has capsule marks and a calm layout (141 words) and benefits most from `GamePageHeader`, `ParchmentPanel` and `SealMark` (about 3 h). The Chronicle already has `MiniScene`; it needs only the header and a `FogPanel` for gaps. Siege already has `SiegeStrip`; it needs the header and `FogPanel` for "Not modelled". The Marketplace has its own identity (awning, merchant, Sal); leave it.

---

## 4. Hard constraints (checked against each win)

| Constraint (source) | How the proposal complies |
|---|---|
| Read-only; no new writes (fortress doc rule 1; sprint 25) | The only write on either page remains the user's own competence mark (existing `PUT/DELETE`). Council has none. Nothing here adds an endpoint |
| Deterministic mapping, no model decides a look (rule 2; CLAUDE.md rule 1) | Every shape is a pure function of stored fields (`seals.ts`, `councilSeats.ts`, `circleMap.ts`). No arithmetic beyond weighting a marker's area and capping a stack height |
| Unknown stays fog (rule 6; skill) | Unmarked, no-sector and unknown council inputs are dashed, "?", full size, text-labelled. Never default-good, never smaller or fainter for being unknown |
| Truth over flattery (standards 1) | Empty chair is neutral, not green. Empty circle is not decorated. Big outside/unmarked markers are as large as inside ones. Inside is captioned "not a quality verdict". No "all clear" celebration |
| No buy/sell wording (standards 7; tests) | New strings go through the same forbidden-words test used for `COUNCIL_LABEL` (`rituals.test.ts`: buy, sell, add, trim, invest, purchase, plus good/bad/win/score). New strings: seat labels (reuse existing), the inside caption, aria labels |
| No points, streaks, timers, rewards (standards 7; skill) | No hourglass, no gavel, no "x of 8", no completion ring, no counter for marking sectors, no fanfare. Fog lifting when a sector is marked is the approved progress idea (sprint plan v2 D1) and carries no number |
| Status never colour alone (standards 2) | Shape + glyph + text everywhere; positions encode the Circle level. Colours are neutral map tones, not green/red state colours (D2) |
| Reduced motion; no animated SVG filters (standards 3, 5) | The only loops are two torch flames in `no-preference`. Marker glide is a `transform` transition, instant when reduced. No filters in the kit |
| Keyboard, focus, 4.5:1, 44 px (standards 4) | Real buttons; HTML labels; `.parchment` tokens use the scroll reader's dark ink on paper (already contrast-checked there; re-check accent links at 4.5:1 in Chromium) |
| Demo mode first (fortress doc rule 4) | Both endpoints already return demo data and a `demo` flag. Build and screenshot against demo first; the demo competence data uses a non-standard "Technology" sector (sprint 25 note), so the first Circle render will show it as unmarked fog, which is correct |
| Word budgets (noise audit) | Add to `lib/wordBudget.ts`: `councilChamberChrome: 30` (scene labels beyond existing strings), `circleMapChrome: 40` (zone names, inside caption), keep Council default view at or under about 230 words (today 194) and Circle at or under about 300 (today 345) by collapsing the holdings list and the unheld sectors. Test with `renderToStaticMarkup` + `countWords` as in `gameModeNoise.test.tsx`. Visuals replace words (seal for pill, seat for label) rather than add paragraphs |
| One footer (noise audit G2-2) | Adopt `GameFooter` on Council (and Records); the advisors' not-a-quotation disclaimer moves inside its disclosure |
| Status honesty (CLAUDE.md) | Any write-up must say "written, not yet deployed" and name what was not seen on real data |

---

## 5. Sprint slice (about 1.5-2 days)

Order is chosen so each step is shippable and tested on its own.

1. **Kit foundation (about 3-4 h).** `.parchment` CSS (extract from `.scroll-paper`, scroll reader unchanged), `SealMark` + `lib/seals.ts` + test, `Torch` with own gradient, `FogPanel`, `HudBar` refactor (`GameHud` calls it), `Crest` set of two (Circle, Council) first, `GamePageHeader`. Add budgets to `wordBudget.ts`.
2. **Council quick wins (about 5 h).** N1 dossiers (adopts `ParchmentPanel`, `SealMark`), N2 speaker row, N3 fog alcove, `GameFooter`. At this point the page already looks different with no scene yet.
3. **Council hero (about 5-6 h).** N4 chamber with `lib/councilSeats.ts` + test; phone grid fallback. Skip N5 unless `as_of` is verified.
4. **Circle (about 8 h).** `lib/circleMap.ts` + test; C1 ring; C2 segmented control and stones; C3 collapse; C4 focus link; C5 HUD. Leave C6.
5. **Verification (about 2 h, in the same slice).** Render in Chromium against demo state at 390 and 1280 px; reduced-motion on; a colour-blind simulation pass (protanopia/deuteranopia); keyboard path; word counts before and after with the same `innerText` method as the audit; `tsc`, `lint`, `vitest`, `build`. Write "written, not yet deployed, not seen on real data" in `docs/PROGRESS.md` and the project `progress.md` (documentation sync rule).

What to cut first if time runs out: N5 candle, C5 HUD, the marker glide, `Crest` for pages other than these two. Keep: N4, C1 and the truth rules; without them the pages stay "normal mode with a skin".

Ship as one PR off `main` on `feature/circle-council-scenes`, with a look-and-judge checklist for Faiz (see D7).

---

## 6. Decisions needed from Faiz

1. **Go order.** Council first (simpler, fixed 8 seats) then Circle, as above? Or Circle first because it is the more distinctive picture?
2. **Circle palette.** Neutral map tones plus shapes (recommended: knowledge is not a quality verdict) or keep green/amber/red as today (`SEGMENT_FILL`, `STATUS_CLASS`)?
3. **Unevaluated seats.** Add an additive backend field `kinds_unevaluated` on `Council` so a seat whose input is unknown is drawn as fog (chair under a sheet), or accept that all non-occupied seats are neutral "nothing found" for now? (Backend change is small and additive but is a backend change.)
4. **Wall rim on the Circle (C6).** Do you want holdings in the ring to show their wall material, accepting the two-axes risk, or keep the Circle purely about knowledge?
5. **Stale marks.** Should a mark older than some period look weathered? There is no rule today, so I did not invent one; it would need a mapping version (`rituals_v2`) and a number from you.
6. **Props.** Confirm no gavel and no hourglass (my reasons: implied decision, banned timer). If you want a table prop, a plain unlit candle stand is neutral.
7. **Page-level look-and-judge.** After the build, do you want the same five-question checklist the art pass used (does the empty chair read as "not checked" rather than "fine"; does an unmarked big sector look as important as an inside one; is it readable at 390 px; is the page quieter or noisier than before)?
8. **Header scope.** Should `GamePageHeader` replace `PageHeader` on all six game pages in this slice, or only on Circle and Council, with the rest following in a second small PR?

## 7. Not verified (state before building)

- Backend semantics: whether `Competence.sectors` is the complete sector taxonomy; the real sector count; whether `Council.as_of` is the snapshot date; whether any unevaluable Council kind is already recorded somewhere.
- Contrast of accent links on `.parchment` (values come from the scroll reader's token re-point; check in Chromium).
- Nothing here was seen in a browser; sizes and hours are estimates from reading code, not from a build.
