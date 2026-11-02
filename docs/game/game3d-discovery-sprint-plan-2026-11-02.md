# 3D discovery: holding lands, the Siege Field and the Market Quarter (sprint plan proposal, 2026-11-02)

**Status: proposal only. No app code changed. Waiting for Faiz's answers to the decisions at the bottom.** Repo read at `main` `15b19ed` (#262 merged).

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge: one or two PRs, a clear "what you will see", and a test so it cannot quietly break later. This plan is the list of next steps for `/game3d`, in the order the team thinks works best. You pick what goes, what waits and what is cut.

## What you asked for

1. Every tower door takes you to **a new place of its own**, dressed like that holding's picture on the flat Map (gold mine, windmill, bank vault, farm...). Today every door opens the same library room.
2. A more grown-up **Siege Simulator** in 3D.
3. A more grown-up **Marketplace** in 3D.
4. Better 3D looks, using free models from the web that fit our KayKit style.

## Who took part

Six team members worked in parallel, each in their own role from `.claude/agents/`:

| Role | What they did |
|---|---|
| Game designer | Designed the holding lands, the Siege Field and the Market Quarter; listed what flat Game mode still lacks in 3D |
| 3D architect (frontend engineer) | How "walk in the door, arrive somewhere new" should work in code, loading one place at a time |
| Art scout | Searched KayKit, Kenney, Quaternius, Poly Haven and OpenGameArt for free models, sounds and effects; checked each licence |
| UX designer | How moving between places should feel; crowding, wayfinding, words |
| Game-feel engineer | Became the team's KayKit expert; how to make today's 3D look better and stay at 60 fps |
| Playtest QA | Ran `/game3d` locally in demo mode with a real browser, ran all 3D tests, wrote the test plan |

## What we found (the short version)

- **All 439 tests in `src/game3d` pass** (60 files, 11.5 s). QA walked the courtyard, the signpost and the Town in a real browser. It could not reach a tower or the Town Hall because the software-only graphics ran at 2 fps.
- **The courtyard is heavier than our own budget.** QA's stats overlay shows **528 draw calls and 139k triangles**; the budget is 300 draw calls. Most of it is the same barrel, crate, banner or stall drawn one copy at a time. Drawing copies in one go (what the horizon trees already do) is the biggest fix, and it has to come before we add new places.
- **The courtyard is crowded.** Up to 28 "press E" spots of 12 kinds. Each prompt has its own hand-written rule, and those rules don't always match what E actually does, so a prompt can promise one thing while E does another.
- **Every tower opens the same room**, and changing place is an instant jump: no fade, no name, and the label still says "3D courtyard" wherever you are. Reloading the page always drops you back in the courtyard.
- **The code for places is a chain of yes/no flags** (in the library, in the town, in the hall, in the records). Adding three new kinds of place on top would make it fragile. One "which place am I in" value fixes that.
- **Two sector lists disagree.** The Map pictures (`lib/mapArt.ts`) and the Map dive scenes (`lib/mapScenes.ts`) sort sectors differently: Health is a clinic in one and has nothing in the other. The holding lands need one list.
- **A real bug:** opening the latest report at the 3D reading table never marks it "opened", so reading in 3D never lifts that fog check (it does on the flat Scrolls page).
- **Fog of war is not drawn anywhere in 3D**: the four survey checks per holding never show up.
- **Good news on art:** most of the themed lands can be built from packs we already have (KayKit Hexagon has a mine, windmill, watermill, rocks, water and bridges; Dungeon has gold chests, coin stacks, keys and barred walls). The best new finds are free (CC0) KayKit packs on the same character skeleton we already use (list below).

Two notes were corrected while merging the reports: phone movement is out of scope (3D is desktop only, your decision of 2026-10-30), and reduced motion *is* handled in about ten 3D files today. What's missing is a fade between places, so there is nothing yet for reduced motion to switch off there.

## The big idea: one way to "go somewhere"

