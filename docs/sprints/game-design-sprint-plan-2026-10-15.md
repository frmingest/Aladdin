# Game design sprint plan: Contest 3 (2026-10-15)

Status: **E1 (Blindfold Years) is merged ([write-up](../game/blindfold-years-2026-10-15.md)). E2 (Winter Rehearsal) is merged ([write-up](../game/winter-rehearsal-2026-10-15.md)). E3 (The Hearth) is written and tested on branch `feature/hearth`, PR open, not merged, not deployed ([write-up](../game/hearth-2026-10-16.md)); it keeps the winter order in a new small table, not the journal. E4, E5 and the bucket are proposed, not started: nothing in them is built, committed or deployed.** It comes from a four-expert design contest run on 2026-10-15 (progression, narrative, core mechanics, UX and game feel), judged by Claude. The experts worked from the Claude project docs only; none of them verified the repo. Every "already shipped" and "not shipped" claim below comes from those docs. **First step of every sprint: `git status`, `git log --oneline -15`, and `grep`/`find` for the files a sprint claims to build on** (this plan was written against `main` at `872029b`, #155, on 2026-10-15; `E:\Aladdin` can be stale, so `git pull` first).

Related: [design-master-sprint-plan-2026-10-11.md](../game/design-master-sprint-plan-2026-10-11.md) (art pipeline, closed), [stitch-master-object-art-2026-10-11.md](../game/stitch-master-object-art-2026-10-11.md) (style, rules, shared prompt block), `game-design-contest-2026-10-09.md` (contest 1 and 2 pitches; Claude project doc only, not in `docs/`), game-visual-identity standard.

## 1. How to read this plan

- **Main list (E1 to E5):** the five contest winners, in judged order, which is also the build order (Winter Rehearsal writes the orders that the Hearth shows back, so it comes first).
- **Bucket (B1 to B13):** the other thirteen distinct ideas, each fully described, parked until you pull one. Two ideas were proposed independently by two experts each (Blindfold Years, Winter Rehearsal); they are merged into E1 and E2, so 20 proposals became 18 ideas.
- **Stitch asks:** under every item. These are the pictures I need from you. Each is one object on white, in the Stitch Master look, using the shared block in section 3. Starred (★) pieces give the item most of its identity; if only starred pieces arrive, the item still ships. Anything not provided falls back to code-drawn SVG, so no sprint is ever blocked on art.
- **Sizes** are relative (S, M, L), not days.

## 2. Rules in force for every item

These are standing house rules (CLAUDE.md, the reward-knowing method, the identity standard). Each item below states how it complies; a sprint is not done if it breaks one.

1. **Reward knowing, never trading.** No streaks, daily anything, XP, timers, leaderboards, loot, or anything that makes acting feel better than waiting. Progress can go backwards honestly.
2. **All arithmetic is deterministic application code.** The LLM computes nothing and writes nothing into these features, and nothing downstream acts on its output.
3. **Evidence-first.** Every figure shows its source; a claim without an evidence ID is not shown.
4. **Unknown stays fog.** A missing period, metric or price is shown as fog, never filled, never counted as a win or a loss.
5. **No buy, sell or resize wording.** Features are mirrors, not advice. Counts show only at n of 8 or more, always printed beside any ratio.
6. **The blind pass never sees notes, thesis, moods or anything typed in these features** (architecture rule 4). A test per sprint proves it.
7. **Prompts, word lists and thresholds are versioned files** (`blindfold_v1`, `hearth_v1`, `voices_v1`): a change that could alter a shown result is a new version file.
8. **Pictures carry no fact.** Seal state, ring, fog, water level, frost depth, counts and text are drawn by code over neutral objects. Alt text is empty; the page states each fact in words.
9. **Plain view for every new page**, colour never the only signal, reduced motion (no new looping animation), text 12 px or more, phone-first, about 400 KB of art per page.
10. **Process:** one branch and one PR per sprint off fresh `main`; `ruff`, `pytest -q`, `tsc --noEmit`, lint, tests and build green before the PR; `docs/PROGRESS.md` and the project `progress.md` updated in the same PR; never merged by me; "written, not yet deployed" until you tell me or I check the live site.
11. **Identity score target 3, never below 2** for every new or changed page, with a "visual verb + scene" line (given per item).

## 3. Stitch: shared block and working rules

Paste this at the start of every Stitch prompt (it is section 5 of the Stitch Master doc, unchanged). Attach `spire-granite` (Design_master image 37) as the style reference. For a set, generate the first image, then attach it as the reference for the rest so outline and light stay identical.

```
Design a square screen that is a single full-bleed illustration of ONE object, no UI chrome, no text.
STYLE (Stitch Master): hand-inked casual-fantasy game illustration, clean dark-indigo outline (#26253B, 2-3 px at 1024), soft cel shading with warm light from the top left, light painterly texture on stone and wood, chunky friendly proportions, slightly elevated three-quarter view (about 30 degrees), the object centred with a 10% margin on all sides. Palette: slate stone #6B6E8A-#A9ADBF with small moss patches, timber #8A5432 with shade #58321C, scaled roof tiles in teal #0CA5B0 (shade #075960), iron bands, cream #EEE4D3. Windows are dark and unlit unless stated.
BACKGROUND: flat pure white #FFFFFF everywhere around the object. No sky, no ground plane, no scenery.
AVOID: any text, letters, numbers, sign lettering, logos or emblems on flags, people, animals (unless stated), ground shadow, cast shadow, reflection, glow, red or bright-green large areas, emoji, UI, frames, watermark, a second object.
Use the attached image as the style reference; keep outline weight, shading and colours identical to it.
```

Lessons carried from earlier rounds: Stitch bakes in what you did not ask for (fog, figures, counts, pennants, text), so repeat the AVOID line every time; counts and lettering are unreliable (code draws them); no aspect-ratio control (ask square, I crop); one element per image so I can key from white; windows dark, flames and glow drawn by code.

**Backdrops** are the exception: wide scenes (3:1), not keyed, optional, about 100 KB each. If a backdrop looks off, the banner is just the page's own colour.

**Two exceptions I need you to rule on** (they break the objects-only palette rules, so I will not assume them):
- **D1: faceless hooded figures.** The rule allows only the enemy soldier and Sal. Voices in the Margin (E5) and Scouting (B8) want small faceless figures. Fallback without figures: lanterns of six different shapes (E5) and ravens as scouts (B8).
- **D2: a red ribbon.** Wax seals are the one allowed red (decision 12). The Heir's Binding (B3) wants a red ribbon on gap pages. Fallback: a teal ribbon plus a dashed edge, so shape carries it.

**Existing art I will reuse before asking for new pictures** (from the project docs; I confirm against `manifest.json` at each sprint start): `seal-whole`, `seal-broken`, `casket-closed`, `casket-open`, `room-scroll`, `room-inkwell`, `room-bookshelf`, `room-lectern`, `room-hourglass`, `strata-block`, `room-sconce`, `council-table`, `council-chair`, `council-candles` (unlit, code draws flames), `circle-brazier`, `circle-stake`, `map-frame-corner`, `map-dividers`, `map-rolled`, `map-compass`, `raven`, `lamp`, `keep-granite`, the five room crests, the sector pictures from 2026-10-14, the shopkeeper and Sal busts, `prop-*`, and the masters left unpacked: pigeonholes, tomes, sundial, weathervane, cairn, chronicle book, brass pin, wave tile, signpost, telescope, lantern post, gavel.

---

# PART A: MAIN SPRINT LIST

| Sprint | Item | Verb + scene | Size | Migration | Stitch pieces (★ / total) |
|---|---|---|---|---|---|
| E1 | Blindfold Years | Stake, a river bank with a gauge post | S-M | none (per browser) | 3 / 5 |
| E2 | Winter Rehearsal | Endure, a war-table at dusk | M | none (journal note) | 3 / 5 |
| E3 | The Hearth | Kindle, a stone room in a storm | M | none | 4 / 6 |
| E4 | The Three Baskets | Sort, a gatehouse sorting room | M | **one additive table (needs your OK)** | 5 / 6 |
| E5 | Voices in the Margin | Overhear, hooded figures at a scroll's edge | S-M | none | 6 / 8 |

## E1. Blindfold Years (judged #1)

*Proposed by Expert 1 (as "The Blind Year") and Expert 3 (as "Blindfold Years"); merged, taking Expert 3's calibration mechanic.*

**Pitch.** Roll one of your holdings back to a past fiscal year, with the company name masked, and see only what was known then. Stake a low and a high figure for the next year's owner earnings, then the stored real figure is revealed. It gives you dozens of calibration reps now, from history already on file, instead of waiting months for outcomes.

**Visual verb + scene.** *Stake the flood line*, on a river bank with a gauge post: you plant two stakes, then the water rises to the real level.

**Core loop.**
1. The app picks a (holding, year) pair from stored annual periods (the ESEF/XHTML history import, `facts_by_period`) where at least 3 years precede the year and the next year is stored. Only pairs whose needed periods are complete are offered; a missing or quality-flagged figure means that puzzle is never shown (fog).
2. You see years up to year t: revenue, margins, owner earnings, net debt, ROIC. Name masked by default (sector and size class shown); a "reveal name" button exists but is labelled as weakening the exercise.
3. You drag two stakes for an 80% range on year t+1 owner earnings. Optional second question: pick the next year's existing tier band (wall material or moat band). One optional line of "why", saved with the existing journal write.
4. Reveal: the stored figure, its source filing and period, whether it fell inside, and restated figures labelled as restated.
5. Tallies by company and by range width, for example "your ranges held 5 of 8", appear only at n of 8 or more. No grade, no hit-rate arrow, no streak.
6. Where ranges keep holding, the Circle of Competence page may show a dashed-edge hint ("evidence for", never an inference, never automatic).

**Data and arithmetic.** Stored extracted data only; "inside the range" is plain comparison code; tiers use the existing deterministic tier functions. Reported ratios only, never prices, so the price and split fixes cannot contaminate it. A new `blindfold_v1.json` holds the eligibility rules (minimum prior years, which metrics) as a versioned file. No LLM involved.

**Rules check.** No trade verbs. Caption: "practice, not measurement; a number can still give a company away." Nothing typed here reaches the blind pass, verdict or temperament (test). Companies with known gaps (Kongsberg and Bouvet D&A, Salmon FY2020 to 21 scale) simply do not appear for the affected years. The pool is finite (about 20 to 30 puzzles) and the page says when it has run out.

**Why it works here.** Prediction then feedback on a small personal set (the generation effect, poker-style calibration). It turns "I can't forecast this one" into a measured fact and teaches that durable economics persist more than people expect, with no price in sight.

**Build.** Backend: eligibility reader over `facts_by_period` plus a pure function returning a puzzle (masked years, target, stored answer withheld until reveal). Frontend: scroll-shell page `Blindfold`, stake slider with keyboard control, reveal panel, Plain view as a table. State stays in the browser (versioned local key) for v1; a server table is a bucket extension, not part of this sprint.

**Tests.** Eligibility excludes every gap case; answer never present in the puzzle payload before reveal (API test); range-hit comparison edge cases (equal to bound, restated figure); n-gate; masked name not in payload; blind-pass isolation test.

**Cut line.** The optional tier-band question, the Circle hint, the "why" line. Never the Plain view, the fog rule or the n-gate.

**Identity target.** 3: scene header (river bank), stakes and gauge as the encoded fact (range width and water level), Plain view.

**Biggest risk.** You already know these eight companies, so masking is weak; mitigated by the practice framing and the masked default.

**Stitch asks (E1)**

| ID | ★ | Image | Prompt after the shared block | Notes |
|---|---|---|---|---|
| E1-1 | ★ | Gauge post | `Subject: a tall upright wooden gauge post with three brass bands and a pointed iron foot, no marks, no numbers, no text.` | Code draws tick marks and the water level. |
| E1-2 | ★ | Flood stake | `Subject: one short wooden stake with an iron-shod tip and a teal cloth strip tied near the top, standing upright.` | Code duplicates it for low and high stake and flips the cloth for the high one. |
| E1-3 | ★ | Veiled tower (masked company) | `Subject: a small round stone tower completely covered by a draped grey cloth veil tied with a cord, no windows visible, no flag.` | Also reused by B2 Fresh-Money Duels. |
| E1-4 |  | Sealed future scroll | `Subject: a closed parchment scroll tied with a plain cord, no seal imprint, no writing.` | Optional; I reuse `room-scroll` if you skip it. |
| E1-5 |  | River-bank backdrop | `Subject: a wide quiet river bank at dawn, reeds, a stone bank, a wooden gauge post on the right, no people, no text, 3:1 wide.` | Optional, not keyed. |

---

## E2. Winter Rehearsal (judged #2)

*Proposed by Expert 2 (five-card story) and Expert 4 (real-fall replay); merged. Version 1 is the real-fall replay (data exists today); the five-card story is version 2 once the L2 scenario error bars exist.*

**Pitch.** In calm weather, write your own winter order, then watch the worst real fall in your stored 730 days replayed against today's weights. At the trough the screen shows only your own words, kroner lost and days under water, and nothing else.

**Visual verb + scene.** *Endure*, a war-table at dusk with five candles that go out one by one; frost climbs the Fortress walls as you scrub through the fall.

**Core loop (v1).**
1. Open the table. First card: "Write your winter order": one line, "If this happens, I will first check ___" (existing journal-note write; no new table).
2. A manual slider (Play off by default) scrubs through the worst stored drawdown window using the C1 back-test data and today's weights. Kroner and days under water are read off in numbers; frost depth is a numeric readout with the picture drawn by code.
3. At the trough the slider pauses and the page shows only your written order and the numbers. No outcome, no score, no "well done".
4. Holdings without stored prices appear as fog towers; coverage is stated ("5 of 8 holdings had stored prices").
5. If the worst stored fall is under 10%, the page says "no real winter in your window". An optional beta-times-fall model winter is available and labelled "a model, not a forecast".
6. Your order is then shown by the Hearth (E3) when a real storm arrives.

**Version 2 (later, once `siege_scenarios_v3` exists).** Five raven-note cards: index fall with error bars and the unmodelled share as fog; your own invalidation line beside the live metric; the vault in plain facts; one card naming the bias voice (E5); then your if-then line. Permanent caption "a what-if, not a forecast".

**Data and arithmetic.** Stored price history, the C1 back-test code and the Siege simulator's deterministic functions. Nothing new is computed by an LLM.

**Rules check.** Read-only except the existing journal write. No streak, replay reward, timer or push. Nothing says what to do. Coverage always stated; the beta-based model is always labelled coarse because the back-test already shows wide misses. The typed order never reaches the blind pass (test).

**Why it works here.** An implementation intention ("if X, I will first check Y") written in calm and met again at the trough is among the best-evidenced ways to turn intent into behaviour (a Ulysses contract). It speaks directly to becoming a calmer owner of an Oslo book with a high-beta energy position.

**Build.** Frontend page `WinterRehearsal` in the Siege area reusing the Camera and Siege components; backend endpoint returning the replay series and coverage from the C1 data; journal entry type `winter_order`.

**Tests.** Coverage computation with missing prices; "no real winter" threshold; replay series equals C1 series on a fixture; deterministic output; no order text in the blind-pass input.

**Cut line.** Frost art, optional model winter, the backdrop. Never the "no real winter" honesty state or the coverage line.

**Identity target.** 3 (frost depth is the encoded fact; Plain view is the table of date, value, kroner, days under water).

**Biggest risk.** One mild episode under-trains; the "no real winter" state must be good enough that nothing pushes toward a faked path.

**Stitch asks (E2)**

| ID | ★ | Image | Prompt after the shared block | Notes |
|---|---|---|---|---|
| E2-1 | ★ | Icicle cluster | `Subject: a cluster of five translucent icicles hanging from a short stone ledge, pale blue-white ice with a thin dark outline.` | Code places copies by frost depth. Counts are not baked. |
| E2-2 | ★ | Winter-order tablet | `Subject: a blank wax writing tablet in a wooden frame with a small bone stylus resting on it, no marks, no writing.` | Where your order is shown. |
| E2-3 | ★ | War-table | `Subject: a long empty oak war-table in three-quarter view with a plain teal cloth runner and iron-bound edges, nothing on it, no chairs.` | Candles are reused (`council-candles`, code draws and snuffs flames). |
| E2-4 |  | Snow drift | `Subject: a low rounded snow drift mound with a few small stones poking through, white-blue shading.` | Optional; fog-grey on white may key badly, so say if it fails. |
| E2-5 |  | Dusk war-room backdrop | `Subject: a wide stone war-room at dusk, a window with falling snow, an empty table, five unlit candle stands, no people, no text, 3:1 wide.` | Optional, not keyed. |

---

## E3. The Hearth (judged #3)

*Proposed by Expert 2.*

**Pitch.** When the stored weather turns to gathering or besieged, or the index falls past a versioned line, a quiet room opens. It sorts the day into what moved (prices, weights), what held (wall tiers, moat, thesis status, tripwires) and what changed, then shows your own words from a calm day. Outside a storm the door is shut and says so in one line.

**Visual verb + scene.** *Kindle*, a stone room in a storm with shuttered windows. Each holding is a log on the fire: the bark shows the price fall, the heartwood shows whether the wall tier changed.

**Core loop.**
1. Trigger: the stored siege level, or an index move from the C1 data crossing a threshold in `hearth_v1.json`.
2. Three shelves from the existing Chronicle and Night Watch `diff_frames`: **Moved**, **Held**, **Changed**. If any wall tier or thesis status changed, **Changed opens first** and the room looks bleak. It is never comfort-only, and "Held" is never ranked above a breach.
3. A fourth shelf shows your own invalidation lines verbatim with date and journal entry id, each beside the live value of the metric it names, plus your Winter Rehearsal order (E2) if you wrote one.
4. A fifth shelf, "What the record says about storms", shows the C1 back-test (worst stored fall, days under water).
5. If the worker was off, the room says "nothing recorded for those days", never "calm".

**Data and arithmetic.** Frame diffs are code; every line cites a frame date or journal entry id; threshold file versioned.

**Rules check.** No "stay calm", buy, sell or hold wording. Copy is symmetric. A test asserts the room never ranks "Held" above a breach and that a changed wall tier always puts "Changed" first. Journal text shown is verbatim, not paraphrased by an LLM.

**Why it works here.** Naming what has not changed is a recognised way to reduce fear (affect labelling plus reappraisal), delivered at the exact moment you are least calm, using your own earlier words.

**Build.** Frontend room `Hearth` under the Fortress rooms with a banner and Plain view; backend endpoint composing the diff, journal lines and C1 summary; no migration.

**Tests.** Trigger thresholds; ordering rule ("Changed" first when any change); worker-off gap wording; verbatim journal text with ids; no motion under reduced motion.

**Cut line.** Backdrop, window shutters art. Never the symmetry rule or the "nothing recorded" wording.

**Identity target.** 3 (log bark versus heartwood encodes two different facts; Plain view is the three-shelf list).

**Biggest risk.** It could read as talking you out of selling; the symmetric "Changed" shelf and the ordering test are the defence.

**Stitch asks (E3)**

| ID | ★ | Image | Prompt after the shared block | Notes |
|---|---|---|---|---|
| E3-1 | ★ | Hearth | `Subject: a stone fireplace with an empty iron grate, no fire, no logs, no ash, plain mantel.` | Code draws constant embers; no flicker. |
| E3-2 | ★ | Log, three-quarter | `Subject: one short split log in three-quarter view, rough brown bark along the side and pale heartwood growth rings on the cut end, no text.` | Bark = price move, heartwood = wall tier. Generate first; the others follow its reference. |
| E3-3 | ★ | Shuttered window | `Subject: a stone window arch with two closed timber shutters and an iron latch, closed, no light.` | |
| E3-4 | ★ | Shut door | `Subject: a closed oak door in a stone arch with iron bands and a plain ring handle, no sign, no text.` | The "no storm" state. Also reused by B12. |
| E3-5 |  | Wall shelf | `Subject: a plain wooden wall shelf on two iron brackets, empty.` | Three copies for Moved, Held, Changed. I reuse `room-bookshelf` if skipped. |
| E3-6 |  | Storm-room backdrop | `Subject: a wide stone room interior in a storm, shuttered windows, a cold hearth, an empty table, no people, no text, 3:1 wide.` | Optional, not keyed. |

---

## E4. The Three Baskets (judged #4)

*Proposed by Expert 1.*

**Pitch.** Every watchlist or Marketplace name sits in one of three baskets with a written reason: **worth studying**, **no**, or **too hard**. A "too hard" name lists exactly which facts are missing, and it moves only when real facts arrive.

**Visual verb + scene.** *Sort*, a gatehouse sorting room with three baskets of sealed petitions; the too-hard basket is tied shut with a loose grey cord.

**Core loop.**
1. Put a name in a basket with one line of reasoning (your own input; the app never decides).
2. For "too hard", the page auto-lists the missing facts from the existing eight gates, survey level and fog (for example "no annual loaded, sector not marked, no owner earnings").
3. A revisit condition is an event, not a date, from a fixed set: a new annual or interim captured, a circle mark changed, or price crossing your buy-below. When it occurs, the petition moves to the Council agenda.
4. A name can move from "too hard" to "worth studying" only if its fog items are no longer fog. The basket can shrink only by learning.
5. No ranking, no return comparison, and no basket implies buy or sell.

**Data and arithmetic.** Missing-facts lists and event triggers read stored state deterministically. One additive table: `basket_entries` (holding or watchlist id, basket, reason text, created/changed timestamps). **This needs your explicit OK before I write the migration** (Alembic migration in the same PR, up/down/up tested).

**Rules check.** The first basket is named "worth studying", never "to buy", with a wording test like the existing ones. Reason text is stored but never reaches the blind pass (test). Legacy tables stay untouched.

**Why it works here.** The "too hard" pile is Buffett and Munger's most useful rule, and retail investors mostly go wrong outside their competence. Open petitions give a calm reason to return (they close on a real event) with no timer.

**Build.** Backend: model, migration, endpoints, missing-facts reader, trigger evaluator feeding the Council agenda. Frontend: sorting-room page (three baskets, drag or keyboard move), reason field, missing-facts list, Plain view as three lists.

**Tests.** Move rules (fog must be lifted to leave "too hard"); trigger evaluation per event type; Council agenda item creation; wording test; migration round trip.

**Cut line.** The revisit triggers (keep a manual "revisit" note) and the backdrop. Never the fog rule on "too hard".

**Identity target.** 3 (basket silhouette, cord and petition count are the encoded facts; Plain view is the three lists).

**Biggest risk.** The first basket could read as a to-buy list; mitigated by naming and the wording test.

**Stitch asks (E4)** (three baskets must differ by **silhouette**, not colour, because colour is never the only signal)

| ID | ★ | Image | Prompt after the shared block | Notes |
|---|---|---|---|---|
| E4-1 | ★ | "Worth studying" basket | `Subject: a tall round open wicker basket with two handles, empty, brown wicker with a teal cloth lining.` | Generate first. |
| E4-2 | ★ | "No" tray | `Subject: a low flat wooden tray with raised edges, empty, no lid.` | Different silhouette from E4-1. |
| E4-3 | ★ | "Too hard" hamper | `Subject: a squat lidded wicker hamper with the lid closed and tied shut with a double-knotted cord.` | Cord is a loose grey cord; keep it neutral, not black. |
| E4-4 | ★ | Petition | `Subject: a small rolled petition scroll tied with a short plain cord, no seal, no writing.` | Code makes copies; counts are not baked. |
| E4-5 | ★ | Fog-corded petition | `Subject: the same petition scroll tied with a loose, frayed grey cord and one dangling end.` | Marks "missing facts". |
| E4-6 |  | Sorting desk | I reuse the unpacked pigeonholes master. | Ask only if that master is unusable. |
| E4-7 |  | Gatehouse backdrop | `Subject: a wide stone gatehouse sorting room, a wooden counter, three empty alcoves, a barred window, no people, no text, 3:1 wide.` | Optional, not keyed. |

---

## E5. Voices in the Margin (judged #5)

*Proposed by Expert 2.*

**Pitch.** A hand-written, versioned word list, in English and Norwegian, flags bias language in your own journal text, such as "can't lose", "everyone says", "it must bounce", "since I already paid", "guaranteed". A small hooded voice appears in the margin with the quoted phrase and one original line of Munger-style lesson. It is playful, so a discipline tool does not feel like a scold.

**Visual verb + scene.** *Overhear*, tiny hooded figures with lanterns at the edge of a scroll. Six voices with six different silhouettes: **Hope, Fear, Crowd, Anchor, Sunk Cost, Certainty**.

**Core loop.**
1. You write a journal entry or thesis. On save, and in Records, matched spans are underlined.
2. Pressing one opens a card: voice name, the matched phrase, a two-sentence lesson from `voices_v1`, and "a word list, it can be wrong".
3. Dismiss is one key and nothing blocks saving. Dismissals are remembered per browser.
4. Records shows a plain count, "voices heard in your notes", with no grade or trend arrow. It shows nothing when nothing matches and never praises.

**Data and arithmetic.** Pure string matching, no LLM. Each flag cites the matched span and the word-list version. Computed on read, so no migration.

**Rules check.** Runs only in the journal UI. Results never reach the blind pass, verdict, temperament or any prompt (test). Lessons are original, hand-written, with sources cited by title only. Both English and Norwegian lists (you are based in Norway; tell me if you only want one). Plain view is a labelled list: shape plus word for each voice, no motion.

**Why it works here.** Naming a bias as a character is self-distancing, a recognised debiasing method, and fits the Munger misjudgment curriculum. It is the lightest feature in the plan and the most charming.

**Build.** `voices_v1.json` (words, voice, lesson), a pure matcher with unit tests, an underline layer in the journal editor and Records, the margin card component.

**Tests.** Matcher precision on a fixture of positive and negative sentences in both languages; no match inside quoted evidence text; isolation from blind pass; dismissal persistence; Plain view parity.

**Cut line.** The Norwegian list (ship English first if time is short, but I would ask you before cutting it), the Records count.

**Identity target.** 3 (six shapes, underline, lantern; Plain view is the labelled list).

**Biggest risk.** False positives or cringe; fixed by a short conservative list, a visible "wrong?" dismiss, and a measured-hit playtest before widening.

**Stitch asks (E5)** (**needs your ruling on D1**: faceless figures, or the lantern fallback)

If D1 = yes (figures), one small faceless hooded figure each, same scale and pose language, hood fully shadowed, no face visible, no eyes:

| ID | ★ | Image | Prompt after the shared block (replace "people" in AVOID with "faces") | Notes |
|---|---|---|---|---|
| E5-1 | ★ | Hope | `Subject: a tall slim faceless hooded figure in a teal cloak holding a lantern raised high on a staff, standing upright.` | Generate first. |
| E5-2 | ★ | Fear | `Subject: a small hunched faceless hooded figure in a grey cloak clutching the cloak closed, lantern held low.` | |
| E5-3 | ★ | Crowd | `Subject: one wide merged silhouette of several overlapping faceless hooded figures sharing one lantern.` | Count is not baked; it must read as "many" by silhouette. |
| E5-4 | ★ | Anchor | `Subject: a faceless hooded figure in a brown cloak with one hand gripping a heavy iron anchor planted beside it, lantern on the ground.` | |
| E5-5 | ★ | Sunk Cost | `Subject: a faceless hooded figure sitting beside a large half-buried stone block with one hand resting on it, lantern beside it.` | |
| E5-6 | ★ | Certainty | `Subject: a stiff, perfectly upright faceless hooded figure holding a straight rigid staff, lantern at its feet.` | |

If D1 = no, replace E5-1 to E5-6 with six **lanterns of six different shapes** (hexagonal, round, tall slim, squat, hanging, shuttered), one image each, same lantern rules. Add one optional ask: **E5-7** margin pointer (`a small wooden reading pointer with a carved hand at the tip`), and **E5-8** a lantern-lit scroll edge backdrop (optional, I reuse `room-scroll` if skipped).

---

## Main list: Stitch totals

| Sprint | ★ must-have | Optional | Total new pictures |
|---|---|---|---|
| E1 | 3 | 2 | 5 |
| E2 | 3 | 2 | 5 |
| E3 | 4 | 2 | 6 |
| E4 | 5 | 1 | 6 (one reused) |
| E5 | 6 | 2 | 8 |
| **Main** | **21** | **9** | **30** |

Suggested Stitch order: E1-1 to E1-3 (needed first), then E2 ★, then E3 ★, then E4 ★, then E5 (after you rule on D1). Backdrops last, and only if the first ones look good in place.

## Decisions (ruled 2026-10-15: Faiz said "for all decisions, go as you recommend"; D1 to D8 all take the Recommended column)

| # | Decision | Recommended |
|---|---|---|
| D1 | Faceless hooded figures allowed (E5, B8), or lanterns and ravens instead | Lanterns and ravens (no rule change); figures only if you want them |
| D2 | A red ribbon allowed for B3 (like the wax seals), or teal ribbon plus dashed edge | Teal plus dashed (shape carries it) |
| D3 | E4 migration: one additive `basket_entries` table | Yes, when E4 starts |
| D4 | E1 and E2 store state in the browser first (no server table); server persistence later | Yes |
| D5 | E2 version 1 uses the existing journal note instead of a new table | Yes |
| D6 | Norwegian copy and word lists (E5; also any lesson text) written by me, reviewed by you | Yes |
| D7 | Backdrops: skip all, or try one per sprint and keep what looks good | Try one per sprint |
| D8 | Build order E1 to E5 as listed | Yes |

---

# PART B: THE BUCKET

Thirteen ideas, ranked 6 to 18 by the judge. Each is described fully so you can pull any of them into a sprint without re-reading the contest. They follow the same rules as section 2. "Pull" means: you say which, I confirm the repo state, write a sprint like the ones in Part A, and request the Stitch pieces listed.

## B1. The Mill Race (judged #6, Expert 4) · Size M · No migration

**Pitch.** On a holding, reported profit enters a mill race. Sluice gates take D&A back, then capex, leases and decommissioning; what turns the wheel is owner earnings. You open the gates one at a time, and pressing a gate opens the filing at that exact number.

**Verb + scene.** *Trace*, a mill race with sluice gates beside the tower.

**Loop and data.** Stored owner-view metrics, the completeness manifest and the distortion flags; gate widths are stored figures with sources, following the app's own owner-earnings definition. You learn why headline earnings and owner earnings differ and which holdings you cannot know yet.

**Rules.** A missing input (Kongsberg and Bouvet D&A) becomes a fog gate and the wheel reads "can't be ranked". Distortion flags show as driftwood with the real flag text. Loss-makers (Vend, Salmon, Vår Energi) get a dry race. Widths always carry numeric labels; vertical on a phone; at most one paused flow loop, none under reduced motion. The capex gate must say "capex, all of it" because the app does not separate maintenance from growth capex.

**Risk.** Claiming more than the data supports; the labelling above is the defence.

**Stitch asks (B1)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B1-1 | ★ | Sluice gate, closed | `Subject: a timber sluice gate set in a stone channel wall, lowered closed, iron winch on top, no water, no text.` |
| B1-2 | ★ | Sluice gate, open | `Subject: the same sluice gate raised open with a clear gap at the bottom, no water.` |
| B1-3 | ★ | Waterwheel | `Subject: a wooden mill waterwheel on a stone mount, still, eight paddles, no water.` |
| B1-4 |  | Channel segment | `Subject: a straight stone water channel section, open at both ends, calm water inside, three-quarter view.` |
| B1-5 |  | Dry channel segment | `Subject: the same channel section completely dry, cracked pale mud floor.` (Code decides which to show; loss-makers get the dry one.) |
| B1-6 |  | Driftwood bundle | `Subject: a small tangle of driftwood sticks bound with a bit of rope.` (Flag marker.) |

## B2. Fresh-Money Duels (judged #7, Expert 3) · Size M · No migration to start

**Pitch.** Two veiled holdings appear with only their owner facts (ROIC, leverage, owner-earnings yield, margin-of-safety range, years on record), and you pick which you would give fresh money to. After about 16 duels your own ranking is set beside your real weights.

**Verb + scene.** *Weigh*, the tourney lists: two veiled banners hang on a field, you lift one, the veils drop to show names and sizes.

**Loop and data.** Deterministic merge-sort order covers 8 holdings in about 16 duels; names and weights hidden to cut anchoring. "Too close to call" and "can't judge" (fog) are first-class answers. The reveal says things like "largest weight, your rank 6 of 8" and counts which fact separated winners from losers ("winner had higher ROIC in 11 of 16"). Ranking is plain code (Copeland count); facts come from existing board data. The Oracle's verdict is left out or shown as the blind pass only.

**Rules.** Caption "a mirror, not advice"; no suggested trades or resize verbs; never shown as good or bad. A dated `lineups` table is a later additive option.

**Risk.** It reads as a rebalancing signal; mitigated by the caption and by building the ranking only from fact cards that exist.

**Stitch asks (B2)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B2-1 | ★ | Veiled banner | `Subject: a banner pole with the banner completely covered by a draped grey cloth veil tied at the bottom, no emblem.` |
| B2-2 | ★ | Unveiled plain banner | `Subject: the same banner pole with a plain teal banner, no emblem, no text.` |
| B2-3 | ★ | Brass balance scale | `Subject: a small brass balance scale on a wooden stand, both pans level and empty.` |
| B2-4 |  | Tourney fence | `Subject: a short section of low timber tourney barrier fence with two posts.` |
| B2-5 |  | Veiled tower | I reuse E1-3. |

## B3. The Heir's Binding (judged #8, Expert 1) · Size S-M · No migration

**Pitch.** For each holding, the app assembles a bound one-page folio: why you own it, what would prove you wrong, the lines you set, where the documents are and what is still unknown. The progress is "could a stranger understand this book safely".

**Verb + scene.** *Bind*, an archive chamber where each tower has a vellum codex on a lectern; a ribbon marks any page with a gap.

**Loop and data.** Each folio pulls only what you already wrote or the app stored: journal thesis and invalidation, tripwires, Circle mark, last verdict (labelled blind), moat and wall tiers, document list. A deterministic completeness check shows a missing invalidation or unlinked document as an empty page ("no reason on record"), never filled in. The quarterly Council may offer one gap to fill. Optional print or PDF with a no-names option (fits the planned D8 print sheet).

**Rules.** The LLM writes nothing into a folio. No account numbers or credentials are stored or asked for. Hard scope: reasons and rules only.

**Risk.** Drift into handling sensitive estate data; the scope above is the defence.

**Needs D2** (red ribbon or teal plus dashed).

**Stitch asks (B3)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B3-1 | ★ | Closed codex | `Subject: a thick closed vellum-bound book with a leather strap and a brass clasp, plain cover, no title, no emblem.` |
| B3-2 | ★ | Open codex | `Subject: the same book open on two blank cream pages with a plain decorative border, no writing.` |
| B3-3 | ★ | Ribbon marker | Per D2: `Subject: a single long silk ribbon bookmark lying in a loose S shape, [teal / red].` |
| B3-4 |  | Lectern | I reuse `room-lectern`. |
| B3-5 |  | Archive backdrop | `Subject: a wide quiet stone archive chamber, rows of empty lecterns, an arched window, no people, no text, 3:1 wide.` |

## B4. The Punch Card (judged #9, Expert 3) · Size S-M · One additive settings value

**Pitch.** Buffett's card with 20 punches for a lifetime, as a self-set yearly budget of discretionary decisions. Each new position or sizeable add punches one hole, so acting visibly costs something and waiting is free.

**Verb + scene.** *Punch*, a brass ticket card hung by the Keep's gate; holes show decisions used, the rest are blank.

**Loop and data.** You set the number (for example 8 a year) and what counts (default: new positions and adds above 25% of a position). Exits and thesis-break trims never punch, so selling a broken thesis is never discouraged. A buy in the journal shows "this is hole 4 of 8 for 2026; the last was 12 Aug". A position change with no journal entry (existing churn detection) appears as a dashed "unlogged change" hole. Counts come from the journal and snapshot diffs.

**Rules.** The limit is "your rule" in a versioned file; it never blocks and writes nothing to the portfolio. No streaks (an empty month counts for nothing) and no reward for unpunched holes; copy never praises a full card.

**Risk.** You stop journaling to avoid punching; unlogged changes still show as dashed holes.

**Stitch asks (B4)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B4-1 | ★ | Ticket card | `Subject: a blank brass-edged cream ticket card with a hanging cord at the top, no holes, no text, no lines.` (Code draws holes.) |
| B4-2 | ★ | Hole punch | `Subject: a conductor's hand punch (pliers with a round die), closed, brass and iron.` |
| B4-3 |  | Gate hook post | `Subject: a short wooden post with an iron hook, standing upright.` |

## B5. Turned from the Gate (judged #10, Expert 2) · Size M · One additive value or migration for a "pass" action

**Pitch.** Declining a watchlist name becomes a recorded, dated decision with a reason from a short fixed list. At 6 and 12 months the ledger checks whether the reason still holds, using facts only. It never reports the price move you "missed".

**Verb + scene.** *Refuse*, a road gate where a laden cart is turned back; it carries a dated tag and a sealed reason, and the road beyond stays in fog.

**Loop and data.** Reasons: too dear, weak walls, no moat, outside my circle, too hard, not enough information; each maps to one stored, checkable fact (price against bull case, wall tier, moat finding, Circle mark, missing analysis). A review line reads, for example, "Your reason: too dear (price above bull). Now: price 4% below bull. The reason no longer holds. A reason to study, not a signal." A reason with no checkable fact reads "can't be checked yet" (fog).

**Rules.** Deterministic mapping; no "missed gain" figure; no right/wrong colour; counts gated at n of 8, like C2. Overlaps E4 (Three Baskets), so only one of them should be built first; if E4 ships, this can reuse its table.

**Risk.** It becomes a regret engine; the facts-only wording bans hindsight.

**Stitch asks (B5)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B5-1 | ★ | Road gate | `Subject: a closed wooden road gate with two stone posts and an iron latch, plain, no sign, no text.` |
| B5-2 | ★ | Laden handcart | `Subject: a small two-wheeled handcart loaded with plain sacks, facing away to the left, no people.` |
| B5-3 | ★ | Dated tag | `Subject: a small blank wooden tag hanging from a short string, no writing.` |
| B5-4 |  | Shuttered stall | I reuse existing stall art if it is packed (to confirm); otherwise `Subject: a market stall with its front fully shuttered and a blank tag.` |

## B6. Tide Marks (judged #11, Expert 4) · Size S-M · No migration

**Pitch.** The moat water on today's towers is the analyst's claim. Beside it, each stored year's ROIC above your hurdle is drawn as a tide line on the quay wall, so claim and evidence sit side by side.

**Verb + scene.** *Measure*, tide marks cut into the moat quay.

**Loop and data.** Stored annual ROIC and the valuation's own discount rate, labelled "your hurdle". You see whether returns stayed above the line or whether the claimed width exceeds the evidence. A missing year is a fog gap; a year below the hurdle is a dry mark. Banks get a different gauge or fog because ROIC is not meaningful for them.

**Rules.** Caption "n = 6 years" with numbers; the mismatch is stated without verdict colours, ranking or buy/sell words; marks differ by shape, labels are numeric, no motion.

**Risk.** Cyclicals (Equinor, Aker BP) swing widely and a noisy six-point line could read as "no moat"; it must not become a verdict.

**Stitch asks (B6)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B6-1 | ★ | Quay wall section | `Subject: a straight section of stone quay wall seen from the water side, smooth blank face, a few stone blocks, no marks, no text.` |
| B6-2 |  | Mooring ring | `Subject: a single iron mooring ring set in a stone block.` |
| B6-3 |  | Brass pin | I reuse the unpacked brass pin master (tide-mark pins). |

## B7. Inner Weather (judged #12, Expert 4) · Size S-M · One additive nullable column

**Pitch.** When saving a journal entry you may tap one hand-mirror glyph for how you feel: calm, restless, afraid, eager or flat. It is stored with the entry and shown beside the realm's weather that day, so you see your own pattern of when you write decisions.

**Verb + scene.** *Name*, a small hand mirror in the margin of the decision scroll, kept apart from the siege sky.

**Rules.** One optional tap, skip is one key and never scolded. Shape, word and glyph carry meaning together; nothing animated. The mood is never fed into the evidence packet, blind pass or reconciliation (a test asserts it) and never used in temperament scoring, so "afraid" is never punished. Counts open at n of 8, with no outcomes and no grade. Note: this is a personal self-report on your own entries only; I will not store anything beyond the five words and the date.

**Risk.** It feels gimmicky or like friction; the pilot is one glyph row in the Records desk, no new page.

**Stitch asks (B7).** The five glyphs are code-drawn SVG (shape plus word), so Stitch is only for the mirror.

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B7-1 | ★ | Hand mirror | `Subject: a small brass hand mirror with a round blank glass, a short handle, no reflection, no face.` |
| B7-2 |  | Mirror stand | `Subject: a small wooden table stand holding a round brass mirror, blank glass.` |

## B8. Scouting Expeditions (judged #13, Expert 3) · Size M · One small `expeditions` table

**Pitch.** Each season you dispatch a small number of scouts (3 slots, adjustable) to the foggiest or most decision-relevant parts of the realm. They return only when real work lifts fog.

**Verb + scene.** *Dispatch*, the Map's gate with scouts riding toward fog patches; they return when a patch lifts.

**Loop and data.** A ranked shortlist shows, visibly and deterministically: position weight, share of the five survey patches in fog, days since a report was read, distance to the next wall tier (Knife-edge), coming report date. You choose the slots. Each expedition names the exact facts to lift ("D&A for FY2024 captured and Margin of safety re-run"). A scout returns only when the pipeline sees the real work done and the patch visibly lifts. A seasonal ledger counts dispatched, returned and still out.

**Rules.** Calendar season, no countdown, timer, streak or reward. Overlaps the Council agenda; the 3-slot limit and showing the ranking logic prevent busywork. Cut first: the "still out" tracking.

**Risk.** Overlap with Council makes it busywork.

**Needs D1** (rider figure, or ravens as scouts, which already exist as art).

**Stitch asks (B8)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B8-1 | ★ | Signal post | `Subject: a tall wooden signal post with a plain teal pennant and a crossbar, upright.` |
| B8-2 | ★ | Scout, outbound | If D1 = yes: `Subject: a faceless hooded rider on a brown horse in side view, riding left, a satchel on the saddle.` If D1 = no: I use `raven`. |
| B8-3 |  | Scout, returning | If D1 = yes: same rider carrying a rolled scroll. If D1 = no: `raven` with its scroll (already exists). |
| B8-4 |  | Map-gate banner | I reuse the map frame. |

## B9. The Primer (judged #14, Expert 1) · Size M-L (mostly authoring) · No migration

**Pitch.** A finite syllabus of about 12 short Buffett/Munger chapters (moat, owner earnings, margin of safety, circle, invalidation, tripwires, leverage, the cost of acting, and so on). Each uses one of your own holdings as the worked example, with real numbers from the app, and ends in one real act in the app. When it is done it says so and retires.

**Verb + scene.** *Study*, a tutor's carrel at the foot of the keep, with one illuminated page per chapter and a margin note linking to your tower.

**Loop and data.** Chapter text is hand-written in a versioned `primer_v1` file; example numbers come from existing deterministic metrics for a holding chosen by a stable rule. A chapter shows as done only when the evidence exists in your record (an invalidation, a Circle mark, a thesis line or a review), not when you press Next. If the evidence goes stale, the chapter returns as a quiet Council agenda item (progress going backwards honestly). Graduation: a sealed "you have the habits" scroll, then the Primer retires and says the rest is cadence.

**Rules.** Lessons are static, cited and original; no LLM in the lesson; wording vetted for no buy/sell; fog in the example is shown as fog; no XP, daily anything or streak. Ship 4 chapters first and see whether you open them; cut chapters 5 to 12 if the authoring load is too heavy.

**Risk.** Authoring load and lecturing.

**Stitch asks (B9)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B9-1 | ★ | Scholar's carrel | `Subject: a wooden scholar's reading desk with a slanted top, a small shelf and a brass lamp, empty.` |
| B9-2 | ★ | Illuminated blank page | `Subject: one blank cream vellum page with an ornate leafy border and a decorative empty first-letter box, no letter, no writing.` |
| B9-3 |  | Reading pointer | `Subject: a slim wooden reading pointer with a carved hand at the tip.` |
| B9-4 |  | Graduation scroll | I reuse `room-scroll` with `seal-whole`. |

## B10. The Auditor's Bench (judged #15, Expert 3) · Size S-M · One small additive "disagree note" table

**Pitch.** A claim from a stored Oracle analysis appears, and you pick which of four evidence cards supports it. It trains the evidence-first habit on the app's own LLM output, and your "disagree" note becomes a human QA channel for the evidence pipeline.

**Verb + scene.** *Trace*, a clerk's desk with folios and a magnifier; you lay a thread from the claim to a folio.

**Loop and data.** The app takes one stored claim carrying a real evidence ID, and shows it beside four evidence cards (the true citation plus three others from the same packet, same metric family where possible). The reveal shows the cited ID, exact figure, source and date, and the pipeline's citation-check status. "None of these" and "Disagree" are answers; Disagree saves a dated note.

**Rules.** The correct answer is the stored citation, matched in code; only real claims are used, never invented false ones; runs without a claim-to-ID mapping do not appear (fog). The LLM generates nothing here. Counts are private, no grade; a mismatch means "look", never "the Oracle is wrong". Cap at 3 per sitting.

**Risk.** Paraphrase makes matches ambiguous; hence the escape answers and skipping unclear claims.

**Stitch asks (B10)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B10-1 | ★ | Magnifier | `Subject: a brass magnifying glass with a wooden handle, clear lens, no reflection.` |
| B10-2 | ★ | Folio stack | `Subject: a neat stack of four blank cream folios with a ribbon tie, no writing.` |
| B10-3 |  | Thread spool | `Subject: a small wooden spool of teal thread with one loose end.` (Code draws the thread line.) |
| B10-4 |  | Clerk's desk | `Subject: a plain oak clerk's desk with an angled top and one drawer, empty.` |

## B11. Cairns (judged #16, Expert 2) · Size M · Small additive exit-reason value

**Pitch.** When a position is closed, the app writes an "epitaph" scroll from the record and offers one optional stone and one sentence for next time. Stones pile up as a cairn on the Map.

**Verb + scene.** *Lay*, a hillside beyond the Map where each closed tower leaves one equal stone.

**Loop and data.** Trigger: a journal sell entry or the last frame that held the tower. The scroll lists dates held, wall and moat at the last frame, thesis status on the exit date, whether your own invalidation line had fired (yes, no or unknown). You pick an exit reason from a fixed list ("thesis broke", "better use of capital", "needed cash", "I was uneasy"); the last is honest and never shamed. Stones are identical in size and colour, with no P&L colour or grade; reason counts are descriptive only; caption "a decision is not its outcome".

**Rules.** Missing facts are fog ("no frame that day"). There are no closed towers yet, so it starts as an empty hillside with a plain line saying so.

**Risk.** Months of an empty hillside, and grief theatre; the wording stays flat.

**Stitch asks (B11)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B11-1 | ★ | Single stone | `Subject: one smooth rounded grey stone, plain, no marks.` (Code stacks copies.) |
| B11-2 | ★ | Cairn | I reuse the unused `cairn` master. |
| B11-3 |  | Hillside backdrop | `Subject: a wide quiet windswept hillside with a path and short grass, no people, no buildings, no text, 3:1 wide.` |

## B12. The Still Twin (judged #17, Expert 1) · Size M · No migration · Blocked until about late 2027

**Pitch.** A pale ghost fortress shows the book as it stood on a past date, held unchanged. After twelve months of your own stored snapshots, a quiet comparison shows what your activity did, and what it cost.

**Verb + scene.** *Hold still*, a fogged hill behind the fortress where a pale twin keep stands with every tower exactly as it was.

**Loop and data.** Snapshot history starts 2026-09-21. The twin appears only when 12 months of frames exist; until then the page says "opens in N months". It compares weights and value of the twin against the actual book and lists your changes from `churn_events` and snapshot diffs, shown as a range with price noise, counts of changes, and known costs (fees not stored show as fog).

**Rules.** No single P&L headline, no green or red; symmetric (acting can look better, and the page says so). This is the idea closest to the ban on making acting feel better than waiting, so it needs the n-gate, a range, symmetry and a design review before any build.

**Risk.** It becomes a scoreboard that rewards luck.

**Stitch asks (B12)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B12-1 | ★ | Ghost hill | `Subject: a low grassy hill mound with a flat top and a few stones, no building.` (The twin is `keep-granite` and the towers pale-graded by code, so no new twin art is needed.) |
| B12-2 |  | Locked door | I reuse E3-4 (shut door). |
| B12-3 |  | Fog hill backdrop | `Subject: a wide misty hillside, soft pale shapes, no buildings, no people, no text, 3:1 wide.` |

## B13. The Keep Cutaway (judged #18, Expert 4) · Size M-L · No migration

**Pitch.** One new screen shows the Great Keep in cross-section, and each room is a floor drawn with its own object: candles on the Council table, cracked seals on the Records door, an hourglass in the cellar. Tapping a room pushes the camera into it.

**Verb + scene.** *Enter*, a cutaway of the Great Keep.

**Loop and data.** Council agenda count, owed review seals, Chronicle gap days, fog share and the next bell date set what each floor shows. Quiet is the default: nothing owed means a closed door with a plaque saying "last rule met: date", never "all is well".

**Rules.** No red badges, streaks or unread counters. The tab strip stays as the accessible fallback and a text list is the Plain view; transition is instant under reduced motion; phone-first vertical stack. Must stay optional and read at a glance; it must never turn into an engagement-badge hub.

**Risk.** An extra click, slower than the tabs.

**Stitch asks (B13)**

| ID | ★ | Image | Prompt after the shared block |
|---|---|---|---|
| B13-1 | ★ | Keep cross-section | `Subject: a vertical cross-section of a stone keep showing five empty stacked floors and a cellar, a staircase between floors, no furniture, no people, no windows lit, no text.` Likely needs 2 attempts; Stitch tends to bake furniture, so repeat "no furniture". |
| B13-2 | ★ | Blank brass plaque | `Subject: a small blank brass wall plaque with two screws, no text.` |
| B13-3 |  | Cellar | `Subject: an empty stone cellar corner with an arched ceiling, no barrels, no text.` |
| B13-4 |  | Floor objects | I reuse `council-candles`, `seal-broken`, `room-hourglass`, `room-sconce`. |

## Bucket: Stitch totals

| Item | ★ must-have | Optional | Total new pictures |
|---|---|---|---|
| B1 Mill Race | 3 | 3 | 6 |
| B2 Duels | 3 | 1 | 4 (one reused) |
| B3 Binding | 3 | 1 | 4 (one reused) |
| B4 Punch Card | 2 | 1 | 3 |
| B5 Turned from the Gate | 3 | 1 | 4 |
| B6 Tide Marks | 1 | 1 | 2 |
| B7 Inner Weather | 1 | 1 | 2 |
| B8 Scouting | 2 | 1 | 3 |
| B9 Primer | 2 | 1 | 3 |
| B10 Auditor's Bench | 2 | 2 | 4 |
| B11 Cairns | 1 | 1 | 2 |
| B12 Still Twin | 1 | 1 | 2 |
| B13 Keep Cutaway | 2 | 1 | 3 |
| **Bucket** | **26** | **16** | **42** |

---

# PART C: SECTION A (game sprint checklist) for the main list

Targets are inferred from the docs, not re-scored with screenshots.

1. **Pages touched:** new pages Blindfold (E1), Winter Rehearsal (E2), Hearth (E3), Baskets (E4); journal editor and Records (E5). No existing page is removed.
2. **Identity before to after (target):** all new pages 3; Records stays 3; journal editor 1 to 2 with voices. No touched page ends below 2.
3. **Visual wins:** E1 water rising to the stake; E2 frost climbing the wall; E3 bark versus heartwood; E4 three silhouettes of basket; E5 six voice shapes.
4. **Visual verbs:** stake, endure, kindle, sort, overhear.
5. **Words:** each sprint adds only the words its feature needs; word budgets honoured; alt text empty.
6. **Kit:** reuses the room banner kit (`roomArt.ts`, `RoomBackdrop`, `RoomProps`), the scroll shell and `ObjectArtImage`; owner game-feel-engineer.
7. **Cut lines:** per item above; never the Plain view, fog rule, n-gate, SVG fallback or screenshots.
8. **Rules:** section 2.

## Documentation changes with this plan (when it is accepted)

- New: this plan in the Claude project; repo copy at `docs/sprints/game-design-sprint-plan-2026-10-15.md` with one line in `docs/README.md` (done, PR opened 2026-10-15; not merged).
- `progress.md` and `docs/PROGRESS.md`: Active Tasks gain "Contest 3 sprint plan: Faiz to rule on D1 to D8 and start Stitch batch for E1"; no more than the file's 7-item limit.
