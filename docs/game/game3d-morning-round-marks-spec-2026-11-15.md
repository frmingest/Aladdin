# The Morning Round, step 2: the marks. Build spec (2026-11-15)

Issue #412, step 2 of 4. Plan: `docs/game/game3d-morning-round-plan-2026-11-15.md`.
Status: **built in PR #420, merged (420d432); deployment not checked.** The spec was written
from the code before the build; it records two defaults Faiz has not yet confirmed (price fresh for 5 days; bell for thesis review only).

## As built: where the build differs from this spec

Found by a real-browser playtest (software graphics, demo stack, mocked wire), then changed:

- **Smoke stands straight above the holding's own roof**, not behind it (the table below and section 2 still say "behind";
  they are the first plan). Behind the building it was never seen from the courtyard. Now 12 sprites, dark slate, 14 tall,
  starting 0.6 above that holding's height; a test checks it clears the roof for every size. Seen after the change, but faint.
- **Raven 1.8 times bigger** with a mid-slate body (black on Apple's black tower was lost); circles at least 3 above the roof.
  A light outline copy was tried and dropped: it pushed the full yard past the 3,000 triangle budget.
- **Bell 1.4 times bigger**, brighter bronze.
- Cost with 54 marks: 4 draw calls, about 2,800 triangles, no lights.
- The hanging lamps keep their own frame loop (they mount in the Quarter, apart from the yard layer), so there are two loops, not one.
- Not seen: any mark on a real phone; a real, unmocked wire (the demo sends none).

## Spec card

| Question | Answer |
| --- | --- |
| Player verb | Look, then walk to the sign. Step 2 has no new button: the marks are things you see. |
| Real fact | Five stored facts, one mark each (table below). Same facts the flat Fortress, Ravens, Night Watch and Marketplace already print. |
| Feedback | A shape in the world at the place the fact belongs. Shape says the kind; colour only helps. |
| Unknown or stale | The mark is absent and the fact stays fog. An absent mark never means "quiet" (rule in section 3). |
| Rules kept | Read-only, deterministic, no buy or sell words, demo wins, truth over flattery, no points, no streaks. |
| Cheapest prototype | The bell and the smoke on one holding, with the other three off. |
| Playtest question | "From the gate, can you tell which building wants you, and why, without opening anything?" |
| One thing to cut | The notice at the Watch Post (section 5). |

## Visual verb + scene

**Follow the signs.** Scene: the yard at first light, seen from the gate. Each change is its own object at the place it
belongs. Cover the text: a raven over a roof, a thin column of smoke, a swinging bell at a door, a lit lamp on a stall,
a sheet pinned at the post.

Mapping (pure, in `frontend/src/game3d/marks.ts`): `fact -> {kind, where, shape, motion, unknown}`.

| Mark | Fact (source, field) | Where it stands | Shape (no colour needed) | Motion | Unknown look |
| --- | --- | --- | --- | --- | --- |
| Raven | A raven landed in the last 48 h and is not marked read: `GET /game/ravens`, `RavenOut.holding_id`, split by `splitRavens(...).recent`, minus the browser's seen ids | Over that holding's building | A dark bird, wings out, high | Circles slowly | Absent. The perch keeps its own birds |
| Smoke | A tripwire fired and is not marked "I have looked": `GET /game/standing`, `wires[]` (needs `holding_id`, section 1) | Behind that holding's roof | Tall, thin column, taller than any chimney plume | Rises | Absent; the Plain row says "not reported" |
| Bell | The thesis monitor flags the holding "review": `GameTower.thesis === "review"` (already in the state payload) | Beside that holding's door | Low bronze bell on a short post | Swings | Absent. `not_analyzed` and `not_applicable` get no bell and no calm sign |
| Lit stall | Watchlist `status === "buy_zone"` (the price you wrote down) with a price no older than 5 days: `GET /watchlist` rows (`WatchlistRow.status`, `price_as_of`) | On that stall in the Market Quarter, and one hanging lamp under the Quarter arch when any stall is lit | A lamp hung at head height on the stall | A slow flicker, static when reduced | Unpriced stalls keep the mist. A stale price stays dark and the plate says how old it is |
| Notice | The Night Watch reported in (`watch_state === "ok"`), the newest frame is 2 days old or less, and `changes_since_last_frame` is not empty | Pinned on the Watch Post | One to three paper sheets | None | Watch `old` or `never`: no sheets, and the lantern is already dark with "?" |

Words it lets us delete: the Night Watch paragraph as the first thing you read (it stays one level down), and the
Quest log's "N ravens landed" sentence once step 3 reads these marks.

**Identity score for `/game3d`: 3 before, 3 after.** Watch Post and Market Quarter also stay at 3 (each gains one signature
object; nothing is re-skinned). The Quest log is not touched in step 2.

## 1. Backend: what already exists, and the one new field

Nothing in this step needs a migration, a new table, a new route or a new worker job.

| Mark | Per-holding fact exists? | Where | Verdict |
| --- | --- | --- | --- |
| Raven | Yes. `RavenOut.holding_id`, `captured_at`, stable `id` | `backend/app/services/game/ravens.py`, `GET /game/ravens` (`backend/app/api/game.py`) | No backend work. The page already fetches it (`Game3DPage.tsx`, `getRavens`) but only keeps a count (`unseenRavens`) |
| Bell | Yes. `TowerOut.thesis` is `intact / review / breached / not_analyzed / not_applicable`; `tripwires_fired` is a count | `backend/app/schemas/game.py`, filled in `backend/app/services/game/state.py` from `thesis/monitor.py::build_monitor` (`classify`: firing beats review beats not-analyzed) | No backend work. A firing wire reads "breached", so a holding never gets bell and smoke from the same fact |
| Lit stall | Yes. `WatchlistRow.status === "buy_zone"`, `price`, `price_as_of`, `holding_id` | watchlist API, `frontend/src/lib/types.ts` | No backend work. The Quarter already shows these as a double pennant (`quarterPlan.ts`, `tone: "gold"`) |
| Notice | Yes, as a whole. `NightWatchOut.watch_state`, `last_frame_day`, `changes_since_last_frame[]` (kind, holding id, text) | `night_watch.py`, `frame_diff.py`, `GET /game/night-watch` | No backend work. The page already holds it (`nightWatch`) and uses only `status` |
| Smoke | **Partly.** `GameTower.tripwires_fired` counts fired wires but not whether you looked. `NightWatchOut.fired_overnight[]` has `holding_id` but only the last 36 h and including seen ones. `StandingOut.wires[]` is exactly "fired, active, `seen_at` is null" but carries `ticker` and `name`, no `holding_id` | `StandingWireOut` in `backend/app/schemas/game.py`, built in `get_standing` in `backend/app/api/game.py` | **One new field** |

### The new field

`StandingWireOut.holding_id: UUID | None = None` (additive; the default keeps every existing constructor and test valid).
`get_standing` fills it from `w.holding_id`, which the query already has. Computed from the same rows as today, read-only,
deterministic, no migration. The sample fortress still sends `wires = []`, so the sample shows no real smoke.

Rejected: matching by `ticker` (the same ticker can exist on two exchanges, and a wrong match would put smoke on the wrong
building); a new `tripwires_unseen` on `TowerOut` (it would be saved into stored frames, which hold a daily snapshot, while
"seen" is a live fact that changes the moment you press the button).

Mirror in `frontend/src/lib/types.ts`: `StandingWire.holding_id?: string` (optional: an older server or cache simply has no smoke).

## 2. Frontend: where each mark attaches

What the scene receives today: `Game3DPage.tsx` fetches state, ravens, night watch, standing, watchlist and journal as
separate calls, each allowed to fail on its own, then hands the scene one `SceneLook` (`Scene.tsx`). `stateToWorld.ts`
turns state into `TowerView` (`spot`, `plot.door`, `plot.doorYaw`, `plot.footprint`, `flag`). The perch shows a count of
birds (`RavenBirds.tsx`, `watchPlan.ts`), not a holding. The only smoke today is chimney decoration in the village
(`Embers.tsx`, `fxPlan.ts`), one component and one draw call per chimney, off under reduced motion.

| Mark | Attach to | New or reused |
| --- | --- | --- |
| Raven | `TowerView.spot` plus a fixed height | New instanced layer; reuses the bird shape and the near-black feather colour from `RavenBirds.tsx`. The perch is kept as it is (it is where you read the report) |
| Smoke | `TowerView.spot`, moved to the side away from `plot.door` | New instanced layer; reuses `fxState` and the sprite `/fx/smoke_soft.png` from `Embers.tsx`, with a new thin spec `THIN_SMOKE` in `fxPlan.ts` |
| Bell | The door point, one step sideways (`plot.door`, `plot.doorYaw`) | **The one new piece.** Code-built: a short timber post, an iron bracket, a bronze bell. No collider, so it can never block the door or fail the outdoor clearance test (`outdoorPlan.test.ts`) |
| Lit stall | `Stall.x/z/yaw` in `quarterPlan.ts`, drawn by `MarketQuarter.tsx`; plus `QuarterArch.tsx` | New small hanging lamp; reuses the flame and glass colours of `LanternPost.tsx` but **not** its post shape or its `pointLight` (a standing lantern means "survey check clear" in a land; a hanging lamp on a stall means "in your range") |
| Notice | `WatchPost.tsx`, a new `notices: 0..3` prop | Paper sheets in the post's existing `StaticBatch` (rebuild key gains the count) |
| Plain view | `TowerPanel.tsx` facts, for all holdings, including the ones with no room in the yard | New row "Marks" in words: "Raven: new report", "Smoke: a wire fired, not looked at", "Bell: due a look", or "Not reported" |

Files to touch:

- New: `frontend/src/game3d/marks.ts` and `marks.test.ts` (pure mapping, anchors, sources); `marksWordsV1.ts` (strings);
  `MarkLayer.tsx` (ravens, smoke, bells, one component).
- Edit: `Game3DPage.tsx` (compute the marks, one `useMemo`, add to `look`); `Scene.tsx` (`SceneLook.marks`, `EMPTY_LOOK`, mount
  `MarkLayer` in a group tagged `perfGroup: "marks"` beside the courtyard group); `MarketQuarter.tsx` and `QuarterArch.tsx`
  (lamps); `WatchPost.tsx` (sheets); `TowerPanel.tsx` (Marks row); `fxPlan.ts` (`THIN_SMOKE`); `lib/types.ts` (`holding_id`).
- Backend: `backend/app/schemas/game.py`, `backend/app/api/game.py`, plus one test.

### Pure mapping (what `marks.ts` exports)

```
holdingMarks(towers, facts) -> { byHolding: Map<id, {raven, smoke, bell}>, sources: Sources, offYard: {holdingId, kinds}[] }
facts = { recentRavenHoldingIds: ReadonlySet|null, unseenWireHoldingIds: ReadonlySet|null }   // null = source not read
litStalls(rows, nowMs) -> Set<holdingId>          // buy_zone and price_as_of within 5 days; null/NaN date = not lit
noticeSheets(nightWatch|null) -> 0|1|2|3          // min(3, changes) when watch ok and newest frame <= 2 days old
markAnchor(t: TowerView) -> { raven:{x,y,z,r}, smoke:{x,y,z}, bell:{x,z,yaw} }
Sources = { ravens, wires, thesis, stalls, watch }: "read" | "unread"
```

`markAnchor` uses only the plot (position, footprint, door yaw) and fixed heights, so a mark never says anything about
size, wall or moat. `sources` is the step-3 hook: step 3 may say "All quiet" only when every source is `read` and empty.

### Instancing, reduced motion, budget (how it works today, and what this step adds)

- Today: the code-built parts go through `StaticBatch` (merged once, rebuilt on a key). Motion is read once with
  `prefersReducedMotion()` (`motionPref.ts`); `QuestMarks.tsx` keeps the mark standing and stops the motion, `Embers.tsx` mounts nothing.
  Draw calls are counted per `userData.perfGroup` by `perfGroups.ts` (`tallyScene`), and a land is held to 120 calls.
- This step: one `MarkLayer` with **one `useFrame`** and **one instanced mesh per kind** (ravens, smoke sprites, bell bodies,
  bell posts), so 1 holding or 18 costs the same calls. No `pointLight`. Lamps and glow are bright materials, never lights.
- Budget for the whole step: at most **8 added draw calls** and **3,000 added triangles** with all 18 yard buildings marked
  three ways, in the yard; at most 2 in the Quarter (one instanced lamp, one glow); 1 sheet mesh at the Watch Post.
- Reduced motion: the raven hangs still above the roof, wings out; the smoke is a frozen column at one fixed time
  (no `useFrame` write); the bell hangs plumb; the lamp holds a steady glow. Every mark still stands, so no fact is lost.

## 3. Unknown-state rule (the part that must not break)

1. A source that did not report gives **no mark** and sets its `sources` flag to `unread`. It never draws a calm picture.
2. `unread` means: the request failed (`null` in the page), or the watch never ran (`watch_state === "never"`), or the
   thesis state of that holding is `not_analyzed` / `not_applicable`, or a price is missing or stale.
3. Nothing in step 2 writes "quiet", "all clear" or "nothing to do". The only calm words stay where they are today (the Night
   Watch card, which already refuses to say quiet for a watch that did not report). "All quiet" is step 3's, gated on `sources`.
4. Off-yard holdings (the 19th and beyond, section "no room" of step 1) get no mark in the world, but their facts are not
   dropped: the Plain "Marks" row lists them in words, and `offYard` is returned for step 3.
5. Demo wins: in the sample fortress every input comes from the sample endpoints (`demo_ravens`, `demo_night_watch`,
   `wires = []`), so no real fact can reach a sample mark. The marks the sample shows are the sample's own, until step 4.
6. Wrong is worse than absent: when a wire cannot be matched to a standing building (no `holding_id`), no smoke is drawn.

## 4. Acceptance tests (write them first)

Backend (`backend/tests`, pytest, `MACRO_DATA_PROVIDER=none`):
- `GET /game/standing` returns `holding_id` on every wire, equal to the tripwire's holding; a seen wire is not listed; a
  paused (inactive) rule is not listed; the sample returns `wires == []`.

Frontend unit (`marks.test.ts`, vitest):
- Raven: recent and unseen gives a mark on that holding only; seen gives none; older than 48 h gives none; a raven for a
  holding with no building (watchlist only, or off-yard) gives none and appears in `offYard`; `null` source gives none and
  `sources.ravens === "unread"`.
- Smoke: unseen wire gives smoke on its holding; wire without `holding_id` gives none; standing `null` gives none and
  `unread`; `watch_state === "never"` marks `sources.wires` unread.
- Bell: only `thesis === "review"`; `intact`, `breached`, `not_analyzed`, `not_applicable` give none; a breached holding never gets a bell.
- Lit stall: `buy_zone` and price 1 day old lights; `buy_zone` and price 9 days old does not; `near`, `above`, `no_price`,
  `currency_mismatch`, a missing date and a junk date do not; the arch lamp lights only when at least one stall does; same rows in
  any order give the same set (deterministic, `nowMs` passed in, no `Date.now()` inside).
- Notice: watch `ok`, 4 changes, frame 1 day old gives 3 sheets (capped); frame 5 days old gives 0; watch `old` or `never` gives 0; no changes gives 0 and does not say quiet.
- Anchors: for all 18 `outdoorPlan` spots the bell post stands clear of every door point and of the neighbour's door (same
  walk-the-yard idea as `outdoorPlan.test.ts`); the anchor depends on plot only (same marks for two holdings with different wall, moat, verdict).