Every place (courtyard, Town, Town Hall, Records Hall, each holding's land, the Siege Field, the Market Quarter) becomes one entry in a single list, `game3d/areas.ts`. Each entry says where you arrive, where its doors are, what models it needs, how it is lit, and where "leave" takes you. Then every door in the game works the same way:

1. Walk up to the door. The next place's models start downloading quietly.
2. Press E. The door swings, the screen fades (about 1 second in total; a quick cut with reduced motion).
3. You arrive facing the place, and a name plate says where you are: *"Vår Energi's mill"*.
4. Leave by the gate you came in, press **B**, or click **← Back**. Esc always closes a panel first.

Only one place is loaded at a time, so the first load of `/game3d` does not grow.

## The holding lands (what each tower door leads to)

**One layout, many dressings.** Every holding's land has the same five spots in the same places, so a weak holding is never harder to read than a strong one. Only the scenery changes with the sector, and the scenery never carries a fact.

| Spot | What it tells you (always the real number) | What you see |
|---|---|---|
| 1. Gate stone, where you arrive | Name, weight in the portfolio, value in NOK | A carved stone. The land's size follows the holding's size class (4 fixed sizes) |
| 2. Survey ring | The four survey checks (report read, analysis fresh, invalidation written, value known) | Four lanterns: lit = clear, hooded in mist = fog, bare post = not judged. **This is fog of war in 3D, for the first time** |
| 3. The workplace (the themed centre) | Wall tier and moat tier | Its *condition* comes from the tiers only: strong wall = stone-lined mine shafts; rotten wall = propped timbers and a crack. Moat = a stream around the land: wide, narrow, none or mist |
| 4. Records house | The seven shelves and the reading table, as today | Today's library becomes an open-fronted building inside the land (no extra door, so a shelf stays 2 presses of E away). Reading the report here marks it opened (fixes the bug) |
| 5. Price post, by the exit | Margin of safety, thesis state, Storm Drill result | A plank gauge, a sealed scroll (whole, cracked, broken, fog) and a small banner (Sheltered, Exposed, Breach risk, ?) |

**The dressings** follow the flat Map picture exactly, so the 3D land and the Map always agree:

| Theme | For | Built from |
|---|---|---|
| Gold mine / quarry | Materials, mining, metals | KayKit Hexagon `building_mine`, rocks; new: RPG Tools Bits (pickaxes), Resource Bits (ore) |
| Gold bars vault | Physical gold (bullion) | Dungeon `chest_gold`, coin stacks, barred walls; bars from Resource Bits or built in code |
| Windmill / watermill | Energy, utilities | Hexagon `building_windmill`, `building_watermill`, water |
| Farmhouse | Food, staples (Salmon Evolution today) | Builder `house`, crates, sacks, hedges; optional salmon tanks built in code (decision D13) |
| Market stall | Retail, discretionary | Our market stalls and carts |
| Bank vault | Banks, insurers | Dungeon barred walls, keys, coin stacks; a vault door built in code |
| Factory | Industrials | No free factory model in our style: chimneys built in code on the Builder barracks (decision D4) |
| Fountain square | Funds and ETFs (a fund = many small stalls) | Kenney `fountain_round`, well, benches |
| Plain hall | No sector, or a sector without a picture yet | Today's library, unchanged |

**When we don't know:** an unsurveyed wall shows the workplace as a pale outline in mist with "Not surveyed yet" on the gate stone, never a healthy-looking mine. No sector shows the plain hall, never a guessed theme.

**Rules a test will check:** two holdings that differ only in sector look the same in every fact piece; two that differ only in wall tier look different. No gold pile grows with gains. No lighting changes with the verdict. No red or green.

## The Siege Field (the Siege Simulator, grown up)

**What you do:** *rehearse the siege.* Set the fall, walk the wall line, see which walls break, then write your plan.

Reached from the drill post (E → "Out to the siege field"). The drill post stays as the quick version.

| Piece | What it shows (same numbers as the flat Siege page) |
|---|---|
| The fall winch | The market fall you set; the slider stays the real control (keyboard, screen reader) and the winch just mirrors it |
| Two marker stones | "Storm line" and "Siege line": E at a stone jumps the fall there (the flat preset buttons) |
| Yardstick banners | Oslo Børs or World: E swaps them (the same switch as the flat page) |
| The wall line | One wall section per holding, worst first. **How deep the breach goes = the share that holding loses.** Up to 12 sections, then "N more on the flat page" |
| The fog bank | Holdings with no beta stand in mist with a "?" and the reason. Never a made-up height |
| The command tent | Portfolio totals and the level; the sky over the field is what this fall would do to the realm. One line: "A what-if, not a forecast." |
| The old battlefield | The backtest: per holding, what really happened in the worst stored fall (scorch mark) next to what the method said (chalk tick). Misses show as plainly as hits |
| The war table | Write your plan (as today); past plans pinned to the table, read-only |

The enemy camp stays a fixed size, as decided on 2026-10-31: only the wall line carries a number. New art: **KayKit Skeletons** as the attackers (free, same skeleton as our characters, if you say yes to enemies, decision D14) and **Kenney Castle Kit 2.0** for the trebuchet, ram and siege tower we don't have.

## The Market Quarter (the Marketplace, grown up)

**What you do:** *stroll the market.* Walk the lane, read the flags, step up to a stall, name your price.

A new place through an arch in the south-east corner of the courtyard. That removes today's limit of 8 stalls.

- **One lane, laid out like the flat Market Street:** stalls nearer the fountain are nearer your price. Unpriced stalls stand in a fog stretch by the far gate ("No price", never "0%").
- **Top mark** as a wax seal on the stall plate (fresh, ageing, old, fog). **Eight gate posts** on each stall front (open, ajar, shut, ?).
- **The price clerk** at the square: E = Restock prices (a price fetch, the same as the flat button; decision D12).
- Sal and the Hype Booth move into the square with their people.
- The courtyard keeps a small decorative corner and an arch sign: *"Market Quarter: 12 stalls, 3 near your price."*
- Optional, and the first thing to cut: walk into a store (merchant at the counter, eight gate arches, price board).

Never in 3D: "Buy" badges or "Sale" signs, crowds or fanfare when a stall comes into range, any counter that rewards restocking.

## Making today's 3D look and run better

From the game-feel engineer, in order of value for effort:

1. **Measure first:** add memory and frame-time numbers to the P overlay and record one baseline per place on your machine.
2. **Draw copies in one go** (barrels, crates, banners, stalls, fences): the courtyard target is 300 draw calls or fewer, then 150.
3. **Share the colour sheets:** each KayKit pack uses one shared texture; today some are loaded several times.
4. **One outline style:** characters and code-built shapes have the ink outline, but the town buildings have none.
5. **Crisper shadows near the hero, soft round shadows under people and stalls, a softer sky and fog.** All the same for every tower, so they flatter nothing.
6. **Small touches:** doors that swing, chimney smoke, forge sparks, dust; sound only if you switch it on, and never on a trade.

## The sprints

Sizes: S = one small PR, M = one or two PRs, L = three or more. Sprint numbers continue after S20.

| Sprint | What you will see | Size | Needs |
|---|---|---|---|
| **S21: one map of places** | Nothing yet; this is the groundwork. One list of places, one "which place am I in" value instead of four flags, and one shared "what am I standing at" check, so E prompts always match what E does. Tests pin today's exit spots first, so nothing moves | M | — |
| **S22: doors that feel like doors** | A fade and a name plate on every door, Esc closes any panel, B goes back, a reload keeps you where you were (`/game3d?at=town`). Plus a test-only shortcut so QA can open any place directly, and a first `/game3d` browser test | M | S21 |
| **S23: a lighter courtyard** | Same courtyard, smoother: copies drawn in one go, shared colour sheets, memory numbers on P. Target 300 draw calls or fewer | M | — (can run alongside S21) |
| **S24: one sector list + the report fix** | The Map pictures and Map dive scenes agree on every sector; reading the report in 3D lifts its fog | S | Decisions D2, D5 |
| **S25: the holding land, plain version** | Every tower door leads to its own land with the five spots, the survey lanterns (fog of war in 3D) and the records house. Every land uses the plain dressing for now | M | S22, S24 |
| **S26: first four dressings** | Mine/quarry, windmill/watermill, farmhouse and fountain square, built from packs we already have. One dressing per PR, each with its own picture for you to judge | M | S25 |
| **S27: the other dressings** | Bank vault, gold bars vault, market stall and factory (built in code), with the new free KayKit packs | M | S26; your downloads (list below) |
| **S28: the Siege Field** | The field, the wall line, the fog bank, the tent, the marker stones and the yardstick banners | M/L | S22; D6, D8, D9; Castle Kit download; D14 for Skeletons |
| **S29: the old battlefield** | The backtest in 3D, and past plans on the war table | M | S28; D7 |
| **S30: the Market Quarter** | The arch, the lane by distance to your price, the fog stretch, seals, gate posts and the price clerk | M | S22; D10, D12 |
| **S31: polish** | Outlines on buildings, soft shadows, sky gradient, door swings, smoke and sparks, sound if you switch it on. The store interior, if D11 = yes | M | S23 |

**Suggested order:** S21 and S23 together, then S22 and S24, then S25 → S26 → S28 → S30 → S27 → S29 → S31.
**If time is short, cut first:** the store interior, then the old battlefield (the flat page already shows the backtest).

## Free models and sounds we recommend

All CC0 (free to use, no credit required; we credit anyway in `frontend/public/models/CREDITS.md`).

| # | What | For | Where it comes from |
|---|---|---|---|
| 1 | KayKit Skeletons 1.0 (4 characters, 95 moves, same skeleton as ours) | Siege attackers | GitHub; Claude can fetch it |
| 2 | KayKit Character Animations (133 moves incl. mining and hammering) | Workers in every land | itch.io: **you download** |
| 3 | KayKit RPG Tools Bits (pickaxes, anvil, hammers, blueprints) | Mine, factory, workers | itch.io: **you download** |
| 4 | KayKit Resource Bits (gold, silver, iron, stone, wood) | Mine, vaults, market goods | itch.io: **you download** |
| 5 | KayKit Hexagon pieces we haven't used (mine, windmill, watermill, rocks, water, bridges) | Mine, energy, farm | already in the repo's source packs |
| 6 | KayKit Dungeon vault pieces (gold chest, coin stacks, keys, barred walls, mine timbers) | Bank, gold bars, mine tunnel | already in the source packs |
| 7 | Kenney Castle Kit 2.0 (siege weapons, ramparts; exact pieces to confirm in the zip) | Siege Field | kenney.nl: **you download** |
| 8 | KayKit Furniture Bits (books, shelves, lamps) | Records house | GitHub; Claude can fetch it |
| 9 | Kenney Impact Sounds + RPG Audio (footsteps, coins, locks, doors) | Sound, opt-in only | kenney.nl: **you download** |
| 10 | Kenney Particle Pack (smoke, sparks) | Chimneys, forge, siege | kenney.nl: **you download** |

**Not used:** De Alpe siege pack (no licence file), Thowsen ambience sounds (licence forbids redistribution, and files in our app can be downloaded by anyone), Poly Haven skies (photo-real, clashes with our flat painted sky), Quaternius Fantasy Props (no licence stated, textured style).

**Not available for free in our style, so we build them in code:** oil rig, salmon tanks and fish, mine cart, and possibly gold bars (if Resource Bits has none).

**What you need to download** (Claude's sandbox can reach GitHub but not itch.io or kenney.nl). Pick the free option on each page and unzip each pack into its own folder under `E:\Aladdin\frontend\3D art review\`. That folder is already gitignored and is where the last batch went. Claude then runs `node scripts/import-pack.mjs <folder> <licence-name>`, which reads the pack's licence file and refuses anything that isn't CC0:
- itch.io: KayKit Character Animations, RPG Tools Bits, Resource Bits, Forest Nature Pack
- kenney.nl: Castle Kit, Impact Sounds, RPG Audio, Particle Pack

No new Google Stitch pictures are needed for this plan: everything is a 3D model or built in code.

## Budgets (so new places don't make the game slow)

| Place | Draw calls | Triangles | New model download |
|---|---|---|---|
| Courtyard | ≤ 300 now, ≤ 150 after S23 | ≤ 300k | — |
| Holding land | ≤ 120 | ≤ 80k | ≤ 600 KB per dressing |
| Market Quarter | ≤ 160 | ≤ 120k | ≤ 800 KB |
| Siege Field | ≤ 180 | ≤ 120k | ≤ 1 MB |

The target is 60 fps on your desktop, and the first load of `/game3d` stays under 15 MB. A test reads each model file's header and fails the PR if a pack is over budget, so a heavy model is caught before it ships.

## How we test it

- **Pure tests (run on every PR):**
  - **Places and doors:** you never arrive standing on a door, every place leads back to the courtyard, and today's exit spots are unchanged.
  - **Truth rules:** each land's theme matches the Map picture, and theme and lighting never depend on the verdict.
  - **Same numbers as the flat page:** siege numbers match the flat Siege page; market order matches flat Market Street.
  - **Links:** a `?at=` link always opens the same place, and a broken one goes to the courtyard.
  - **Models:** model budgets, and a credits row for every model file.
- **Browser checks (new `e2e/game3d.spec.ts`, read-only, demo mode):** open each place directly, check it loads and shows its name plate, Esc and B work, nothing logs an error, and the draw-call count is under budget. They never write anything and never spend LLM quota.
- **On your machine:** press P in each place for the fps, and walk in and out of ten towers to check memory doesn't climb.
- **Look-and-judge:** each dressing ships with a screenshot in its PR, so you see it before merging.

## Game sprint checklist, section A (answered for the whole plan)

1. **Places touched:** `/game3d` courtyard (S21–S23, S30 arch), every tower's land (S25–S27, replacing today's library room), the Siege Field (S28–S29, new), the Market Quarter (S30, new). No flat page changes, except the Map dive scene list in S24.
2. **Identity score (UX designer, from code; to be confirmed in a browser):**

   | Place | Before | After | Why |
   |---|---|---|---|
   | Courtyard | 3 | 3 | Fewer E-spots, same scene |
   | Tower room → holding land | 3 (one shared room) | 3 (one land per holding) | The holding becomes its own place |
   | Drill panel → Siege Field | 2 | 3 | The wall line replaces the rows of numbers |
   | Market corner → Market Quarter | 2 | 3 | The lane order is the price distance |
   | "Where to?" menu, Quest log | 1 | 1 | Identity debt, not touched (follow-up after S31) |

3. **Visual wins:** the survey lanterns (S25), the wall line (S28) and the lane by distance (S30). Each encodes a real fact and deletes a list.
4. **Visual verb + scene:** given for each area above ("visit the holding", "rehearse the siege", "stroll the market").
5. **Words:** the panel totals for each place must not go up. The new name plates and lines are short and playful: *"Into Vår Energi's mill"*, *"Lost? Press G."*, *"The door is stuck. Try again?"*, *"← Courtyard"*.
6. **Kit:** the 3D pieces reused are the name plate, the fog patch, the seal and the banner. New pieces: the area veil and the lantern post (owner: game-feel engineer).
7. **Cut line:** the store interior, then the old battlefield. Never the Plain view, the unknown state or the screenshots.
8. **Rules:** each section above lists its rule risks. Every place keeps truth over flattery, fog for unknown, no red or green, a cut instead of a fade under reduced motion, and its draw-call budget.
9. **Taps:** opening a holding's shelf takes 2 presses of E (door, shelf). Reading a siege row takes 2 (drill post, field). Reaching the stall nearest your price takes 1 E plus a walk. Each is counted in a real browser before the sprint is called done.

## Risks we're watching

- **Falling through the floor while a place loads:** the hero is held still until the new floor exists.
- **Remembering models from earlier places:** memory could grow as you visit more places. We measure first and only add clean-up if the numbers show a need.
- **A pretty place flattering a weak holding:** the rules above, plus tests.
- **Extra taps:** opening a shelf must stay at two presses of E from the tower door, which is why the records house sits inside the land instead of behind another door.
- **Art fit:** each dressing ships on its own PR with a picture, so a bad fit is caught one at a time.

## Decisions needed from Faiz

The team's recommendation is in **bold**. Say "go with the recommendations" if you agree with all of them.

| # | Question | Recommendation |
|---|---|---|
| D1 | Should every land share one layout with different scenery, or should each sector get its own layout? | **One layout, many dressings** |
| D2 | Which sector list wins, the Map pictures or the Map dive scenes? | **Merge them into one list first; the Map pictures win where they clash** |
| D3 | Where does the library (records house) go? | **Inside each land, as a building** |
| D4 | The factory has no free model. Build it in code, or wait for one? | **Build it in code (chimneys on the barracks)** |
| D5 | Should reading the report in 3D mark it "opened"? | **Yes** |
| D6 | Should the Siege Field be its own place? | **Yes** |
| D7 | When should the old battlefield (backtest) come into 3D? | **After the Siege Field (S29)** |
| D8 | How many wall sections before "more on the flat page"? | **12** |
| D9 | Keep the drill post as a shortcut? | **Yes** |
| D10 | Should the Market Quarter be its own place? | **Yes** |
| D11 | Walk-in store interior? | **Later (cut first if short on time)** |
| D12 | Restock prices from 3D? | **Yes, it's only a price fetch** |
| D13 | Salmon Evolution: plain farmhouse, or add code-built salmon tanks? | **Add the tanks (a "fish farm" look inside the farm dressing)** |
| D14 | Use KayKit Skeletons as the attackers on the Siege Field? | **Yes, they never carry a number** |
| D15 | Most "press E" spots allowed in the courtyard once things move out | **12** |
| D16 | Back key | **B (Backspace can clash with typing in panels)** |

## Where the details are

The full reports from each team member are summarised above. Earlier plans this builds on: [KayKit sprint plan](game3d-kaykit-sprint-plan-2026-10-31.md), [free packs assessment](game3d-free-3d-packs-assessment-2026-10-31.md), [tower library](game3d-tower-library-2026-11-01.md), [siege yard](game3d-siege-yard-2026-11-02.md), [Market Street](market-street-redesign-2026-10-17.md), [Map sector pictures](map-sector-landmarks-2026-10-14.md).
