# 3D S25: every tower door leads to its own land (sprint plan, 2026-11-03)

**Status: plan only. No app code changed.** Written against `main` `4268cd8` (#266) and the unmerged `feature/game3d-s21-areas` (`bb4a872`). Part of the approved [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) (D1 to D16 approved by Faiz on 2026-11-02) and the step after the [S22 and S23 plan](game3d-s22-s23-sprint-plan-2026-11-02.md). Not seen in a browser; nothing was run for this plan.

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge: one to three PRs, a clear "what you will see", and a test so it cannot quietly break later. This one is the step you asked for first on 2026-11-02: **a tower's door should take you somewhere that is that holding's own place**, not the same library room for all eight. This sprint builds the place itself, plain and honest. The next two (S26, S27) dress it like the holding's picture on the flat Map (gold mine, windmill, bank vault, farm...).

## Where things stand (checked in the repo today)

- **S24 is merged (#264)**, so the sector → theme choice already exists: `holdingTheme3d(sector, holdingId, structure)` in `lib/sectors.ts` (mine, quarry, ingots, farm, stall, bank, factory, windmill, watermill, fountain, plain). S25 does not need it yet (everything is plain), but S26 will.
- **The art is already packed (#265).** `public/models` holds `holding-mine.glb`, `holding-farm.glb`, `holding-bank.glb` and nine more (about 0.2 to 0.6 MB each), and `game3d/holdingPieces.ts` lists which pieces each theme may use. Nothing is placed yet.
- **S21 is not merged.** It adds the list of places (`areas.ts`) with the names `holding`, `siege` and `market` held back for later. S25 turns `holding` into a real place. **S22 is not built**, so the fade and name plate do not exist yet.
- **Today's tower door** (`towerDoor.ts`) leads into one shared indoor room (`Library.tsx`, `libraryRoom.ts`: a 22 × 19 hall with seven shelf bays and a reading table). It is the same room for every holding, lit the same.
- **The four survey checks exist as data** (`lib/survey.ts`: report, analysis, thesis, valuation, each `clear`, `fog` or `not_judged`, with a plain reason) and as drawn patches on the flat Map (`lib/realmMap.ts`). **Nothing in 3D draws them yet.**
- `TowerView` (what the 3D scene knows per tower) already carries name, ticker, weight, size class, wall tier, moat tier, thesis, freshness, and a "gap" label. It does **not** carry the survey checks, margin of safety or Storm Drill result. Those are loaded elsewhere on the 3D page today (the library shelves read margin of safety; the siege yard reads the drill results). **Not yet checked:** exactly which of them the page already holds when you are standing in a land. PR 1 settles this before PR 3 relies on it.

## What you will see when S25 is done

Walk up to any tower door and press E. You arrive in **that holding's own open ground**, with its name on a carved gate stone. In the middle stands **that holding's own tower**, drawn from its real wall and moat tier, so you are standing at the foot of what the courtyard showed from afar. Around it are four **survey lanterns** (the fog of war, in 3D for the first time), a **records house** with the same seven shelves and the reading table you have today, and a **price post** by the exit. Every land looks the same in layout; only the numbers and tiers differ.

**Visual verb + scene:** *visit the holding.* The lanterns are the visual win: lit, hooded in mist, or a bare post. They replace reading a list of four lines.

## The land (one layout for every holding, decision D1)

| Spot | Real fact it shows | What you see |
|---|---|---|
| 1. Gate stone (where you arrive) | Name and ticker; weight in the portfolio; the size class sets the ground (four fixed sizes, plus a smallest "not surveyed" size) | A carved stone. The land's size follows the size class only, never the verdict |
| 2. Survey ring | The four survey checks, each with its reason | Four lantern posts around the middle. **Lit** = clear. **Hooded in mist, with a "?"** = in fog. **Bare post, a dash** = not judged. Same three looks as the flat Map patches, so shape and mark carry meaning, never colour alone |
| 3. The workplace (centre) | Wall tier and moat tier (and the ghost look when the tower is unknown) | **Plain dressing:** the holding's own tower mesh, standing in the middle, with its moat ring. S26 and S27 replace the centre with the themed building; the tiers then show as condition (see the discovery plan) |
| 4. Records house | The seven shelves, the reading table and the report that opens (reading marks it opened, S24) | An open-fronted building on the north side, roof over the shelves. **No second door**, so a shelf stays two presses of E from the tower door (decision D3) |
| 5. Price post (by the exit) | Margin of safety; thesis state (whole, cracked, broken, fog); Storm Drill result | A plank gauge, a sealed scroll and a small banner. Unknown shows as fog with a reason, never a made-up height |

**When we don't know:** a wall not yet surveyed shows the centre tower as a pale ghost in mist and the gate stone says "Not surveyed yet". A missing value is fog with its reason, never a middle grade.

**Rules a test checks:** two holdings that differ only in weight or sector look the same in every fact piece; two that differ only in wall tier look different; no light, sky or piece depends on the verdict; no red or green; the survey lanterns use three different shapes and marks, so no two states share all three (same test idea as `patchSignature`).

## PR 1: the land, the gate stone and the records house (size M)

1. **Needs S21 merged.** `areas.ts` gets `{ id: "holding", holdingId }` (it replaces `library`; see decision F1 for the old link). One `AreaDef` for it: bounds from the size class, spawn at the gate stone, one exit that returns to the tower door in the courtyard.
2. **`holdingLandPlan.ts`** (pure data, no three.js, like `libraryRoom.ts`): the five spots, the four fixed ground sizes, positions in local coordinates.
3. **Records house.** The seven shelf bays and the table move to the house, using the existing `libraryShelves.ts`, `libraryReport.ts` and shelf panels unchanged. Only their positions change, so every shelf panel, the Council's words shelf and the report opener keep working as they do now.
4. **Gate stone** with the name, ticker and weight (words in a new `holdingLandWordsV1.ts`, game voice, short).
5. The old shared library room stays in the code, unused, until PR 3 passes, so there is a way back. Removing it is a separate small PR after you have looked.
6. First measurement: draw calls and triangles for the land, posted in the PR text (budget: 120 calls, 80k triangles).

## PR 2: the survey lanterns, the fog of war in 3D (size M)

1. A pure function turns the four survey checks of one holding into four lantern states (the survey data already exists; this reads it and writes nothing).
2. Four lantern posts in the ring, each with its slot meaning kept the same as the flat Map (report, analysis, invalidation, valuation), and a short plate on E: the check's label and its one-line reason from `lib/survey.ts`.
3. One shared "what am I standing at" check (S21's `near.ts`) so the E prompt always matches what E does.
4. Tests: the three looks are different in shape and mark; "not judged" never reads as clear; a holding with no readable document list shows fog with the reason, not clear.

## PR 3: the centre tower and the price post (size M)

1. The holding's own tower in the middle, using the same wall, crown, crack and moat values as the courtyard tower (`TowerMesh` is only used by the courtyard today, so it is lifted into a shared piece, not copied).
2. The price post: margin of safety, thesis seal, Storm Drill result. Reads the values the page already holds; where one is not held, it shows fog with a reason instead of a number.
3. The size class sets the ground (four fixed sizes).
4. A before-and-after picture of one strong and one weak holding side by side, so you can judge that the weak one is not prettier.

## Tests (pure, run on every PR)

- **Places:** you never arrive standing on a door; the exit returns to that holding's tower door in the courtyard; every holding has a land; an unknown holding id goes to the courtyard (S21's reducer already does this for `library`).
- **Truth rules:** facts only from stored data; same layout for every holding; theme and lighting never read the verdict.
- **Lanterns:** three states, three different shapes and marks; fog stays fog.
- **Shelves unchanged:** the seven shelves list, their order, and what each opens match today's tests (`libraryShelves.test.ts`, `ShelfPanel.test.tsx`).
- **Words:** every line in `holdingLandWordsV1.ts` passes a word-budget test, like the other word files.
- **Browser check (once S22 PR 2 gives `?at=`):** open `?at=holding:<id>` for every holding in demo mode; it loads, the gate stone shows, no console error, draw calls under budget. Not fps (headless graphics were about 2 fps in the discovery QA); fps stays your check with P.

## Taps (counted in a real browser before the sprint is called done)

| Task | Taps now | Taps after |
|---|---|---|
| Courtyard to a tower's shelf | 2 E (door, shelf) | 2 E (door, shelf) |
| Read a survey check's reason | not possible in 3D | 1 E at the lantern, after the door |
| Open the latest report | 3 E (door, shelf, table) | 3 E (door, house, table) or the same count if the table stays in the house |

## Order and sizes

| Step | Needs | Size |
|---|---|---|
| Merge S21 (Faiz) | — | — |
| S22 PR 1 (fade, name plate) | S21 | M |
| S25 PR 1 (land, gate stone, house) | S21, S22 PR 1 (so the arrival has the fade and the plate) | M |
| S25 PR 2 (lanterns) | PR 1 | M |
| S25 PR 3 (tower, price post) | PR 2 | M |

If S22 is late, PR 1 can start on S21 alone and arrive with a plain cut, as today; the fade is added when S22 merges. Then S26 (first four dressings) can start.

## Game sprint checklist, section A

1. **Pages touched:** `/game3d`, the tower door and what is behind it (replaces the shared library room); the courtyard gets nothing new. No flat page changes.
2. **Identity score (before → after):** tower room 3 → 3 (one shared room becomes one land per holding; the discovery plan scores the land at 3). Courtyard 3 → 3. No page drops.
3. **Visual win:** the survey lanterns. The fact: the four survey checks. They delete reading a list of four lines.
4. **Visual verb + scene:** "visit the holding", standing at the foot of its own tower.
5. **Words:** before: one library room title and shelf plates. After: one gate stone line, four short lantern plates (label and reason come from existing data), price post labels. All in `holdingLandWordsV1.ts`; no panel gets more text. Voice: short and playful, e.g. *"Into Vår Energi's land"*, *"Lantern out: no report read yet"*.
6. **Kit:** reuse the name plate, the fog patch look, the seal and the banner. New: the lantern post and the gate stone (owner: game-feel engineer). The centre tower is lifted from the courtyard, not remade.
7. **Cut line:** the price post's Storm Drill result (if the page does not hold it yet), then the NOK value on the gate stone. Never the lanterns, the fog states or the "not surveyed" ghost.
8. **Rules:** truth over flattery (a weak holding's land is as easy to read as a strong one's); fog for unknown; no red or green; reduced motion is a cut (S22); colour-blind safe (shape and mark carry meaning); phone is not in scope (3D is desktop only); budget 120 draw calls and 80k triangles.
9. **Taps:** in the table above.

## Risks

- **Stacking on unmerged S21 and S22.** If S21 changes in review, S25 changes with it. Cheapest fix: merge S21 first, then S22 PR 1.
- **A land can flatter.** A calm, pretty land around a weak holding is the main honesty risk. The same layout, the shared lantern shapes and the side-by-side test in PR 3 are the guard.
- **The centre tower is lifted out of the courtyard.** Lifting `TowerMesh` could change how the courtyard tower looks. A before and after picture of the courtyard is part of PR 3.
- **Values the page may not hold in a land** (margin of safety, drill result, NOK value). Settled in PR 1; the plan falls back to fog with a reason.
- **Old link.** Today's `library` places must not break a saved link or a test; see F1.

## Decisions for Faiz

Everything big is decided (D1 to D16). Only small ones are left; the recommendation is in bold.

| # | Question | Recommendation |
|---|---|---|
| F1 | The place name changes from `library:<id>` to `holding:<id>`. Keep the old name working as an alias in `?at=`? | **Yes, silently (nothing is lost)** |
| F2 | The centre of a plain land | **The holding's own tower, from its real tiers** (instead of an empty ground) |
| F3 | Reading table: inside the records house, or in the open beside the house? | **Inside the house, with the shelves** |
| F4 | Start S25 PR 1 before S22 is merged (it would arrive with a plain cut, as today)? | **Wait for S22 PR 1 if it lands this week; otherwise start on S21 alone** |