- Words (`marksWordsV1`): no "buy", "sell", "add", "trim", "zone"; every line is 6 words or fewer; no digit strings.
- Shape-not-colour: the five marks have five distinct `shape` ids; no `positive` or `negative` token and no red or green hex in the new files.

Reduced motion (stub `matchMedia` to `reduce`): `MarkLayer` registers no motion update, positions are identical on two
frames, every mark is still present; with `no-preference` positions differ between frames. `THIN_SMOKE` frozen state is the same for any `t`.

Perf (18-holding yard): build a full yard (18 towers, every one with all three marks, so 54 marks), tally with `tallyScene`
for group `marks`: calls at most 8, triangles at most 3,000, instanced meshes at least 3, no light object in the group, and
exactly one frame callback registered. Quarter with 12 stalls all lit: at most 2 added calls. Manual (look-and-judge, not a
test): frame rate with 18 marked buildings on a phone, which step 1 also never measured.

## 5. Cut line

Order of cutting if the sprint runs long: (1) the Watch Post notice; (2) the arch lamp (stall lamps stay); (3) the Plain
"Marks" row for off-yard holdings (the in-yard rows stay). **Never cut:** the unknown-state rule, the Plain row for yard
holdings, reduced motion, the instancing budget.

## 6. Build split

- **backend-engineer (small, about half a day):** `StandingWireOut.holding_id`, fill it in `get_standing`, the test above. No migration, no new route.
- **frontend-engineer (the work):** `marks.ts` + tests first, then `MarkLayer`, bell, lamps, sheets, Plain row, page wiring, perf test.
- Order: both start together (the frontend reads `holding_id` as optional, so it never waits). **game-feel-engineer** reviews
  the bell and the smoke for the kit. Then `game-review`, then one PR "Closes #412 step 2" (the issue stays open for steps 3 and 4).

