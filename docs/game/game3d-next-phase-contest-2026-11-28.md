# 3D contest round 3: four teams plan the next phase (2026-11-28)

Issue #543. Status: **a plan, no code changed.** Nothing here is built. Follow-up issues come after Faiz picks.

## In plain words

Four teams reviewed the whole app and the 3D game. Each brought a plan for what comes next. Team Keystone wins: finish the starter, make "Play again" teach something new, then carry the lesson onto your own towers. The combined plan below adds the best parts of the other three. Five decisions are yours.

## How it was run

- Four agents, one strength each, read the same clean copy of `main` at `1131af9` (after the starter's build 4, PR #540, and the plain-words rule, PR #542).
- Each was read-only and got the same rules, the same open issues and Faiz's standing decisions (#476: reward knowing, practice fortress, keep Barren and Marlie, freeze new places).
- The judge (this session) re-checked each team's main claims in the code before scoring.
- **Not done:** no browser run, no phone, no real GPU, no young player. Which commit is live was not checked.

| Team | Strength |
|---|---|
| Keystone | Game systems: the loop, replay, how practice hands over to the real fortress |
| Lantern | Tech art and feel: light, motion, sound, load time, draw calls, phone frame rate |
| Compass | Player experience: onboarding, accessibility, touch, tap counts, identity scores |
| Atlas | World and level design: places, wayfinding, bringing the rest of the app into the world |

## Scores

Each criterion out of 10. Evidence means claims the judge could find in the code.

| Team | Evidence | Player impact | Can be built in steps | Keeps the rules | Original | **Total /50** |
|---|---|---|---|---|---|---|
| **Keystone** | 9 | 9 | 8 | 9 | 9 | **44** |
| Atlas | 9 | 8 | 7 | 8 | 9 | **41** |
| Compass | 6 | 8 | 8 | 9 | 6 | **37** |
| Lantern | 7 | 6 | 8 | 9 | 5 | **35** |

**Why Keystone won.** It found the three gaps between practice and real ownership, and each fix reuses rules that already exist:

- a newcomer cannot find the starter;
- the starter ends on a list;
- "Play again" goes flat.

Its replay idea, a bell that rings when your own "I'm wrong if" comes true, teaches the habit the app exists for: write why, wait, look again.

**Atlas** came close. It found the same dead ends and had the boldest long idea: the app's workflow as one road you walk. That road is too big for this phase. **Compass** had the best done tests and the accessibility work, but scored itself on estimates and planned a fix for a closed bug. **Lantern** brought the only real performance numbers, but its plan is mostly the existing starter backlog.

### What the judge checked (all on `main` at 1131af9)

| Claim | Team | Holds? |
|---|---|---|
| The practice yard opens only by the `?at=practice` link; no door, no "Where to?" row | Atlas, Keystone | Yes. `areas.ts:251` says "reached by link or menu, not by a door"; `WhereToPanel.tsx` and `parity3d.ts` have no practice row |
| "Bring your real fortress" just leaves the yard to the courtyard start | Atlas, Keystone | Yes. `Game3DPage.tsx:1942` calls `leaveArea`; `areas.ts:252` returns the courtyard spawn |
| The Book's real lines say "Press T", which opens a list | Atlas, Keystone | Yes. `starterWordsV1.ts:212,219,235`; on touch "Tap Towers" (`touchWordsV2.ts:28-30`) |
| "Play again" always gives the second storm, so run 3 equals run 2 | Keystone | Yes. `starterPlanV4.ts:346-349` sets `second: true` every time |
| The real-fortress confetti fires once per page load, not once ever | Keystone | Yes. `celebrate.ts:3`, `Game3DPage.tsx:565-570` |
| The practice walls use the real thresholds | Keystone | Yes. `practiceCompanyV1.ts:65-75` (`wallFor`) |
| Courtyard draws 528 against a limit of 300 | Lantern | Yes, as last measured: `game3d-s23-measure-2026-11-03.md`. No later number found |
| Shadows and 2x resolution on every device, no phone tier | Lantern | Yes. `Scene.tsx` sets `shadows`, `dpr={[1, 2]}`, 1024 and 2048 shadow maps |
| `Game3DPage.tsx` is about 2,000 lines with the starter inline | Compass, Keystone | Yes, 2,006 lines |
| The Hall of Records bookcase bug (#502) is still to fix | Compass | **No.** Closed, fixed in `c80ac68` |
| #390 is 3D performance | Lantern | **No.** #390 is the flat Fortress page |

## The plan: "Close the loop"

Keystone's five sprints are the spine. Pieces from the other teams are marked with their name. A performance track runs beside them.

### Sprint 1: Open the gate (ship the starter)

**Goal:** a newcomer lands in the practice yard and can finish or skip it.

- #497: the newcomer gate, "Skip practice", First Steps folded in, and "Practice yard" first in "Where to?".
- A lemon-crest gate in the courtyard by the arrival spot, so veterans can find the yard too (Atlas). It is a door to a place that exists, not a new place (decision 3).
- #538, first part: the fridge plate stays until the storm card opens. Today it shows 7 words for 1.4 seconds (`starterWordsV3.ts:36`, `STORM_FALL_MS`).
- The real-fortress confetti fires once ever, as #476 says ("never repeats").
- #499 name check. #498 sound cues stay the cut line, made by code with no sound files (Lantern).
- A tap-count script from a cold load, desktop and 390 px phone (Compass).

**Visual verb + scene:** *walk through the lemon gate*, courtyard and yard.
**Done test:** a fresh browser lands in the yard with 0 taps. Skip is 1 tap. A veteran browser sees no change except the gate. #492: a child explains a moat and "room to be wrong".
**Risk:** end-to-end tests start fresh, so they must seed a veteran key.

### Sprint 2: Carry the why (replay that teaches coming back)

**Goal:** every replay asks "does my why still stand?"

- Move the yard's pieces out of `Game3DPage.tsx` into their own component and one focus manager. No behaviour change (Keystone, Compass).
- `starterPlanV5`: "Play again" keeps your last pinned why.
- Three storms in a fixed order: the price only; the fridge (owes more); a rainy summer (left over 10 to 4, walls go brick). The rainy summer needs `practiceCompanyV2.ts`, pinned by the wall-tier test.
- A "Check your why" bell by the practice tower. It rings when the storm matches your "I'm wrong if", and the flag turns to review, the same look as a real review flag. The Book page "Check your why" is earned once.

**Visual verb + scene:** *ring the bell*, practice tower door.
**Done test:** 2 taps per storm beat. Banned-word test passes (no sell, leave, hold). Whole starter can be finished with the keyboard only; reduced-motion run has no looping motion (Compass).
**Risk:** "Look again" must never read as "sell". Read it aloud before it ships.

### Sprint 3: Your first real tower (the handover)

**Goal:** what you learned on Pip's stand reads your own fortress.

- "Bring your real fortress" opens your largest tower's land in 1 tap. No holdings: Sal's first step instead. Demo: the sample land, labelled.
- A wall stone by the tower, carved from the stored `wall_inputs`. Moss shows how stale the look is (`freshness`). Unknown walls show "?" and mist, never a weak wall.
- One "Which walls?" card, once ever, answered by the backend's stored tier. Never on sample data. It earns "Read a real tower".
- `starterWordsV4`: the "Press T" lines become a "Show me" tap that marks the wall stone, moat or price post (Atlas).
- The holding land's Plain view.

**Visual verb + scene:** *read the wall stone*, holding land.
**Done test:** 2 taps from the starter's end to the answer. Unknown and stale cases are tested and drawn as fog or moss. No POST from the real-land test.
**Risk:** a child on your account would see your real holdings (decision 2).

### Sprint 4: Keys from the Book (the freeze lifts)

**Goal:** places open because you understood something.

- `starterGateV2` for a newcomer after the starter. The Storms page opens the Storm Drill post. Write it down opens the Hall of Records. Room to be wrong opens the Market Quarter. The Mint, Weather Tower and Town Hall stay "Later". Veterans see no change.
- The Hall of Records gets one idea: pull a book to see your old why beside today's flag.
- The Storm Drill post moves onto the Siege Field and takes the yard's storm look. No new camp; this replaces #396 (Keystone and Atlas agree).
- The Siege Field gets a fingerpost, a "Where to?" row and a screen-reader line (#464, Atlas).
- The Workshop's admin pages leave the world and stay in the app menu (decision 4).

**Visual verb + scene:** *hang the key*, Book page and door.
**Done test:** each unlocked place is 2 taps away through "Where to?". Hall of Records scores 2 or more.

### Track P, beside sprints 1 to 4: light on its feet (Lantern)

- P1 measure: Faiz runs one hour on his phone and laptop. Frame rate, draws and load time for the courtyard, town, yard and one land. Headless runs count as "headless only".
- P2 phone tier, on touch only: resolution capped at 1.5x, one 1024 shadow map.
- P3 fewer draws: batch still scenery, biggest owners first. Courtyard to 300 or fewer, yard to 150 or fewer.
- P4 lighter models: strip unused animations from the 15 character models (15 MB of models today); load rooms only when entered.

**Done test:** before and after numbers from the same device. Fog tests stay green after batching.

### Sprint 5: The second shop (only if the #492 playtest passes)

A second made-up shop and two more Book pages ("Know how it makes money", "Time does the work"), on a second pad in the yard. It reuses `wallFor` and `landFor`. Name check first.

## Next phase after this (not planned yet)

- **The Investor's Road** (Atlas): six carved stones along the gate road (find, understand, price, write why, test, look back), with "Where to?" sorted in the same order.
- **Faiz's morning walk** (Atlas): today's round as a lit path through each bell and raven.
- **The rest of #503:** a skyline where every building looks different, and a real sky in the Weather Tower.

## Scrap or park

- **Park #395** (store interior): a new place with no idea behind it. All four teams agree.
- **Park #396 as a new camp**: the drill post moves onto the Siege Field instead.
- **Scrap the Workshop as a building**: admin tools that save data do not belong in the world (three of four teams).
- **Scrap sound files**: cues are made by code, so no licence check is needed.
- **Park more starter chapters** until a playtest asks for them.

## Decisions for Faiz

1. **Replay (#538):** keep your why across "Play again", rotate three storms, and hold the fridge plate until the card opens? *Recommend yes.*
2. **The handover:** "Bring your real fortress" opens your largest real tower, with a one-time "Which walls?" read. If a child plays on your account, they see your real holdings. *Recommend yes, and let a child play only in practice or with you beside them.*
3. **Gate and keys:** a lemon gate in the courtyard, and Book pages that open the expert doors for newcomers (veterans unchanged). Does the freeze allow both? *Recommend yes: no new place is built.*
4. **Town clean-up:** take the Workshop out of the world, and merge the Archive into the Hall of Records as one Library? *Recommend yes to both.*
5. **Phone test:** run the one-hour device check (track P1), and allow a lighter look on phones only? *Recommend yes.*

Still open from before: #492 (who plays the starter, and who sits with them).
