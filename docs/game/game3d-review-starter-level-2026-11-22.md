# 3D game review: is it fun, can a young player follow it, and a real starter level (2026-11-22)

Issue #475. Status: **a review, no code changed.** Follow-up work is on the board: #476 (decisions, answered 2026-11-22, see "Decisions"), #477 (starter level), #478 (Quests panel), #479 (loading line), #480 (feel fixes); #478 to #480 are merged (PRs #483, #484, #487).

Faiz asked for an honest review of the 3D game (`/game3d`): how engaging it is, how easy it is for a younger player who is not an economist, which decisions to challenge, and what to improve, scrap or add for a full starter level.

## How it was reviewed

- **Code:** `frontend/src/game3d/` (on `main` at `2d89d61`: 262 source files, 398 with tests, about 37,000 lines with tests), `pages/Game3DPage.tsx`, the First Steps guide (`guideQuests.ts`, `guideWordsV1.ts`, `dialogueV7.ts`), the places map (`areas.ts`), the list of things you can walk up to (`near.ts`), and the 3D docs in `docs/game/`.
- **Live site, read-only:** the built-in browser on Faiz's computer, signed in on his real data (no names or amounts are copied here). Walked the courtyard as a newcomer: talked to both advisors, opened Sal's counter (picked nothing), the Night Watch post, the Quests, Towers and "Where to?" panels, then the Weather Tower and the Royal Mint by their `?at=` links. Which commit is deployed was **not checked**; `main` has moved since (the Siege Field changes in #460 to #471).
- **Not done:** no local or demo-stack run (this machine has no Node.js or Postgres). The browser pane was **hidden** for the whole walk, so load times and frame rate from it mean nothing (the 2026-11-17 look found hidden panes load slowly). Not seen on a phone. No young player has tried it.
- **Side effect:** talking to the advisors moved First Steps on in the built-in browser's own storage (`aladdin.game3d.guide.v1`). Nothing was written to the server.

## Verdict

| | Score |
|---|---|
| How well it is built and how honest it is | **8/10**: fog for unknowns, versioned wording, tests beside every plan |
| Fun for a new, young player | **3/10** |
| Understandable without knowing economics | **2/10** |

Today the 3D game is **the investing app in a castle costume, not a game.** Nearly every action is the same: walk somewhere, press E, read a panel, and most panels are flat app pages over the world. The world seldom answers what you do, and there is no reason to play unless you already hold a real portfolio.

## What a newcomer meets (evidence)

1. **No loading message.** While the world loads, `/game3d` and each place link show an empty sky or a dark room under the toolbar. The page has a "Raising the walls..." fallback, but the canvas loads its models under `<Suspense fallback={null}>` (`game3d/Scene.tsx`), so nothing says the page is working. Load time not measured (hidden pane). → #479
2. **The first two talks teach nothing.** Barren: "Welcome, friend. I am Barren Wuffet. Marlie Chunger stands beside me. Say hello to her too." Marlie: "That's both of us. Barren has a job for you." Nobody says what this place is, who you are or what you are trying to do.
3. **Six lists in one Quests panel:** Today's round (four "Bell: TICKER is due a look"), First Steps, Standing ("Level 1 of 5: Bare Ground. Lift the fog: fetch reports, then ask for the analysis."), Write Your Whys, Six-Month Look-back and Storm Drill. The chip badge counted the bells. First Steps read **"0 of 5 done" with step 3 ticked**, because the level only counts steps done in a row (`guideStatus`). → #478
4. **The starter sends a beginner to a yield curve.** First Steps step 4 is "Walk into the Weather Tower" ("Know the weather before you build"). Inside: "Norway's curve: one post for each maturity", posts from 3M to 10Y with percentages, and wall plates such as US unemployment. → #478
5. **Sal's counter is the best moment, and still leaves you stuck.** The shelf names are lovely plain words ("Food & Fish", "Healers", "Wires & Waves", "Odds & Ends"). But there are 597 companies, sizes read "934 bn" with no unit, and nothing says why you would pick one.
6. **"Where to?" is the app's menu, not a game map:** 22 destinations on the live site (the register it reads, `parity3d.ts`, has 24 rows on `main`), almost all flat pages ("Label check", "Report line", "Purse", "Shiny Metal", "Cushion").
7. **About 30 invented names to learn:** Standing, Realm, Siege, Storm Drill, Night Watch, night dispatch, ravens, wires, bells, smoke, marks, Vault, Hourglass, Royal Mint, Toll Gate, Great Press, Great Melt, Coin Rain, Harbour Guard, STAMP, Weather Tower, Hall of Records, Town Hall, Big Board, Market Quarter, stalls, Hype Booth, lanterns, gate stone, price post, why, wrong-if, look-back, Cushion, Purse. Each is a second thing to learn on top of the real idea, and none is taught by touch.
8. **The Night Watch is written for the owner, not a newcomer:** "Quiet night. The Watch reported on time. Last look ... · N readings saved. Break the seal: dispatch details."
9. **The Towers panel holds the best idea, unexplained.** Each holding shows walls ("Granite walls", "Brick walls", "Rotted walls", "Walls not surveyed"), a moat ("Wide moat", "Narrow moat") and a tower size. Nothing in the world or the panel says what walls or a moat stand for.
10. **Feel:** the hero walks into and through the advisors. In the Royal Mint the camera ended up high above the room after a short walk north. The lever labels cannot be read at 800 px wide. Everything needs a keyboard (W A S D, E, Q, T, G, M, P, H, B), so a phone or tablet player cannot walk. → #480

## Scope

There are 7 places plus up to 18 holding lands, and about 15 kinds of thing to press E at in the courtyard alone (advisors, towers, desk, drill post, signpost, two booths, vault, Night Watch post, raven perch, Realm post, hourglass, seven Town building doors, the Market Quarter gate). Breadth has won over depth: the newest places shipped with "needs Faiz's eyes on a real GPU" still open (Royal Mint, Hourglass), and nobody has yet checked that a newcomer can follow the starter guide.

## Decisions (#476, answered by Faiz 2026-11-22)

Faiz answered the four questions in #476 on 2026-11-22. PR #NNN adds the answers here and to the skill `game-design-reward-knowing`.

| # | Question | Answer | What it means for the starter level (#477) |
|---|---|---|---|
| 1 | Reward knowing, not acting | **Yes** | A Book of Wisdom page, a banner on the practice tower and a short cheer when the player gets an idea right. Earned once per idea; no points, no streaks, no daily pull, nothing for trading. Written into `.claude/skills/game-design-reward-knowing/SKILL.md`. |
| 2 | A practice fortress | **Yes** | The starter is played in a made-up fortress (one made-up company, made-up numbers), labelled practice, never writes, never shown as real. Also written into the skill as the one exception to "every fact is real". |
| 3 | Original advisors | **No, keep the parody** | Barren Wuffet and Marlie Chunger stay, in the starter too. The starter must not lean on knowing who they parody: their lines teach the idea in plain words. |
| 4 | Freeze new places | **Yes** | No new places, rooms or levers in `/game3d` until the starter level ships. Expert places (Royal Mint, Weather Tower plates, Town Hall boards, Standing, the Round) stay for Faiz and are hidden from a newcomer until the starter is done. |

Still open, for the #477 spec: which invented names (list under "What a newcomer meets", item 7) to retire or hide until later. The spec proposes the list; Faiz picks.

## Decisions as challenged in the review (#476)

The table below is the review as written before Faiz answered; the answers are in the section above.

| Decision today | Challenge |
|---|---|
| No XP, no reward, no cheering (`guideQuests.ts`, `guideWordsV1.ts`) | **Right for trading, wrong for learning.** The game's own rule is "progress = understanding" (skill `game-design-reward-knowing`). Reward understanding: a page in a Book of Wisdom unlocked by getting an idea right in practice, a banner on the practice tower. Still no points, no streaks, no daily pull, nothing for trading. Today finishing a step gives almost nothing to see. |
| Every fact is real data | **Keep it for the real fortress, not for the starter.** First Steps steps 3 and 5 need a real watchlist row and a real journal entry; on the sample fortress they can never finish ("stalls and whys are not saved here"). A clearly labelled *practice fortress* with a made-up company is honest, and it is the only way a child or a person without a broker account can play. |
| Every flat page gets a place in 3D (the parity register) | **Drop it as a goal.** It produced the 22-item menu and places nobody new will understand. Freeze new places until the starter ships. |
| The Weather Tower is a starter step | **Move it out.** For a starter, weather is one picture: calm or stormy. |
| Barren Wuffet and Marlie Chunger | The joke only lands for adults who know Buffett and Munger, and it borrows real people's likeness. **Original characters** suit young players and age better. |

## Keep, improve, freeze

**Keep**
- **The tower metaphor:** tower size is how much you own, walls are how good the business is, the moat is the moat. It is the strongest idea in the game and "moat" is already child-friendly. It needs to be explained by touch (#477).
- Sal's plain-word shelves.
- The marks in the world (raven, smoke, bell): following signs in the world is real game design.
- The Hourglass replay.
- The Storm Drill idea ("what if prices fall 30%?") is a strong toy.
- The honesty rules: unknown stays fog, nothing says buy or sell.

**Improve (quick wins before the starter level)**
- A loading line (#479).
- One next step in the Quests panel while First Steps is open, an honest count, no yield curve in the starter (#478).
- Solid advisors, the Mint camera, readable lever labels, a plan for touch controls (#480).
- An arrow or edge marker toward the current quest mark when it is off screen (part of #477).
- Explain a word the first time you touch the thing it names (part of #477).

**Freeze, do not delete**
- No new places, rooms or levers until the starter level ships (#476).
- Expert places (Royal Mint, Weather Tower plates, Town Hall boards, Standing, the Round) stay for Faiz but are not shown to a newcomer until the starter is done.

## A real starter level (#477)

Played in a practice fortress, 10 to 15 minutes. Each beat is 2 presses or fewer, changes something you can see, and teaches **one** idea in one sentence.

| # | Beat | What changes in the world | Idea |
|---|---|---|---|
| 1 | Arrival: "Every tower here is a business you own a piece of. Let's build your first." | The goal line stays on screen | What the fortress is |
| 2 | Pick a company you know at Sal's (six familiar picks, or a made-up lemonade or ice-cream company) | A tower rises from its pad, with sound | A share is a piece of a real business |
| 3 | Knock on the walls: "Does it make money every year?" Flip three year-cards | The walls turn stone or brick | Profits |
| 4 | Fill the moat: "What stops others copying it?" Pick one of three | Water fills the moat | Competitive advantage |
| 5 | The price scale: what it is worth against what it costs ("buy a 10-coin thing for 7") | A balance tips | Margin of safety |
| 6 | The storm: prices fall 30%; choose "stay" or "run" | The tower shakes, the walls hold | A falling price is not a broken business |
| 7 | Write your why at the desk with fill-in chips ("I own it because... I'm wrong if...") | A sheet is pinned on the tower door | Writing it down keeps you honest |
| 8 | Reward | A banner goes up; five pages unlock in the Book of Wisdom; then "Bring your real fortress" or "Practise again" | Progress is understanding |

**Visual verb + scene:** *Build and test.* One empty pad in a sunny practice yard; by the end, a tower with walls, a moat, a banner and a pinned note.

**How we will know it works (a playtest question, not a metric):** after 10 minutes, can a 12-year-old explain a moat and a margin of safety in their own words?

**Rules it keeps:** nothing for trading, no streaks, no buy or sell wording, the practice fortress never writes and is always labelled practice, unknown stays fog in the real fortress.

## Suggested order

1. Decide #476 (Faiz). Answered 2026-11-22: yes, yes, keep the parody, yes.
2. Quick wins: #479 loading line, #478 Quests panel, #480 feel fixes.
3. Spec, then build, the starter level (#477) in steps, one PR each, each seen in a browser.
4. Cut or hide the invented names the starter does not need.
5. Then reopen the expert places.

## Not checked

Load time and frame rate (hidden pane), the phone, the demo stack, the deployed commit, the Siege Field and Market Quarter as they now are on `main`, the Hall of Records, the holding lands, and any young player's reaction.
