# 3D S22 and S23: doors that feel like doors, and a lighter courtyard (sprint plan, 2026-11-02)

**Status: plan only. No app code changed.** Written against `main` `e3521a1` (#265). Part of the approved [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) (all of D1 to D16 approved by Faiz on 2026-11-02).

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge: one to three PRs, a clear "what you will see", and a test so it cannot quietly break later. These two are the next steps because every later one (the holding lands, the Siege Field, the Market Quarter) needs them first: a way to *arrive* somewhere nicely, and a courtyard light enough to have room for more places.

## Where things stand (checked in the repo today)

- **S24 is merged** (#264): one sector table; reading the report at the 3D table marks it opened. The art packs for S26 to S31 are merged too (#265).
- **S21 is written but not merged**: branch `feature/game3d-s21-areas` (one commit, `bb4a872`, 14 files, 32 new tests). It adds the list of places (`areas.ts`), the "which place am I in" value (`areaMachine.ts`) and the shared "what would E do here" check (`near.ts`). Its write-up says it was not looked at in a browser. I could not tell from here whether its PR is open.
- **S22 and S23 are not started.** They do not touch the same files, so they can run side by side. S22 needs S21 (it fills in the `ready` and `fadeDone` steps S21 left empty).

## S22: doors that feel like doors (size M, two PRs)

**What you will see.** Press E at any door and the screen fades out, you arrive facing the new place, and a name plate says where you are for a couple of seconds. The toolbar says the real place ("Town Hall") instead of "3D courtyard" everywhere. Esc closes any panel first; **B** walks you back out; a "← Back" button does the same. Reload the page and you are still where you were.

**Visual verb + scene:** *step through.* A short dark veil with a thin gold edge, the name plate in the same painted-scroll style as the tower nameplates.

### PR 1: the fade, the name plate, the hold-still
1. `areaMachine.ts` gets its phases: `enter` starts `fadingOut` (about 0.35 s) → `loading` (move the hero, wait until the new floor exists) → `fadingIn` (about 0.45 s) → `idle`. Total near 1 s, as the discovery plan says.
2. **Hero held still while loading.** No movement and no E during the fade, so you cannot fall through a floor that is not there yet, or press E twice into a second door. (Also the guard against the "hero load flash" fixed in #260.)
3. **Reduced motion = a cut, not a fade.** `prefersReducedMotion()` already exists in `motionPref.ts`; the machine skips straight to `idle`. The name plate still shows, without sliding.
4. **Name plate on arrival.** New `areaWordsV1.ts` (versioned words file, like the other `…WordsV1.ts`): one short line per place, game voice. Drafts: *"Into the Town Hall"*, *"The Town"*, *"Hall of Records"*, *"Back in the courtyard"*, and for a tower *"Into Vår Energi's library"* (the holding's own name, so nothing is invented). Fail line: *"The door is stuck. Try again?"* if the floor has not appeared after 3 s (then you stay where you were).
5. **Toolbar label** reads the place name from the list of places.
6. Preload: when you are near a door, start fetching the next place's models quietly (`useGLTF.preload`), so the "loading" step is usually instant.

### PR 2: Esc, B, links, and the first browser test
1. **Esc** closes the open panel first, then the "Where to?" menu (already so), and does nothing else. **B** leaves the current place when no panel is open and you are not typing in a field (Backspace is avoided on purpose, decision D16). "← Back" button shows only inside a place.
2. **`/game3d?at=<place>`.** `town`, `townhall`, `records`, `library:<holdingId>`; no `at` or a broken one = courtyard. One small pure parser/printer with tests. The page writes the URL as you move (no history spam: replace, not push), so a reload or a shared link lands in the same place. This is also how QA reaches any place directly, so no separate test back door is needed.
3. **First `e2e/game3d.spec.ts`.** Read-only, demo mode, same rules as the other smoke tests (GET only, no LLM spend). For each place via `?at=`: it loads, the name plate shows, Esc and B behave, no console error. Draw-call count is read and asserted against the place's budget. **Not fps**: software graphics in a headless browser ran at about 2 fps in the discovery QA, so fps stays a thing Faiz checks with P on his machine.
4. A small `?stats=1` switch shows the P overlay at load, so the test can read draw calls without keyboard tricks.

### Tests (pure, run on every PR)
- Machine: every phase order; two quick `enter` calls do not stack; `leave` at the courtyard does nothing; reduced motion skips straight to idle.
- Links: parse and print round-trip for every place; a broken or unknown `at` goes to the courtyard; `library:` with an unknown holding goes to the courtyard (S21 already does this in the reducer).
- Input guard: E and movement are ignored while the phase is not `idle`.
- Words: every line in `areaWordsV1.ts` is short (word budget test, like the other word files).

### Taps (counted from a cold load, in a real browser, before the sprint is called done)
| Task | Taps now | Taps after |
|---|---|---|
| Courtyard to a tower's shelf | 2 E (door, shelf) | 2 E; the fade adds time, not presses |
| Town Hall to a board | walk + 1 E | walk + 1 E |
| Leave any place | walk to the exit + E | B, or walk + E |

## S23: a lighter courtyard (size M, three PRs)

**What you will see.** Nothing new. The same courtyard, smoother. The point is room: every later place costs draw calls, and the courtyard is over its own budget today (discovery QA: **528 draw calls and 139k triangles**; budget is 300).

**Visual verb + scene:** none (a no-look sprint). The look must not change; the proof is a before and after picture, and a test that fails if a piece goes missing.

### What I saw in the code
Six components load a model file and then `clone` the node once per copy (`Scenery.tsx`, `Market.tsx`, `MarketStreet.tsx`, `Town.tsx`, `KeepModels.tsx`, `DrillCamp.tsx`). Each clone is its own set of draw calls, plus the ink outline pass. `Horizon.tsx` already draws its trees as one batch per mesh; that is the pattern to copy. **Not yet checked:** exactly how many calls each component owns. PR 1 measures that first, so the order of work follows numbers, not my guess.

### PR 1: measure
- P overlay also shows memory (geometries, textures) and the draw calls per group (courtyard scene, town, characters), saved as one baseline per place in the PR text.
- No behaviour change. This tells us which two or three components hold most of the 528.

### PR 2: draw copies in one go (courtyard)
- A shared `InstancedPieces` helper, tested as pure grouping (`groupPieces`: same file and node name → one batch with a list of positions). Used first by the biggest owners from PR 1 (likely scenery, market, keep models).
- **Stays as separate clones:** anything that moves, opens, glows or encodes a fact (tower meshes, stall doors, vault, anything the Standing lights). Instancing is for barrels, crates, banners, fences, trees, stall bodies.
- Outlines: the instanced batch gets the ink pass as one batch too, not one per copy.
- Collision and "near" checks read the layout data, not the meshes; a test confirms that moving to batches changes no position.

### PR 3: the Town, Market Street, shared colour sheets
- Same helper in the Town and Market Street (they are separate places, so they count against their own budget, not the courtyard's).
- Share each KayKit pack's one colour sheet: load once, reuse the material. **Not yet checked** that the discovery note ("some packs are loaded several times") holds; PR 1's texture count settles it.

### Targets (gates for the PR, from the discovery budgets)
| Place | Now | Gate | Goal |
|---|---|---|---|
| Courtyard draw calls | 528 | ≤ 300 | ≤ 150 |
| Courtyard triangles | 139k | ≤ 300k | — |
| First load of `/game3d` | not measured | stays under 15 MB | — |

### Tests
- Grouping is pure and tested: counts per batch, no piece dropped or duplicated, same positions as before.
- A "pieces on the map" snapshot (like S21's exit snapshot): the list of every placed piece and where, written before the change and equal after it.
- The e2e from S22 reads the draw-call number and fails above the gate. (Until S22 PR 2 lands, PR 1 posts the number in the PR text.)
- Faiz's check on his machine: press P, same 60 fps or better, and the courtyard looks identical.

## Order and sizes

| Step | Needs | Size |
|---|---|---|
| Merge S21 (Faiz) | — | — |
| S23 PR 1 (measure) | — | S, can start now |
| S22 PR 1 (fade, plate) | S21 merged | M |
| S23 PR 2, PR 3 | S23 PR 1 | M |
| S22 PR 2 (Esc, B, links, e2e) | S22 PR 1 | M |

**Suggested:** start S23 PR 1 now (it needs nothing); S22 starts the moment S21 is merged. Then S25 (the holding land, plain version) can start.

## Game sprint checklist, section A

1. **Pages touched:** `/game3d` courtyard, Town, Town Hall, Hall of Records, tower library (name plate, toolbar label, fade, back button); S23 changes no page, only how the courtyard and Town are drawn. No flat page changes.
2. **Identity score (before → after):** courtyard 3 → 3; Town 3 → 3; Town Hall 3 → 3; Hall of Records 3 → 3; tower library 3 → 3. No page drops. The "Where to?" menu and Quest log stay at 1 (identity debt, listed in the discovery plan, not touched here).
3. **Visual win:** the door veil and the name plate (S22); both delete words (the "3D courtyard" label and the need to guess where you are). The fact it encodes: the real place, and for a tower, the holding's real name. S23 has no visual win: it is groundwork, and the discovery plan puts the visual wins in S25, S28 and S30.
4. **Visual verb + scene:** "step through" for S22; none for S23 (a speed sprint).
5. **Words:** before 0 new strings; after about 8 short name-plate lines plus 1 fail line, all in `areaWordsV1.ts`. Voice: short, playful, written for the player's act ("Into the Town Hall"). No panel gets more text.
6. **Kit:** reuse the tower nameplate look and the painted-scroll plate. Add: the area veil (owner: game-feel-engineer).
7. **Cut line:** the quiet preload when you are near a door (S22 PR 1 item 6). Never the reduced-motion cut, the stuck-door line, or the before/after draw-call numbers.
8. **Rules:** truth over flattery (the veil and plate look the same for every holding); no red or green; reduced motion = a cut; colour-blind safe (text plate, no colour-coded meaning); phone not in scope (3D is desktop only); performance is the whole point of S23.
9. **Taps:** in the table above; main task stays at 2 presses of E.

## Risks

- **S22 stacks on an unmerged S21.** If S21 changes in review, S22 changes with it. Cheapest fix: merge S21 first.
- **Instancing can change the look** (outline thickness, shadows, a piece that was quietly different). The "pieces on the map" snapshot and a before and after picture catch this one batch at a time.
- **Headless graphics are slow**, so the e2e checks counts and behaviour, never fps.
- **A fade can hide a hang.** The 3-second stuck-door line and the guard that keeps you in the old place on failure are there for this.

## Decisions for Faiz

Everything big is already decided (D1 to D16). Only small ones are left; the recommendation is bold.

| # | Question | Recommendation |
|---|---|---|
| E1 | Fade length | **About 1 s total (0.35 out, 0.45 in)** |
| E2 | Should a reload keep you in a tower's library, or drop you at that tower's door in the courtyard? | **Keep the library (`at=library:<id>`)** |
| E3 | Start S23 PR 1 (measure) before S21 is merged? | **Yes, it touches nothing S21 changes** |
