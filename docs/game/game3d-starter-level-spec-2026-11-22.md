# 3D starter level in a practice fortress: spec (2026-11-22)

**Status: Spec. Build step 1 (#493) merged in PR #500. Build step 2 (#494) merged in PR #507. Build step 3 (#495) merged in PR #529 (2408de7 on main; deploy not checked); section 11 lists where each step differs from this spec. Build steps 4 to 6 not started. Issue #477 (this spec: #489; questions: #490, closed 2026-11-22 with Faiz's answers in section 14; question 8 open in #492).** No code is changed by this file. Input: the review `docs/game/game3d-review-starter-level-2026-11-22.md` (#475).

**Faiz's decisions this spec follows (#476, answered 2026-11-22; recorded in PR #488, merged 2026-11-22):**

1. **Reward knowing, not acting: yes.** A visible reward for *understanding* is allowed: a page unlocked in the Book of Wisdom, a banner on the practice tower, a short cheer, when the player gets an idea right in practice. Earned once per idea, never repeats, never counts up, no score. Still banned: XP or points of any kind, streaks, daily pull, timers, leaderboards, any reward for buying, selling or trading.
2. **Practice fortress: yes.** One made-up company with made-up numbers. Labelled practice everywhere it shows. Never writes anything to the server. Never mixed with or shown as real data. The real fortress stays real-data only.
3. **Original advisors: no.** Barren Wuffet and Marlie Chunger stay, in the starter too. Their starter lines teach each idea in plain words and never rely on the player knowing who they parody.
4. **Freeze new places: yes.** No new places, rooms or levers in `/game3d` until the starter ships. Expert places (Royal Mint, Weather Tower plates, Town Hall boards, Standing, the Round) stay for Faiz but are hidden from a newcomer until the starter is done (section 7 says how).

## 0. What exists today (checked in code on this branch)

Every claim here was read in the file named. Anything not read is in "Not checked" at the end.

| Piece | What it does today | File |
|---|---|---|
| First Steps | Five steps: meet, sal, stall, weather ("Read the sky" since #478), why. Steps 3 and 5 read the real watchlist and journal; on the sample fortress they stay open. Saved in this browser under `aladdin.game3d.guide.v1`. "No XP, no reward, no streak" in the header. | `frontend/src/game3d/guideQuests.ts`, `guideWordsV1.ts`, `guideWordsV2.ts` |
| Advisor talk | `dialogueV8.ts` is the latest: Guide lines first (from `guideWordsV2.ts`), else `dialogueV6`. | `frontend/src/game3d/dialogueV8.ts` |
| Advisors | `oracle` = Barren Wuffet ("The patient one"), `partner` = Marlie Chunger ("The blunt one"), fixed spots just inside the gate, solid radius 0.6 since #480. | `frontend/src/game3d/npcs.ts` |
| Places | `courtyard`, `townhall`, `records`, `weather`, `mint`, `quarter`, and `holding` (one land per holding). A link names a place with `?at=`; an unknown token opens the courtyard. | `frontend/src/game3d/areas.ts`, `placeLink.ts` |
| Walk-up spots | One list `SPOTS`, each tied to one area; E and the prompt read the same answer. A new spot is one entry here plus one entry in the page's action table. | `frontend/src/game3d/near.ts` |
| Holding land | A hedged land with a gate stone (name, weight, value), four survey lanterns, a centre tower, a moat stream (`wide`, `narrow`, `none`, `mist`), a reading table, shelves, and a price post whose gauge reads "Lots of room", "Some room", "No room", "Too dear" or "Not priced yet" (fog). | `frontend/src/game3d/holdingLandLogic.ts`, `HoldingLand.tsx`, `pricePostWordsV2.ts` |
| Tower looks | Height by size class; moat width by tier (`narrow` = 1, `wide` = 2.2, unsurveyed = 0 and drawn as mist); wall look per material (`granite` 8 crenels, `timber` 4 crenels 2 cracks, `unsurveyed` no crenels). Labels "Granite walls", "Timber walls", "Walls not surveyed", "Narrow moat", "Moat not surveyed". | `frontend/src/game3d/towerLook.ts`, `frontend/src/lib/fortress.ts` (`WALL_LABEL`, `MOAT_LABEL`) |
| What walls mean | **Walls come from the balance sheet, not from profits:** net cash = basalt; net debt up to 1x a year's EBITDA = granite, up to 2.5x = brick, up to 4x = timber, above = rotted; interest cover under 3x drops one tier. Moat comes from the analysis's Wide / Narrow / None. Tower size comes from weight (15% / 7% / 3%). | `backend/app/services/game/rules.py` (`wall_for_stock`, `moat_tier`, `size_class`), `backend/app/domain/game_mapping/v1.py` |
| Price land | bargain = price below the bear-case value; discount = below base; full_price = above base inside bull; overpriced = above bull. | `backend/app/services/game/rules.py` (around line 405) |
| Tower flag | The flag on a tower shows the why: `intact`, `review`, `breached`, or none. | `frontend/src/game3d/stateToWorld.ts`, `TowerMesh.tsx` |
| Sal's counter | E at the stand opens the flat Marketplace's own `SalesRepDialog`, which writes: `api.addToWatchlist` when a stall opens (line 227; blocked in demo mode by the `demoMode` gate, lines 196 and 206), then the NewsWeb report imports in `sendRunners` (line 267), which run only after a stall was opened, so demo mode blocks them too. Shelves use plain names ("Food & Fish", "Healers", "Wires & Waves", "Odds & Ends"). | `frontend/src/game3d/boothPlan.ts`, `frontend/src/components/marketplace/SalesRepDialog.tsx`, `frontend/src/lib/salShop.ts` |
| Writing desk | Writes a new journal entry (`action: "hold"`, why and wrong-if) through `api.createJournalEntry` in `pages/Game3DPage.tsx` (`saveAtDesk`, line 399); the form blocks on the sample fortress (`deskForm.ts` line 51) with "Sample fortress, not yours. Nothing is saved here." (line 44). | `frontend/src/game3d/deskForm.ts`, `pages/Game3DPage.tsx` |
| Storm Drill | A post where you pick a fall (5% to 60%, default 30%) and write a plan; saved to its own table; blocked on the sample fortress. | `frontend/src/game3d/stormDrill.ts`, `stormDrillWordsV1.ts` |
| Real vs sample | The page fetches `/game/state` etc. on load. "Sample" is `state.demo === true` (server says so) or `demoMode === true` (from `GET /settings/demo-mode`, `lib/demoMode.tsx`). The sample round ticks in memory only and never stores; the panels are not saved in demo. Demo mode is a server-wide switch; its stocks are random watchlist picks with real ticker, name and sector and **invented numbers**. | `pages/Game3DPage.tsx` (lines about 245, 279-290, 336-370, 457-466), `backend/app/services/settings/demo_mode.py`, `backend/app/services/game/demo.py` |
| Plain view | The "← Plain view" link on the 3D page goes to `/fortress` (real or demo data). Only the Royal Mint has an in-world Plain view panel. | `pages/Game3DPage.tsx` (around line 1441), `MintPlainPanel.tsx` |
| Cheer | Confetti, 3 seconds, fixed seed, no red or green, nothing drawn with reduced motion. Today it fires only when the unwritten-thesis quest (quest 1, `questV2.ts`) is "done" on the real journal, once per page load (the caller is `Game3DPage.tsx`; `celebrate.ts` holds the pure rule). | `frontend/src/game3d/confettiLogic.ts`, `Confetti.tsx`, `celebrate.ts` |
| Clouds | Painted clouds by siege level, flat colour, no animation. | `frontend/src/game3d/Weather.tsx` |
| Sound | Synthesised ambience only, no files, off until the player opts in, never remembered. | `frontend/src/game3d/soundPlan.ts` |
| Local keys today | `aladdin.game3d.guide.v1`, `aladdin.game3d.visits.v1`, `aladdin.game3d.panels.v1`, `aladdin.game3d.round.v1`, `aladdin.siege.benchmark`, `aladdin-ravens-seen`, `aladdin-scrolls-opened`, `aladdin-game-mode`, `aladdin-fortress-view`, `aladdin-codex-seen`, `aladdin.marketView`. | grep of `frontend/src` |

**Two findings that shape this spec:**

- **The review's beat 3 would teach the wrong meaning of walls.** In the real fortress, walls are "how much it owes against what it earns in a year", not "does it make money every year". The starter must teach what the real walls mean, or the player learns one thing in practice and meets another in the real fortress. Beat 3 below teaches "makes money and owes little", and its numbers land on granite by the real v1 rule.
- **Today's demo mode puts invented numbers on real company names.** That is labelled "sample", but it is exactly what decision 2 says the practice fortress must not do. The practice company is made up end to end, and no real name carries a made-up number (section 1).

## 1. The practice company

**Name: Pip's Lemonade.** A lemonade stand by the park. Made up; no real brand meant. (Open: a name check before ship, #499.)

**Beat 2's pick: no real companies in the starter at all** (Faiz, #490 question 1). Sal's practice counter holds Pip's Lemonade only.

- Why: decision 2 says made-up numbers never sit on real data. A familiar real name (a fizzy drink, a game console) next to made-up coins would teach a child a false fact about a real company, and it borrows a real brand. Six familiar picks with *no* numbers would not work either: beats 3 to 6 need numbers.
- The cost: no "pick a company you know" moment. The choice in beat 2 is thin (one card). That is fine for a first run: the choices that matter are in beats 3 to 7.
- Rejected option: three made-up companies (lemonade, ice cream, bike repair), each with a full table. Better replay, three times the words to write, test and check. Can come later as "Play again with another shop" if a playtest asks for it.

**The single source:** every beat reads one frozen file, `frontend/src/game3d/practiceCompanyV1.ts` (to be written). Units are **coins**, a made-up money, so nothing reads as NOK or dollars.

| Fact | Value | What the real rule makes of it | Shown in beat |
|---|---|---|---|
| Name | Pip's Lemonade | | 2 |
| What it is | A lemonade stand by the park | | 2 |
| Pieces | The stand is cut into 10 pieces. You own 1. | One tower, the whole practice fortress, so size class `great` (100% is above 15%) | 2 |
| Money left over, year 1 | 6 coins | | 3 |
| Money left over, year 2 | 8 coins | | 3 |
| Money left over, year 3 (last year) | 10 coins | used as the year's earnings | 3 |
| Owes | 5 coins (the loan for the stand) | net debt 5 / earnings 10 = 0.5x, at or under 1x: **granite** (v1) | 3 |
| Cash | 0 coins | | Plain view only |
| Interest each year | 0.5 coins | cover 20x, above 3x: no tier down | Plain view only |
| What stops copying | Gran's secret recipe | **narrow moat** (a recipe is hard to copy, not impossible) | 4 |
| Worth of one piece, low guess | 8 coins | bear case | 5 |
| Worth of one piece, middle guess | 10 coins | base case (whole stand about 100 coins: 10 years of last year's 10) | 5 |
| Worth of one piece, high guess | 12 coins | bull case | 5 |
| Price of one piece | 7 coins | below even the low guess: **bargain**, gauge "Lots of room" | 5 |
| Room to be wrong | 3 coins on 10 (30%) | margin of safety | 5 |
| Storm | Every price falls 30% | | 6 |
| Price after the storm | 4.9 coins | still below the low guess: gauge stays "Lots of room" | 6 |
| Business after the storm | Still 10 coins a year, still owes 5, recipe still secret | walls granite, moat narrow, worth unchanged | 6 |
| Second storm ("Play again" only) | The fridge broke. Pip's borrowed 10 coins for a new one. Every price falls 30%. | | 6b |
| Owes, after the second storm | 15 coins | net debt 15 / earnings 10 = 1.5x, above 1x and at or under 2.5x: **brick** (v1). Interest 1.5 a year, cover above 3x: no tier down | 6b |
| Worth of one piece after the second storm | low 7, middle 9, high 11 coins | the 10 new coins owed come off the stand's worth: 1 coin per piece | 6b |
| Price after the second storm | 4.9 coins | still below the new low guess (7): gauge stays "Lots of room" | 6b |

A unit test pins that the tiers (granite, narrow, bargain; brick and bargain after the second storm) follow from these numbers under the v1 thresholds (1x / 2.5x / 4x, cover 3x; bear / base / bull), with a comment naming `backend/app/domain/game_mapping/v1.py`, so the practice can never teach a mapping the real fortress does not use. No other module carries a practice number.

## 2. Where it happens: the practice yard

**The starter is the one thing the freeze makes room for.** Decision 4 freezes new places "until the starter ships"; the starter itself is the exception it was written for. The yard adds **no new art place**: it reuses the holding land's layout and pieces (hedge ring, gate, centre pad, moat stream, price post, reading table), with no survey lanterns and no shelves.

**Recommend a separate area id, `practice`, not a made-up holding id.** Reason: a `holding` area is tied to a real tower in `world.plain` (`returnSpot` looks it up in the real towers; `?at=holding:<id>` waits for real towers). Slipping a made-up holding into that list risks the practice tower showing up in the Towers panel, the round, the marks or the Hourglass. A separate `practice` entry in `areas.ts` keeps the made-up tower out of every real list by construction. Cost: one entry in `AREAS`, its spots in `near.ts`, its row in the page's action table, `?at=practice` in `placeLink.ts` (today an unknown token opens the courtyard).

**Who is in the yard:** Barren and Marlie by the gate (same figures, yard spots), Sal behind a small lemonade counter beside the pad (the `merchantSal` figure from `boothPlan.ts`), one empty pad in the middle, a reading lectern with the Book of Wisdom by the gate. Sunny sky, no clouds until beat 6.

**How a newcomer gets there:** a newcomer's cold load of `/game3d` opens in the yard (section 7 decides "newcomer"). Everyone else reaches it by "Where to?" ("Practice yard") or `?at=practice`. Moving in and out uses the existing named fade.

**The yard leads.** When a beat ends, the camera turns to the next station and its card opens by itself (instant under reduced motion). Walking is allowed but never needed. This is what makes the starter playable on a phone before #485 ships.

**First Steps: absorbed, not kept alongside.** Recommend:

- Steps 1, 2 and 4 (meet the advisors, visit Sal, read the sky) are taught inside the starter (beats 1, 2 and 6).
- Steps 3 and 5 (stock a stall, write your first why) need real data, so they stay, as the two "real steps" shown after "Bring your real fortress", in a new words version (`guideWordsV3.ts`).
- A browser that already has a First Steps save keeps it exactly as it is (no tick lost).
- Why absorbed: two guides that both say "meet the advisors" bring back the "six lists" problem #478 fixed.

## 3. The eight beats

Every card is a small parchment plate at the bottom of the screen with at most three choices, so the scene stays in view. **Selecting acts:** there is no Save, Next or Confirm button. On keyboard, choices take 1, 2, 3 or Tab and Enter; E at a station opens its card if the player walked away. Tap counts are from the end of the previous beat. "Touch" means today, before #485; after #485 the same taps work, and walking is optional.

All shown words live in `starterWordsV1.ts` (to be written). Taught lines are spoken by the named person **inside the card header** (one plate, not a speech plate plus a card), with the speaker's name and a one-word tag ("Barren, the patient one"; "Marlie, the blunt one"; "Sal, the shopkeeper") so the speaker is clear without knowing the parody. Every sentence passes the game voice test: one breath, under 12 words, words a 12-year-old knows. A unit test counts words per sentence over every string in `starterWordsV1.ts`. **On-screen cap:** at most 35 words on screen in any beat (goal strip, practice tag, card with its header and choices), tested from `starterWordsV1.ts`. The yard at rest stays under 40 (section 8 item 5).

**Getting it right, and when a page unlocks (check beats 3, 4, 5, 6):** every check card has three choices, none of whose labels gives the answer away; the reason is in the result line only. A wrong pick shows a hint and the card stays. A right answer on the first or second try unlocks the beat's Book page. After two misses the right answer is shown with its reason, the world still changes and the beat moves on, but the page stays locked with "Play again to earn this page." No counter of tries is ever shown. This keeps the reward for knowing, not for tapping through.

**Keyboard, screen reader and focus:** (a) a polite live region reads the goal strip, each result line, each wrong-pick hint and each "New page: ..." once, when it changes; (b) when a card opens, focus moves to its first choice (build step 3, #495: to the speaker's line instead, so Enter alone picks nothing; see section 11), and returns to the canvas when it closes; (c) Escape closes a card, and E (or a tap) at its station opens it again; (d) while a card is open, 1 to 3 act on the visible choices only and the panel hotkeys (T, Q, P, E) are not taken; (e) the Book lectern opens the Book as a dialog with the same keyboard path as the other panels. Checked in build step 1's PR.

### Summary

| # | Player verb | What changes in the world | Idea in one sentence | Who says it | Taps (keyboard / touch) |
|---|---|---|---|---|---|
| 1 | Arrive | The yard fades in; goal strip "Build your first tower" | Each tower is a business you own a piece of. | Barren | 0 / 0 |
| 2 | Pick | A tower rises from the pad, still in fog | A share is a small piece of a business. | Sal | 1 / 1 |
| 3 | Knock (judge the walls) | Fog walls turn to granite | Strong walls: it makes money and owes little. | Barren | 1 / 1 |
| 4 | Fill the moat | Water fills the ditch to the narrow mark | A moat is what stops others copying it. | Marlie | 1 / 1 |
| 5 | Weigh | A balance tips; the price post gauge rises to "Lots of room" | Worth 10, price 7: that gap is room to be wrong. | Barren | 1 / 1 |
| 6 | Spot what changed | Clouds, the price drops, the tower shakes, walls and moat hold | The price fell. The business did not. | Barren | 1 / 1 |
| 7 | Pin your why | A sheet is pinned on the tower door; the flag goes up whole | Write why you own it, and what proves you wrong. | Barren | 2 / 2 |
| 8 | Look, choose | A banner unrolls down the tower; the Book opens | You can read a tower now. | Barren | 0 to see, 1 to choose |

From a cold load to the end: **7 taps plus the final choice** on the common path, on keyboard and on touch. No beat is over 2.

### Beat 1: Arrival

- **Player verb:** arrive, look.
- **World (visual verb):** the yard fades in with its name plate "Practice yard". An empty stone pad in the middle. A plate on the gate: "Practice: made-up shop, made-up coins". A teal quest diamond (the existing `QuestMarks` look) floats over Sal's counter. Goal strip at the top: "Build your first tower." A small "Skip practice" text control sits beside the practice tag for the whole starter (section 7).
- **Taught:** Barren: "Welcome! Each tower is a business you own a piece of." Marlie: "This is practice. Made-up shop, made-up coins."
- **Made-up fact shown:** none yet; the yard says it is practice.
- **Feedback:** the two lines show once in the arrival plate, no button to close; the plate goes when Sal's card opens, so the two are never on screen together. Goal strip. Diamond.
- **Empty / unknown / wrong:** loading shows the loading line (#479) with a yard line ("Setting up the practice yard..."), a new loading words version. Storage blocked: the starter still plays; the rules foldout says "This browser won't keep your book." No WebGL: today's "can't open here" card; it points to the flat fortress, which is real data (Faiz, #490 question 12: kept as is, no plain-text starter).
- **Taps:** 0 from a cold load (keyboard and touch).
- **Rules kept:** practice labelled in the world and the HUD; no score; no buy or sell wording; nothing fetched is shown in the yard.
- **Cheapest prototype:** the yard as a holding-land layout with a hand-built `RoomView`-like object from `practiceCompanyV1.ts`, static, no animation.

### Beat 2: Pick at Sal's counter

- **Player verb:** pick.
- **World:** the practice counter card is already open after beat 1. Picking makes a tower rise from the pad (about one second; appears at once under reduced motion). Its walls are drawn as `unsurveyed` (the real fog look: a pale, see-through tower with no crenels; "stakes and rope" in an earlier draft is not a look the game has), the moat ditch as mist, the price post gauge as fog with "?". The gate stone reads "Pip's Lemonade · 1 of 10 pieces · Practice".
- **Taught:** Sal: "A share is a small piece of a business. This piece is yours." Marlie: "Fog means nobody looked yet. Not good, not bad."
- **Made-up fact:** Pip's Lemonade, a lemonade stand by the park, cut into 10 pieces, you own 1.
- **Card:** title "Sal's counter (practice)". One company card: "Pip's Lemonade: a lemonade stand by the park". The whole company card is the tap target (a lemon, 🍋, plus the name; build 1 uses the emoji, a kit drawing can replace it); there is no separate button, because a one-choice button would only unlock the next step.
- **Feedback:** tower rises; a stone thud if sound is on; goal strip turns to "Knock on the walls."
- **Empty / unknown / wrong:** no wrong pick. If the player closes the card, the diamond stays over Sal; E or a tap on the counter opens it again.
- **Taps:** 1 (keyboard: 1 or Enter; touch: tap the company card).
- **Book page:** none. This idea is on the Book's cover, always open.
- **Rules kept:** "Pick", never "Buy". The practice counter is its own component and never `SalesRepDialog` (whose writes are the watchlist add and the NewsWeb imports). No real company appears.
- **Cheapest prototype:** card plus a tower that appears with no rise.

### Beat 3: Knock on the walls

- **Player verb:** knock (judge which walls this business has).
- **World:** the camera turns to the tower. Four cards stand face up on a plank by the wall (they flip as the camera arrives, or are already up under reduced motion): "Year 1: 6 coins left over", "Year 2: 8", "Year 3: 10", "Owes: 5 coins". On the right pick, the fog walls become granite (`WALL_LOOK.granite`, eight crenels, no cracks) and the plate "Granite walls" appears.
- **Taught:** Barren: "Strong walls: it makes money and owes little."
- **Made-up fact:** 6, 8, 10 coins left over; owes 5.
- **Card:** "Knock on the walls. Which walls?" Three choices, each a small drawing plus one word: "Granite" (squared blocks), "Timber" (planks with cracks), "Rotted" (broken stumps). No "strong" or "weak" on the labels; the reason is in the result line only. Shape and word carry it, never colour alone.
- **Getting it right:** Granite. Real-rule reason: it owes 5 and made 10 last year, so one good year pays it all back (at or under 1x: granite).
- **Result line (right):** "Granite walls. One good year pays its debt."
- **Wrong pick (Timber or Rotted):** the walls stay in fog. Marlie: "Look again. It owes 5. Last year it made 10." The card stays; pick again (the unlock rule in the section 3 intro). No try counter, no sound of failure.
- **Book page unlocked:** **Walls**.
- **Unknown:** before the pick, the walls are fog, labelled "Walls not surveyed" as in the real fortress.
- **Taps:** 1 (keyboard and touch).
- **Rules kept:** teaches the real wall meaning (debt against a year's earnings), so nothing in practice contradicts the real fortress. No praise for acting; the cheer comes only from understanding.
- **Cheapest prototype:** swap the tower's wall look from `unsurveyed` to `granite` on the pick; cards as flat plates.

### Beat 4: Fill the moat

- **Player verb:** choose what fills the moat.
- **World:** the dry ditch round the tower is in mist. On the right pick, water fills it to the narrow mark (the land's narrow moat width), and the plate "Narrow moat" appears.
- **Taught:** Marlie: "A moat is what stops others copying it."
- **Made-up fact:** Pip's has Gran's secret recipe.
- **Card:** "What stops others copying Pip's?" Three choices: "Gran's secret recipe", "A shiny new sign", "Cheapest lemonade this week".
- **Getting it right:** "Gran's secret recipe".
- **Result line (right):** "Narrow moat. A recipe is hard to copy." Truth over flattery: a lemonade stand does not get a wide moat.
- **Wrong picks:** "A shiny new sign": Marlie: "Anyone can paint a sign. Look for what they can't copy." "Cheapest lemonade this week": Marlie: "Anyone can cut prices tomorrow. Look for what they can't copy." The ditch stays in mist; pick again.
- **Book page unlocked:** **Moat**.
- **Unknown:** mist with "Moat not surveyed" until the pick.
- **Taps:** 1.
- **Rules kept:** the moat tier is honest (narrow); unknown is mist, never water.
- **Cheapest prototype:** moat width from 0 to narrow on the pick, no pour animation.

### Beat 5: Weigh the price

- **Player verb:** weigh.
- **World:** a balance scale stands beside the price post. Left pan: weights marked "Worth about 10", with a small tag "low guess 8". Right pan: coins marked "Price 7". Before the pick the scale is level and fogged, and the gauge reads "Weigh it" with the "?" marker (a practice-only fog label in `starterWordsV1.ts`; the real "Not priced yet" is not used, because a price is on screen). On the right pick, the scale tips toward worth and the gauge marker rises to the top: "Lots of room" (`GAUGE_FILL.bargain`).
- **Taught:** Barren: "Worth 10, price 7. That gap is room to be wrong."
- **Made-up fact:** one piece is worth 8 (low guess), 10 (middle) or 12 (high guess); its price is 7.
- **Card:** "Worth about 10. Price 7. How much room?" Three choices, the real gauge's own words: "Lots of room", "Some room", "No room".
- **Getting it right:** "Lots of room": 7 is below even the low guess of 8 (the real "bargain" rule).
- **Result line (right):** "Lots of room. Even a low guess beats the price."
- **Wrong pick ("Some room" or "No room"):** Marlie: "Weigh it again. Even the low guess is 8." The scale stays level; pick again.
- **Book page unlocked:** **Room to be wrong.** Its grown-up word line: "Grown-ups call this a margin of safety."
- **Unknown:** fogged scale and "Weigh it ?" until the pick.
- **Taps:** 1.
- **Rules kept:** no "buy", "pay", "deal" or "costs" ("costs" reads as a purchase; "price" is the price post's own word). The review's example "buy a 10-coin thing for 7" is dropped for that reason. The scale is a new motif; this spec names its one fact (worth against price).
- **Cheapest prototype:** the existing price post gauge only, with the scale added in a later PR (the gauge already carries the fact).

### Beat 6: The storm

- **Player verb:** spot what changed.
- **World:** starts on its own, but not on top of beat 5: beat 5's result stays for 2 seconds, then a plate "Storm coming" shows for 1 second, then the clouds come (no tap to start: a button that only starts the next beat would cost a tap and teach nothing). Clouds come over the yard (the storm look from `Weather.tsx`, static), the price on the post drops "7 coins -> 4.9 coins", the tower shakes once (reduced motion: no shake, a plate "Prices fell 30%" instead). The walls, the moat and the four cards stay exactly as they were, in plain view. The card opens only after the price has changed, so the change is the first thing the player sees. After the answer the clouds clear.
- **Taught:** Barren: "The price fell. The business did not." Marlie, after the right pick: "If it owed more, that would be news."
- **Made-up fact:** every price falls 30%. Pip's still makes 10 coins a year, still owes 5, still has the recipe.
- **Card:** "Storm! Prices fell 30%. What changed?" Three choices: "Only the price", "The lemonade got worse", "It owes more now".
- **Getting it right:** "Only the price".
- **Result line (right):** "Only the price. Walls and moat held."
- **Wrong picks:** "The lemonade got worse": the Year 3 card gets a thicker outline and a "Look here" tag with an arrow: "Still 10 coins a year. Look again." "It owes more now": the same on the Owes card: "Still owes 5. Look again." Shape and words, not a glow alone; nothing pulses under reduced motion.
- **Why not "stay or run":** the review's choice is a hold-or-sell decision in disguise. "Stay" as the right answer teaches "never sell"; "run" is a sell. The beat asks what changed instead, and says nothing about what to do with the piece. Marlie's line makes the other half true: a business change *is* news. A starter words test bans `stay`, `run`, `ride`, `ride out`, `weather it`, `hold`, `keep it`, `sell`, `sold`, `buy`, `bought`, `pay`, `cost`, `costs`, `trade` in every starter string (added after review: an earlier draft's goal strip said "Ride out the storm", which is the hold lesson this beat rejects).
- **Book page unlocked:** **Storms.**
- **Unknown:** none of its own; the business facts are all on screen.
- **Taps:** 0 to start, 1 to answer.
- **Rules kept:** no buy or sell wording; the price after the storm is exact (4.9), not rounded to flatter; the gauge still says "Lots of room" because that is what the rule gives, with no comment on it.
- **Cheapest prototype:** price plate change and a grey sky tint, no shake.

### Beat 6b: The second storm ("Play again" only)

Faiz said yes to #490 question 9 (2026-11-22). To be built in build step 4 (#496). Without it, every storm the player ever sees says "only the price", which would teach that a price drop never matters.

- **When:** on every run after the first ("Play again"), beat 6 is this storm instead. The first run always gets beat 6 as written, so the first lesson is the clean one.
- **World:** the same order as beat 6 (2 seconds, "Storm coming", clouds, the price drops "7 coins -> 4.9 coins"), plus one change in the business: the Owes card flips from "Owes 5" to "Owes 15" with a plate "The fridge broke. Pip's borrowed 10 coins." Then one wall section cracks and the walls turn from granite to brick (the real v1 rule: 15 / 10 = 1.5x). Reduced motion: no crack animation, the brick look and the word "Brick walls" appear at once. The moat stays narrow (the recipe is still secret). The price post gauge stays "Lots of room" (price 4.9 below the new low guess 7).
- **Card:** the same three choices as beat 6: "Only the price", "The lemonade got worse", "It owes more now". Same words on purpose: the player has to look, not remember.
- **Getting it right:** "It owes more now".
- **Result line (right):** "It owes more now. The walls cracked." Marlie: "If it owed more, that would be news. It does." (Marlie's line from beat 6, now true.)
- **Wrong picks:** "Only the price": the Owes card gets the "Look here" tag: "Owes 15 now. Look again." "The lemonade got worse": the Year 3 card gets the tag: "Still 10 coins a year. Look again."
- **Book page:** none new. The Storms page holds both halves from its first unlock (section 4). A right answer shows its result line only; nothing unlocks, nothing counts, no cheer.
- **Rules kept:** no buy or sell wording (banned-word test covers it); the change is shown with its number, not hinted; brick comes from the same pinned rule as granite.
- **On screen at once:** about 30 words with the card and one "Look here" tag open (card 17, goal strip, practice tag, tag, "Brick walls"), under the 35 cap; the word-cap test covers 6b's strings.
- **Taps:** 1, as beat 6.

### Beat 7: Pin your why

- **Player verb:** write (by picking fill-in chips).
- **World:** the camera turns to a small desk by the tower door. One row of chips at a time: row 2 appears after a chip in row 1. Picking one chip in each row pins a sheet on the tower door and raises the tower's flag "whole" (the same look and meaning as a real tower's flag: the why still stands).
- **Taught:** Barren: "Write why you own it, and what proves you wrong." Marlie, after: "Now you can check yourself later."
- **Made-up fact:** the player's own sentence about Pip's.
- **Card:** row 1 "Why I own it": "it makes money every year", "people love the recipe", "price below worth". Then row 2 "I'm wrong if": "customers stop coming", "it starts owing a lot", "someone copies the recipe". Each step of the card is under 20 words. On keyboard, 1 to 3 act on the visible row only.
- **Getting it right:** any chip in each row. There is no wrong why; the lesson is writing one down with its "wrong if".
- **Half-done:** one row picked: the sheet shows half-written on the desk; nothing is pinned yet.
- **Book page unlocked:** **Write it down.**
- **Taps:** 2 (one chip per row; the second chip pins; no Save button).
- **Rules kept:** the sheet is kept as two chip ids in the starter's own key, never in the journal; `deskInput` and `api.createJournalEntry` are not used.
- **Cheapest prototype:** chips and a pinned flat plate on the door.

### Beat 8: Reward and the way on

- **Player verb:** look, then choose.
- **World, in order (never all at once):** first a long banner unrolls down the tower wall with a lemon crest (a hanging banner, not the flag, so it never reads as the why) and the short cheer plays: confetti for 3 seconds (the existing `Confetti`, none under reduced motion). Then Barren's one line and the two buttons. The Book does not open by itself; the "New page" plates already pointed to it, and the lectern opens it. The banner and cheer need all five pages; a run that ended with a page still locked gets no banner and the line "Play again to fill your book."
- **Taught:** Barren: "You can read a tower now. Next, real ones."
- **Feedback:** the banner and the cheer. Once: a second run gives neither again (section 4).
- **Finished:** `finished` is set when beat 8 is reached, whatever the pages, so a player who closes the tab here is not left with the expert places hidden. The two buttons only choose where to go next.
- **Buttons:** "Bring your real fortress", "Play again" (section 5).
- **Taps:** 0 to see; 1 to choose.
- **Rules kept:** the reward is for understanding five ideas, once; nothing counts up; nothing is about acting.

### Key labels in game voice

Goal strip (build 1 ships the first two): "Build your first tower", "Knock on the walls", "Fill the moat", "Weigh the price", "Spot what changed", "Pin your why", "Your tower stands".
HUD tag and gate plate: "Practice: made-up shop, made-up coins". (Build 1: the plate stands on its own board beside the path; over the gate it hid the yard from the follow camera.)
Sal's card lead line (build 1): "Pick a shop. Its tower goes up." While the pick waits and the card is closed, the goal strip becomes the button "Open Sal's counter", so a phone (which cannot walk before #485) is never stuck.
Buttons: "Bring your real fortress", "Play again", "Skip practice". Lectern prompt: "Read the Book" (the only way in, besides the Quests card outside the yard).
Result lines: "Granite walls. One good year pays its debt." / "Narrow moat. A recipe is hard to copy." / "Lots of room. Even a low guess beats the price." / "Only the price. Walls and moat held."
Spelling: "practice" is only ever the noun (Practice yard, the practice tag); the verb on a button is "Play again", so a child never sees practice/practise side by side.
Unlock plate: "New page: Moat". Already-have line: "Already in your book."
Plain view (exact, neutral, section 9): "Practice yard, plain".

## 4. The Book of Wisdom

- **Pages (one per idea checked in practice):** Walls, Moat, Room to be wrong, Storms, Write it down. The cover holds beat 1 and 2's idea ("A share is a small piece of a business") and the line "Fog means nobody looked yet. Same on real towers.", and is always open.
- **Where it lives:** in the yard, on a reading lectern by the gate (E or tap). Outside the yard, as the first card of the Quests panel (Q), with no new key and no new toolbar chip, so no control appears twice.
- **An unlocked page shows:** a small drawing of the look it taught (granite wall, filled moat, tipped scale, cloud over a steady tower, pinned sheet), the one sentence, the Pip's fact that taught it ("Pip's owes 5 and made 10 last year"), the grown-up word ("Grown-ups call this a margin of safety"; "...net debt"; "...a moat"; the Write it down page has no grown-up word, because the game word "why" is the one used everywhere), and one line on where to see it in the real fortress ("Press T: each tower says its walls").
- **A locked page shows:** its title on a fogged page with a closed clasp drawn on it, and "Not learned yet"; an unlocked page shows its drawing and a ribbon. Shape and words, not fog alone. No "3 of 5", no bar, no "pages left", no number anywhere in the Book; the five titles are visible, and nothing more is added to them. A unit test checks that no Book string matches a count pattern (`\d+ of \d+`, `\d+/\d+`). Grown-up words such as "net debt" and "margin of safety" appear only on Book pages and in the Plain view, never on a card face (tested).
- **The Storms page carries two lines:** "The price fell. The business did not." and "If the business changes, that is news." The second line is the half beat 6b shows in the world, so the page never teaches "price drops never matter" even to a player who never plays again.
- **The unlock moment:** a plate "New page: Walls" slides in once beside the card. With sound on, one soft page-turn. Not repeated, ever, for that page in this browser.
- **Where state is stored:** this browser only, key `aladdin.game3d.starter.v1`: `{ status: "new" | "veteran", pages: PageId[], finished: boolean, skipped: boolean, run: { beat, picks } }`. `pages` only ever gains an id it does not hold. Nothing on the server. A damaged or missing value reads as empty, like `loadGuide` does today. Storage blocked: pages live in memory for the visit, and the Book says "This browser won't keep your book."
- **Play again without farming:** the run resets (pad empty, fog back, sky sunny); pages stay. A right answer still changes the world and shows its result line, but a page you already hold gives no unlock plate, no cheer and no banner, only "Already in your book." There is nothing left to gain, so nothing to farm.

## 5. Ending

| Choice | What it does | Real portfolio | No real portfolio | Demo mode on |
|---|---|---|---|---|
| **Bring your real fortress** | (`finished` is already set at beat 8.) Named fade to the courtyard. The expert places show (section 7). The Quests panel shows the Book and the two real steps (stall, why) in place of First Steps. | Towers stand from real data. Barren: "Same towers, real companies. Press T to read their walls." | Bare pads, as today (`stateToWorld` never invents towers). Barren: "No towers yet. Towers come from what you own." First real step: "Pick a company at Sal's. It gets a stall." That is the real app's normal watchlist write, not practice. | The sample fortress, labelled "Sample fortress, not yours" as today. Demo wins: nothing real is shown or written. |
| **Play again** | Resets the run in the yard; keeps the Book (section 4). | same | same | same |

The yard stays open after the end: "Where to?" lists "Practice yard", and `?at=practice` opens it.

## 6. Visual verb + scene

**Build and test.** One empty pad in a sunny practice yard. By the end: a great tower with granite walls, a narrow moat of water, a tipped scale by the price post, a pinned why on the door, its flag up, and a lemon banner down its side.

- **Motifs:** tower, wall, moat, fog, banner, scroll (the pinned sheet), quest mark. One new motif, the **balance scale**, carrying one fact: worth against price.
- **Where:** the practice yard (area `practice`), the tower on the centre pad, each station a few steps round it.
- **Pure mapping** (`starterPlanV1.ts` reading `practiceCompanyV1.ts`, with tests): picked -> tower stands, size `great`; owes 5 / earned 10 -> walls `granite`; recipe -> moat `narrow`; price 7 against low guess 8 -> gauge `bargain`, fill 1, scale tipped; storm -> price 4.9, walls and moat unchanged; two chips -> sheet pinned, flag `intact`; all five pages -> banner.
- **Unknown look:** every station starts in the real fortress's fog looks ("Walls not surveyed": pale tower, no crenels, moat mist, "Not priced yet" gauge with "?", fogged scale) until the player looks. The player learns that fog is "nobody looked yet" before meeting it on real data.
- **Words it lets us delete:** for a newcomer, the First Steps card and its "Sample fortress: stalls and whys are not saved here." line (`GUIDE_SAMPLE`), the "Read the sky" step copy, and the need for any panel text explaining walls and moat (the yard shows them). In the real fortress, the Book page replaces a paragraph a Towers panel would otherwise need.
- **Identity score:** practice yard, new: target **3**, scored at build from screenshots, not from this spec (minimum 2 to ship; it cannot be 3 while any card copy fails the voice rules). Courtyard (`/game3d`): **2 -> 2** (the touch plan's score; this work changes what a newcomer sees there, not its look).

## 7. Hidden from a newcomer (decision 4)

**What decides "newcomer":** a pure rule in `starterGateV1.ts` (a game rule, so versioned), decided **once per browser** the first time the new code runs:

- If `aladdin.game3d.starter.v1` is missing and **any** older 3D key exists (`aladdin.game3d.visits.v1`, `aladdin.game3d.guide.v1`, `aladdin.game3d.round.v1`, `aladdin.game3d.panels.v1`), the browser is a **veteran**: everything shows as today, the yard is offered in "Where to?", nothing is hidden.
- If none exists, the browser is **new**: the cold load opens in the yard, and the expert places are hidden until `finished` or `skipped` is set.
- The answer is stored as `status`, so a newcomer's second visit is still a newcomer until the starter is done.
- **Order:** the gate reads the older keys before anything on the page writes one (the visits counter in `hintLine.ts` is written on every load). A unit test pins the order: a browser with only `visits.v1` from before is a veteran; a browser whose first write is this load's visit is new.

**How Faiz still reaches everything:**

- His browsers that have opened `/game3d` before are veterans (the visits counter is written on every load, `hintLine.ts`). Not checked: which of his browsers have that key.
- On a new device: "Skip practice" (1 tap, no confirm) sets `skipped`. It sits beside the practice tag in the yard for the whole starter, not only on the arrival plate, and on every "After practice" door plate. Everything shows. No Book page unlocks for skipping, and the Book is untouched.
- Any explicit `?at=` other than `practice` (`mint`, `weather`, `townhall`, `records`, `quarter`, `holding:<id>`, `courtyard`) opens that place, newcomer or not, hidden or not, so QA, e2e and a returning player's bookmarks never drop into the yard. Only a bare `/game3d` cold load is gated.
- A returning player on a new or cleared browser is a newcomer. That is accepted: Skip is always one tap away.

**What "hidden" means, concretely:**

| Expert piece | For a newcomer |
|---|---|
| Royal Mint, Weather Tower, Town Hall doors | The buildings stay drawn (no layout or draw-call change). Their doors give no E prompt and show a small plate "After practice". |
| Town Hall boards' pages and the Mint in "Where to?" | Not listed. "Practice yard" is listed first. |
| Standing | Its Quests card is not shown. The Standing torches in the world stay as drawn (they carry a real fact; Faiz, #490 question 10). |
| Today's round | Its Quests card and chip count are not shown. |

**Nothing is deleted:** no place, file, link, save or test is removed. The gate is one pure function with tests; turning it off is one line.

## 8. Game sprint checklist, section A

1. **Pages touched:** new 3D place: practice yard (`practice`). Changed: `/game3d` courtyard (newcomer gate, "Where to?" rows, door prompts), the Quests panel (Book card; real steps after the starter), the 3D page's "← Plain view" button (opens the practice Plain view while in the yard), the loading line (a yard line). New panels: practice counter card, beat cards, Book of Wisdom, practice Plain view.
2. **Identity before -> after:**

   | Page | Before | After | Why |
   |---|---|---|---|
   | Practice yard | new | target 3, scored at build from screenshots | Signature object: the tower you build in front of you. Kit land pieces. Five facts encoded (walls, moat, gauge and scale, storm, flag). Its own Plain view. |
   | Courtyard `/game3d` | 2 | 2 | Look unchanged; newcomer sees fewer doors and lists. |
   | Quests panel, Book | HUD | HUD | A panel, not a place; the Book's pages carry drawings, not a list. |

   Identity debt (not touched, not re-scored here): Royal Mint, Weather Tower, Town Hall, Hall of Records and the holding lands have no Plain view of their own except the Mint (`game3d-standard.md` decision 1).
3. **Visual wins:** the tower you build (visual verb "build and test", fact: walls and moat from the practice numbers). The balance scale (fact: worth against price). Both delete words (section 6).
4. **Visual verb + scene line:** section 6. Each beat in section 3 names its look and its unknown look.
5. **Words:** yard at rest, at most 40 visible words: goal strip up to 6, practice tag up to 7, one card up to 25 including its choices. Every sentence under 12 words, and at most 35 words on screen in any beat (unit tests over `starterWordsV1.ts`, section 3 intro). Courtyard for a veteran: unchanged; for a newcomer: fewer (no First Steps card). **Voice:** player verbs pick, knock, fill, weigh, spot, pin, play again; labels in section 3 "Key labels in game voice". No methods language on a card face: "net debt", "EBITDA", "bear case" live only in the Plain view and the Book's grown-up line.
6. **Kit:** reused: holding-land layout and pieces (`HoldingLand.tsx`), tower look tables (`towerLook.ts`), price post gauge (`PricePost.tsx`, `pricePostWordsV2.ts` words), quest diamond (`QuestMarks.tsx`), label plates (`WorldLabel`, `gameTokens.ts`), advisor and Sal figures, `Confetti`, `Weather` clouds, the dialogue plate. Added (owner `game-feel-engineer`): balance scale prop, fact cards on a plank, hanging banner with crest, pinned sheet, Book of Wisdom panel (parchment, fogged page), practice tag. New colours (lemon yellow for the crest) go in a token file and are decoration, never status.
7. **Cut line:** section 13.
8. **Rules:** read-only (the yard sends no request of its own; test in section 11); deterministic (fixed numbers, pure mapping, same picks give the same world); unknown stays unknown (fog until looked at, real fog looks); no buy or sell wording (banned-word test); demo mode wins (the yard shows no real or demo data; "Bring your real fortress" shows the sample fortress in demo mode); truth over flattery (narrow, not wide; exact 4.9). Colour-blind: wall shape and word, moat width and word, scale tilt and words, fog with "?". Reduced motion: rise, flip, fill, tip, shake, cheer all have an instant form (`motionPref.ts`). Performance: section 8 item 10.
9. **Taps:** main task "finish the starter": 7 taps plus the final choice from a cold load, no beat over 2 (section 3). No control twice (the Book is in one place per area; the Plain view button changes target, it is not added twice). No empty form (cards open with their choices). No confirm step (selecting acts). Measured in a real browser in each build PR, not from the diff.
10. **3D place (practice yard), per `game3d-standard.md`:**
    - (a) Silhouette: a hedged yard, a lemonade counter, one tower rising from a pad, a scale by a post. A screenshot reads as Aladdin.
    - (b) Kit: as item 6. No one-off hex where a token exists (`HoldingLand.tsx` has inline hex today, e.g. `GRASS`; the yard must not add more, and that file's hex stays as debt).
    - (c) Facts: five, each through the pure mapping with a test, unknown as fog.
    - (d) Plain view: required, it is a new place. "Practice yard, plain": labelled blocks (Company, Pieces, Money left over per year, Owes, Walls with reason "Owes 5. Made 10 last year. Half of one year: granite.", Moat, Worth low/middle/high, Price, Room, After the storm), each "Not looked at yet" until its beat. One key or tap: the existing "← Plain view" button opens it inside the yard instead of leaving for `/fortress` (which would show real data).
    - (e) Keyboard path for every card; prompts say what E does ("Knock on the walls", not "Press E"). Phone: tap-playable before #485 (the yard leads); plates must not clip on a portrait phone (#439, #440, #434 are the reference failures). Text plates added to `LABEL_PAIRS` for the 4.5:1 test.
    - Draw calls: not measured. Expected near a holding land's count plus the scale, cards and banner. A headless run cannot measure it; "open `/game3d?at=practice`, press P" goes in each PR's "After deploy (Faiz)".
    - New GLB (if the scale comes from a pack): licence check and `scripts/glb-colour-audit.mjs`, result in the PR.

## 9. Invented names (accepted as proposed, Faiz, #490 question 14)

From the review's item 7. "Keep and teach" means the starter teaches it by touch. "Hide until after" means a newcomer does not meet it until the starter is done or skipped. "Retire" means a new words version stops showing it, with the old version kept.

| Name | Proposed action | Reason |
|---|---|---|
| Standing | Hide until after | Faiz's expert list; an owner's level, means nothing on day one. |
| Realm | Retire | A second word for "fortress" ("12.4% of the realm"). Say "of your fortress". |
| Siege | Hide until after | The starter teaches "storm"; two words for bad weather is one too many on day one. |
| Storm Drill | Hide until after | The starter's storm teaches the idea first; the drill is the real-data follow-up. |
| Night Watch | Hide until after | Written for the owner (review item 8). |
| night dispatch | Retire | Owner jargon; "last night's report" says it. |
| ravens | Hide until after | No news in practice; keep the motif for real reports. |
| wires | Hide until after | Needs a real why first. |
| bells | Hide until after | Part of the Round. |
| smoke | Hide until after | Part of the Round. |
| marks | Keep and teach | The starter's diamond is a mark, taught by following it; never named. |
| Vault | Hide until after | Owner fact (cash), no use in practice. |
| Hourglass | Hide until after | Good idea, needs real days. |
| Royal Mint | Hide until after | Faiz's expert list. |
| Toll Gate | Hide until after | Mint lever (`printer_v1.py`). |
| Great Press | Hide until after | Mint lever. |
| Great Melt | Hide until after | Mint lever. |
| Coin Rain | Hide until after | Mint lever. |
| Harbour Guard | Hide until after | Mint lever. |
| STAMP | Hide until after | Mint button. |
| Weather Tower | Hide until after | Faiz's expert list; a yield-curve room. |
| Hall of Records | Hide until after | Old guesses checked; needs history. |
| Town Hall | Hide until after | Faiz's expert list. |
| Big Board | Hide until after | Town Hall board. |
| Market Quarter | Hide until after | Shows stalls; opens with the first real step. |
| stalls | Keep, taught right after | The first real step ("Pick a company at Sal's. It gets a stall."). |
| Hype Booth | Hide until after | Tests tips; not a beginner's job. |
| lanterns | Hide until after | Survey lanterns; the yard leaves them out. |
| gate stone | Retire the name | It is just a sign with the name; nobody needs its name. |
| price post | Keep and teach | Beat 5: its gauge words ("Lots of room") are the lesson. |
| why | Keep and teach | Beat 7. |
| wrong-if | Keep and teach, retire the noun | Teach "I'm wrong if..."; on a card face say "what proves you wrong". |
| look-back | Hide until after | Six months of real data. |
| Cushion | Retire | Say "Room to be wrong", the starter's and the gauge's words for margin of safety. A new `parity3d` words version. |
| Purse | Hide until after | Town Hall page (accounts). |

## 10. Versioning (CLAUDE.md rule 3)

All shown wording and game rules go in new versioned files; no file already shown to Faiz is edited:

- `practiceCompanyV1.ts`: the numbers table (section 1). A change is `practiceCompanyV2.ts`.
- `starterWordsV1.ts`: every card, line, result, Book page and label in sections 3 and 4. PR #533 adds `starterWordsV2.ts` (#530), which changes one line, the Storms page's grown-up word ("Mr. Market"); the yard reads V2. Once V2 is merged it has been shown, so build step 4 writes its words in a new `starterWordsV3.ts`, whose word-cap, voice and banned-word helpers must read V3's own words (V2 re-exports V1's helpers, which read V1).
- `starterPlanV1.ts`: beats, right answers, unlock-once rule, the run, saving under `aladdin.game3d.starter.v1`. Build step 2 (#494) needed two rule changes, so its rules are `starterPlanV2.ts` (same key, same shape); V1 is unchanged.
- `starterGateV1.ts`: the newcomer rule and what is hidden.
- `dialogueV9.ts`: advisors in the yard speak `starterWordsV1`; elsewhere it falls back to `dialogueV8` unchanged.
- `guideWordsV3.ts`: the two real steps after the starter.
- `loadingWordsV2.ts`: the yard's loading line (written in build 1, #493, so the yard can load by link). Build 5's loading line, if it changes, is `loadingWordsV3.ts`.
- `areaWordsV2.ts`: the yard's name plate and page title (build 1). The V1 words files only took a narrower type (`AreaRefV1`); no shown wording changed.
- A new `worldWordsV3.ts` (or `parity3d` words version) if "Where to?" gains "Practice yard" or "Cushion" is retired.

## 11. Build steps (one PR each, each seen in a browser)

Each PR: `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; reviewers `playtest-qa`, `game-ux-designer`, `game-designer`, `game-feel-engineer`, `docs-sync-checker`, `board-steward`; taps measured from a cold load in a real browser by the session that builds it; screenshots desktop and phone, marked "headless only" if that is all it was; draw calls "not measured" plus the press-P line for Faiz.

1. **The yard, beats 1 and 2, the Plain view, the no-write test** (#493; merged in PR #500, 07bfc86 on main). The yard's Plain view rows are the section 8 item 10(d) list. `practiceCompanyV1.ts` with the tier test, `starterPlanV1.ts`, `starterWordsV1.ts` (beats 1 and 2), area `practice`, its spots, `?at=practice`, practice counter card, tower rises in fog, practice tag, "Practice yard, plain". Reached by `?at=practice` only (no newcomer gate yet).
2. **Beats 3 and 4 and the Book of Wisdom** (#494; merged in PR #507, 243868b on main). Fact cards, granite walls, moat fill, the Book (lectern and Quests card), unlock-once. What the build does that this spec did not say. Played in the desktop app's browser pane on 2026-11-25 against the Vite dev server (software GL, so headless only for the look); the screens and steps are listed in the PR, not stored in the repo:
   - **Rules in `starterPlanV2.ts`, not `starterPlanV1.ts`.** V1 is on main; beats 3 and 4 change two of its rules (the goal strip after the pick, and which saved picks a load keeps), so V1 is left as it was and V2 imports what it does not change. Same key, and the same saved shape plus two optional fields: the run's picks gain `walls` and `moat`, the choices tried at each check. The right answers come from `practiceTiers()` (walls) and Pip's narrow moat (moat), pinned by a test. The new words are added to `starterWordsV1.ts`, whose header lets later beats' words be added before they are shown; no existing line changed (the diff against main removes nothing).
   - **The goal strip steps aside while a check card is open.** The card's title says the same thing ("Knock on the walls. Which walls?"), and with the strip on screen the moat card alone came to 36 words (tag 5, strip 3, header 12, title 5, choices 11), over the 35 cap.
   - **The right answer is never the first choice**, and not in the same slot on both cards (walls: Timber, Granite, Rotted; moat: the sign, the cheap price, the recipe). Focus lands on the first choice, so in the spec's order Enter alone won every check (`game-ux-designer`, 2026-11-25). Pinned by a test.
   - **Slots never move.** A tried wrong choice becomes a blank slot with no words (a dashed outline, hidden from screen readers), and Marlie's hint takes the taught line's place in the header. Focus moves to the hint after a miss; a held key repeats nothing, and for 0.4 s after a miss no pick lands. With the choices sliding up after a miss, "Enter, Enter" or a double tap earned the Walls page without reading (`game-designer`, 2026-11-25); the Playwright test now presses the same key twice and checks nothing is earned. Every screen stays under the cap (tested in `screensOfBeats`). Rule for beats 5 and 6: the same (right answer never first, a different slot per card, slots fixed across a miss).
   - **The fact cards hang on a board over the path**, two rows of two, above head height, not on a plank by the moat. By the moat the numbers could not be read from the arrival spot, and beside the path a portrait phone cut off "Owes: 5 coins". The first card's "coins left over" is small print under "Year 1: 6".
   - **The walls and moat in words** stand on a stone plate west of the path ("Walls not surveyed" / "Moat not surveyed", then "Granite walls" / "Narrow moat"), using the real fortress's own labels (`WALL_LABEL`, `MOAT_LABEL`).
   - **Wording changed in review (none of it was shown before this PR):** the walls result is "Granite walls. One year's money pays its debt." (the rule uses last year's money, not "a good year"; beat 3 above still says the old line). The Moat page's fact says "a narrow moat" and its grown-up line is "Grown-ups say moat too: wide, narrow or none." so the Book keeps the honest width. The Book shows the practice tag under its title, because outside the yard it opens beside real towers. The banned-word test now catches endings ("selling", "buys", "holding") with "pays its debt" as the one allowed use.
   - **The Quests card for the Book shows only once the yard has been played** (the tower stands, or a page is held), so a player who never opened the yard is not shown a book of practice ideas.
   - **Not built in this step:** the camera turning to the next station (the card opens by itself; walking stays optional), the cards flipping, and the water pouring in (the moat changes at once, the spec's "cheapest prototype"). "Play again to earn this page." shows after two misses, but "Play again" itself is build step 4. On a phone the lectern cannot be reached until #485; the Book is the first Quests card outside the yard.
3. **Beats 5 and 6** (#495; merged in PR #529, 2408de7 on main). Gauge first, then the scale prop; the storm. Played headless (software GL, demo stack, 1280x720 and 390x844 with touch) on 2026-11-27; the look and the shake are Faiz's to judge on a real GPU. What the build does that this spec did not say:
   - **Rules in `starterPlanV3.ts`.** V2 stops every run at the price beat, so the two new checks are a new version; V2's walls and moat checks are imported unchanged. The right answers are worked out, not typed: the price from Pip's real land zone (`bargain` is "Lots of room"), the storm by comparing Pip's business before and after (`stormChange`: the same rule gives "It owes more now" for beat 6b). Slots: price right in **slot 1** (the gauge's own order, Lots, Some, No room), storm right in slot 3. Build step 2's rule ("the right answer is never first") left slot 1 never right on any card, so pressing "2, then 3" on every card earned every page without reading (game-designer review, #495). Now every slot is right on some card, no card repeats the slot before it, no pair of fixed slots wins every card (tested), and 6b's right answer ("owes", slot 2) differs from beat 6's. **A check card now opens with focus on the speaker's line, not the first choice** (walls and moat cards too), so Enter alone picks nothing; Tab reaches the choices and 1 to 3 pick by slot, as before.
   - **The gauge and the scale stand in front of the notice board, either side of the path** (scale west, gauge east), not by the land's price post. A land's post stands by its exit, behind the arrival camera, so in the yard (where the camera does not turn yet) the gauge was off the screen on a phone; under the board, its posts hid both. The yard's gauge label shows from anywhere in the yard (`reveal="always"`, the yard is walled in like a room; only the yard passes `PricePost` its `label`, so a real land's post is unchanged), with "? Weigh it" in the fog style before the pick.
   - **The storm card's header is not the taught line.** "The price fell. The business did not." is the answer, so the header before the pick is Barren's "Look at the cards, then the price."; the sentence lives on the Storms page. Marlie's "If it owed more, that would be news." is on the result plate.
   - **Beat 5's result stays 3.5 s, not 2 s**, the same as beats 3 and 4: the plate carries the result and the page line. Then "Storm coming" 1 s, then the storm (1.4 s for the shake, or under reduced motion the "Prices fell 30%" plate), then the card.
   - **The storm shows on the ground, not only in the sky.** From the follow camera only a thin band of sky is in view, so the courtyard's clouds (45 m up) never showed. The yard has its own low cloud places (`YARD_CLOUD_SLOTS`), the painted mountains take the storm sky's grey, and the grass and paddock go a clouded grey-green (no light changes; walls, moat, cards and price post keep their colours). All clear once the storm card is answered.
   - **Book pages written:** Room to be wrong (grown-up line "margin of safety"; where on real towers: a land's price post) and Storms (both halves; grown-up line "bear market" as merged in PR #529, then "Mr. Market" in `starterWordsV2.ts` by Faiz's call, #530: Graham's name for the moody price names the lesson, where "bear market" only named the size of the fall). Plain view rows: worth, price, room (after the pick), after the storm.
   - **Not built in this step:** the camera turning to the scale; the coin and weight sounds (build step 6). The "Look here" tag is a painted plank under the card with a brass frame round the card, not a 3D arrow.
   - **Seen on the way, not fixed here:** with the demo banner on a 390 px phone, the 3D view runs below the fold, so a plate at the bottom of the screen (results, "Storm coming") sits partly under it (#528). The PR for #528 sizes the 3D view to the screen below the strip (`frontend/src/game3d/fitToScreen.ts`; written, PR open). Measured headless with demo mode on: it fits with no page scroll at 412x915, 390x844, 375x812 and 375x667; at 360x640 the view's old 480 px floor still wins and the page runs 9 px over, and a landscape phone still scrolls (the strip takes about 177 px of a 390 px screen). Every later build step checks its bottom plates and buttons on a phone **with demo mode on**, since that is how the yard is tested.
4. **Beats 7 and 8, the ending and the second storm** (#496; the PR for #496 adds it, written, PR open). Chips, pinned sheet and flag, banner, cheer, "Bring your real fortress", "Play again", beat 6b on "Play again" (brick walls, Owes card flip), `dialogueV9.ts`. Played headless (software GL, Vite dev server with the API stubbed, 1280x800 and 390x844) on 2026-11-27: both runs end to end by keyboard; the look is Faiz's to judge on a real GPU. What the build does that this spec did not say:
   - **Rules in `starterPlanV4.ts`.** V3 stops at "Pin your why" and fixes the storm's right answer to the first storm, so the rest is a new version; V3's walls, moat and price checks are imported unchanged. Same key; the saved shape gains three optional fields: `run.second` (this run gets the second storm; kept only for a finished player), `run.picks.why` (the two chips) and `banner` ("now" in the run that earned it, "done" ever after). The second storm's right answer is worked out like the first (`stormChange` over Pip's numbers before and after), and "worse" is now judged by what Pip's makes in a year, not by its worth (the new loan lowers the worth of a piece; the lemonade is as good as it was).
   - **Beat 6b earns the Storms page if it is not held yet.** Section 3 says "none new"; with that rule a player who missed the first storm twice could never fill the Book, and so never get the banner. The Storms page carries both halves of the lesson, so earning it in 6b teaches nothing false. A held page still gives only "Already in your book."
   - **Words in `starterWordsV3.ts`** (V2 untouched). Its helpers read V3's own words, and the word-cap test covers 6b, 7 and 8. The why card's title is the row's label ("Why I own it", then "I'm wrong if"): with a separate title the card came to 38 words, over the 35 cap. The scale's sign and the Plain view's worth row follow the second storm (worth 9, low 7), as do the walls, owes and storm rows; before this they would have said 10 and 8 after the loan.
   - **The hero is put by the tower door when the why card opens** (once per visit; also on a reload at the end). From the arrival spot the notice board and the HUD hide the tower's lower face, so the pinned sheet and the banner could not be seen; this is the cheap stand-in for the camera turn in beat 7. The spot is west of the tower, clear of the two advisors, whose name tags filled the screen from a spot nearer them. The sheet and the banner hang on the tower face toward it.
   - **Beat 8's order:** the why's result plate (3.5 s), then, with all five pages and only once ever, the banner shows and the confetti bursts (3 s), then Barren's line and the two buttons, focus on "Bring your real fortress". "Play again" starts the new run at Sal's counter (the arrival plate is not shown twice).
   - **Review fixes (game-feel-engineer, game-ux-designer):** under reduced motion the cheer holds 1.5 s, not 3 s (no burst to wait for; the banner's line is still read). The yard's confetti goes up over the practice tower, not the courtyard fountain (`Confetti` takes an `origin`). The pinned sheet is wider (2.3 m) so its two lines can be read on a phone. The Plain view's why row says the two chips picked ("Why: ... Wrong if: ..."). "Bring your real fortress" takes focus at once, so for 400 ms an Enter or Space (a key still held from the why card) (or a repeating key) is ignored; a click is not. The banner's pieces have no ink outline. Known: from `DOOR_VIEW` the flag on the tower top is out of frame on a phone; the sheet and the banner are in view.
   - **Not built in this step:** `dialogueV9.ts` (the advisors in the yard cannot be talked to, so there is nothing for it to say yet; it moves to build step 5, #497, with Barren's courtyard lines); Barren's courtyard lines after "Bring your real fortress" (they go with the two real steps in `guideWordsV3.ts`, build step 5); the wall crack animation (the walls turn brick at once, the spec's reduced-motion look, for everyone); the half-written sheet on a desk (instead, row 2's card header is the half-written sheet, "Your why: <row 1's chip>.", so the "wrong if" is picked beside its why; nothing is in the world until the sheet is pinned); the UX leftovers from #495 (skipping the storm lead-in, the goal strip under a result plate, the price card's numbers twice). The keyboard E2E plays both runs; the touch E2E plays the why and the not-full end (not Play again or a storm miss, which the keyboard run covers).
5. **The newcomer gate and First Steps absorbed** (#497). `starterGateV1.ts`, cold load into the yard, hidden doors and lists, "Skip practice", `guideWordsV3.ts`, `loadingWordsV3.ts` if the loading line changes. The gate must also decide a browser whose starter key exists **without** `status` (every key written by builds 1 to 4 has none), and a first visit that lands on `?at=practice` (it writes `visits.v1` on load). **E2E:** the existing regression tests start from a fresh browser, which would now be a newcomer; this PR seeds `{ status: "veteran" }` for them and adds newcomer tests.
6. **Sound cues and polish** (the cut line, #498), plus what build step 2 left out: the camera turning to the next station, the fact cards flipping, the water pouring into the moat, and a small neutral cue when the walls or moat change (`game-feel-engineer`, #494).

**The test that proves the practice fortress makes no write** (Playwright on the demo stack, `frontend/e2e/regression/`, added in step 1 and extended each step):

- Open `/game3d?at=practice` in a fresh context; wait for the yard.
- Snapshot `localStorage` (every key and value), after the page has finished loading (the visits counter `visits.v1` is written on every load, before the snapshot).
- Record every backend request (`/api/`) from that moment (`page.on("request")`).
- Play every beat to the end by keyboard, then again with touch emulation by taps only, including one wrong pick per check beat and "Play again".
- Assert: every recorded `/api/` request is `GET`, `HEAD` or `OPTIONS` (no `POST`, `PUT`, `PATCH`, `DELETE`); no request goes to the watchlist, journal or storm-drill write routes; no request URL or body contains "Pip" or "practice".
- Assert: every key in the snapshot is unchanged; the only key added or changed is `aladdin.game3d.starter.v1`; `aladdin.game3d.guide.v1` and `aladdin.game3d.round.v1` are untouched.
- Assert: no real panel opens in the yard (Q and T open nothing and the Towers tool is not on the toolbar), the courtyard's Towers panel (T, after walking out) never lists Pip's Lemonade, and the yard shows the practice tag on every screenshot.
- Plus a unit test: no `starter*.ts` or `practice*.ts` file imports `lib/api`.

## 12. The playtest

**Question:** after 10 minutes, can a 12-year-old explain a moat and a margin of safety in their own words?

**How it is run (Faiz is not the tester):**

1. **Scripted pass, every build PR:** `playtest-qa` plays the yard end to end in Playwright (keyboard and touch emulation), records taps per beat, screenshots each beat, and reads every string aloud against section 6 of the voice standard. This proves the yard works. It cannot answer the question.
2. **Real young player, once, after step 4:** a child of about 12 who has not seen the app, on a laptop and on a phone. A written script: one sentence to start ("This is a game. Play it for 10 minutes."), no help, no hints. At 10 minutes, two questions: "What is a moat?" and "Why would you want room to be wrong?". Answers written down word for word, with where they got stuck. Watch point: does the child feel any choice before beat 3 (beat 2 has one company)? Write down what they say. Faiz picks who the child is and who sits with them (#490 question 8, left open until after build step 4: #492); the person who sits with them follows the script and does not teach. An AI reader cannot stand in for this; any proxy is labelled a proxy.
3. **Pass:** the child explains both ideas in their own words without using the game's lines back. A fail names the beat to fix before the expert places reopen.

## 13. One thing to cut if it runs long

**The one-shot sound cues** (stone thud, water, scale clink, page turn). Sound is off by default and today has no one-shot cue at all (only ambience in `soundPlan.ts`), so this is new work that teaches nothing on its own. Never cut: the fog looks, the practice Plain view, the screenshots.

(The review's off-screen arrow toward the quest mark is not needed in the yard: the yard leads the camera to each station. It stays a courtyard idea.)

## 14. Faiz's answers (#490, 2026-11-22)

Faiz answered in the chat on 2026-11-22. Thirteen are answered; question 8 is left open until after build step 4, when it is needed. The build steps can start.

| # | Question | Answer |
|---|---|---|
| 1 | Company and beat 2 | **Pip's Lemonade only.** One made-up company, no real companies in the starter. |
| 2 | Walls | **"Makes money and owes little"**, the real v1 rule, not "profits" alone. |
| 3 | Storm | **"What changed?"** replaces "stay or run". |
| 4 | Area | **A separate `practice` area**, the one exception to the freeze. (Accepted as proposed.) |
| 5 | First Steps | **Absorbed into the starter**, with stall and why kept as the two real steps after it. |
| 6 | Newcomer rule | **Once per browser; any older 3D key means veteran; "Skip practice" always one tap away.** |
| 7 | Book | **On a lectern in the yard and as the first Quests card outside, no count shown.** (Accepted as proposed.) |
| 8 | Playtest | **Open, now #492.** Faiz decides later who the young player is and who sits with them; needed only after build step 4. |
| 9 | Second storm | **Yes**, in build step 4: beat 6b above. |
| 10 | Standing torches | **Leave them drawn** for a newcomer; only the Standing Quests card is hidden. |
| 11 | Order against touch (#485) | **Starter first.** (Accepted as proposed.) |
| 12 | No WebGL | **The fallback card keeps pointing to the flat fortress.** No plain-text starter. |
| 13 | Demo mode and the starter's key | **The starter saves its own key in demo mode** (the Book's page ids, the run's progress and the skip flag; no real or demo fact). (Accepted as proposed.) |
| 14 | Names table | **Accepted as proposed** (section 9). |

## Review

- `game-designer` wrote this spec (2026-11-22).
- `game-ux-designer` reviewed it the same day: 3 blockers (the "Ride out the storm" strip, guessable two-choice checks, beat 7's card size) and 14 should-fixes (beat 2's one-choice button, the storm pile-up, beat 8 pile-up, `finished` and Skip gaps, gate order and deep links, glow-only hints, screen reader, Book count, on-screen word cap, "costs", the gauge label in beat 5, the one-lesson storm) plus nits. All are applied above; question 9 answered yes on 2026-11-22 (beat 6b).

## Not checked

- Whether `Confetti` can be fired from a new area (it is drawn in the courtyard scene today); whether `Weather.tsx` can be drawn in a non-courtyard area; the exact `FortressSiegeLevel` value names it takes.
- Whether `lib/fortressSound.ts` can play a one-shot cue (only `soundPlan.ts` was read).
- How `LoadingLine.tsx` picks its words per area (the file was not read; `loadingWordsV1.ts` exists).
- How `Toolbar.tsx` would host a practice tag (not read beyond a search).
- Which of Faiz's browsers hold `aladdin.game3d.visits.v1`. Goes into build step 5's "After deploy (Faiz)": open `/game3d` on each device once before the gate ships, or use "Skip practice".
- The draw-call count of a holding land today (needs a real GPU and press P).
- Whether "Pip's Lemonade" clashes with a real brand (#499, Faiz, before build step 1 merges).
- The decisions as worded in PR #488 (merged after this branch was cut, not on this branch); this spec uses the wording given by the main session.