## 7. Look-and-judge (Faiz or the reviewer, not a test)

1. Yard from the gate, all three marks on: can you tell raven, smoke and bell apart without colour? (Desktop and phone.)
2. Smoke height: does it read from the gate, and does it ever leave the wrong building? (Roof heights are estimated, not measured. Nudge the fixed height.)
3. The hanging lamp next to the survey lanterns: does "lit on a stall" read differently from "lit lantern in a land"?
4. Reduced motion on: still readable?

## Pictures needed from Google Stitch

None. All five marks are code-built from parts already in the world. If the bell looks too plain after building, the one
picture to ask for would be: "a small bronze hand bell hanging from a wooden post, side view, plain background".

## Decision needed from Faiz (short)

1. **How old may a price be and still light a stall?** Default: 5 days (a weekend plus a holiday). Older stays dark and the plate says its age. The flat Marketplace has no such limit today.
2. **Bell: thesis review only, or also a 6 or 12 month look-back that is owed?** Default: thesis review only, one meaning per mark. The look-back can ring the same bell later.

Not asked again: the two step-3 questions (more than 18 holdings; where "since last visit" lives). Neither blocks step 2.
Step 2 keeps no "last visit" and no ticks: marks follow today's stored facts, and the raven already uses the browser's
seen list. The only link is that marks on a 19th holding have no building to stand on, handled by `offYard` above.
