# 3D town review: every building outside the gate, opened and judged (2026-11-24)

Issue #501. Status: **a review, no code changed.** Follow-ups: #502 (bug sweep), #503 (one building, one idea), and comments on #494 and #497.

Faiz asked for an honest review of the town outside the gate in `/game3d`: walk into every building, look at the objects inside, say whether they make sense to a young player who is not an economist, and propose what to improve, scrap or add, ranked against the work already on the board. This follows the whole-game review of 2026-11-22 (`docs/game/game3d-review-starter-level-2026-11-22.md`, #475), which did not look at the Hall of Records, the Market Quarter or the Town's flat-page doors.

## How it was reviewed

- **Live site, read-only:** the built-in browser on Faiz's computer, signed in on his real data (no names or amounts copied here). The four rooms were entered by their `?at=` links (`townhall`, `records`, `weather`, `mint`) and the Market Quarter by `?at=quarter`; the Archive, Cartographer and Workshop by "Where to?", which opens the same page their doors open (`doorAction` in `frontend/src/game3d/townPlan.ts`). Walked the town road between them after leaving the Mint. No button that saves anything was pressed.
- **Code:** `townPlan.ts` (the seven buildings), `TownHallRoom.tsx`, `RecordsHallRoom.tsx` and `recordsHallRoomLogic.ts`.
- **Not done:** the browser pane was **hidden** the whole time, so the 10 to 18 seconds each place took to load mean nothing. Not seen on a phone. A Mint lever was not pulled (the camera turned while walking). Which commit is deployed was not checked. No young player has tried it.

## Verdict

| | Score |
|---|---|
| Inviting from the road | 6/10 |
| Fun once inside | 2/10 |
| Understandable without economics | 1/10 |

The town is scenery with doors to app pages. From the road it is charming; behind most doors is a flat page of the main app or a room where nothing can be done, and one room hides its own content.

## Building by building

Identity score as in `.claude/standards/game-visual-identity.md` (0 to 3), for what a player meets in the world.

| Building | What is inside | Does it make sense? | Score |
|---|---|---|---|
| **Hall of Records** | Three bookcases that look empty, under a plate counting the decisions on the shelves | **Bug (#502):** each book stands inside the solid bookcase box. The case is centred at `BOOKCASE.z - 0.05` with depth 0.7 (front about -7.20); a book is centred at `BOOKCASE.z + 0.05` with depth 0.34 (front about -7.28). Books, seals and ribbons are all behind the case front (`recordsHallRoomLogic.ts:72`, `RecordsHallRoom.tsx:90`). The idea is good: one same-size book per decision, review seals told by shape. | 1 (2 to 3 once fixed) |
| **Town Hall** | An empty hall with a row of pale blue panels that read as windows; a board's words show only when close (full size within about 12 m, fading out by about 18 m, `labelPlan.ts`). E opens a flat page: the Wide Weather board opens "Macro", with series codes such as `IR/B.KPRA.SD.R` and changes in "pp" | No. Outside it is the market-stall model, not a hall; inside it is the app's menu on the walls. | 1 |
| **Weather Tower** | The Norway curve as posts (a real number shown as height, good), and about 20 dashboard plates (one per stored series, `WeatherTowerRoom.tsx`) in small text on the walls. The line under the curve is hidden behind the post labels | No weather in it: no sky, sun or storm. | 1 |
| **Royal Mint** | Five levers (Toll Gate, Great Press, Great Melt, Coin Rain, Harbour Guard), a STAMP press and a "Look ahead" post in a bare room | A real toy, but every lever name is a second thing to learn, and nothing visible comes out of the press. Labels at the top run into the toolbar. Leaving puts the hero wedged between a fence and the back of a building. | 2 |
| **Archive** | The flat glossary, with the Codex ("terms appear on your realm", plates unlock once per browser) | Good writing, adult wording (DCF, "Strong Buy through Avoid"). The Codex is already the Book of Wisdom idea (#494). | 0 in the world |
| **Cartographer** | The flat Cartographer's table: a parchment map with fog | The best art in the game, but not in the world. Same watchtower model as the Weather Tower. | 1 |
| **Workshop** | Admin pages: Report line, System status, Settings, Label check (tag review with "Use this tag" buttons that save rules) | No. Admin tools that write do not belong in the game world. | 0 |
| **Market Quarter** | A street of stalls under awnings, banners at the gate | The best outdoor scene, but nobody sells anything: the tables are empty, a few goods sit beside them (`quarterPlan.ts`), and there are no sellers. "Closest to your price first." is jargon, and that sign stands in the road and blocks walking. No "← Back outside" button, unlike the four rooms. | 2 |

**Across the town:** signs stand on two posts over a concrete slab and read as estate-agent boards; two pairs of buildings share a model (Cartographer and Weather Tower, Hall of Records and Royal Mint); "Archive" and "Hall of Records" are two archive-sounding buildings with nothing to tell them apart; there are no townsfolk in the town.

## Scrap, improve, add

**Scrap**
- The Workshop as a game building, and its four admin rows in "Where to?". They stay in the Menu. (Faiz's call, raised on #497.)

**Improve (bug sweep, #502; fixes to existing places, so the freeze in #476 allows them)**
- Books in front of the bookcases, with a test.
- Town Hall board titles painted on the board face.
- Market sign out of the road; "Back outside" in the Market Quarter.
- Mint exit on open ground facing the road.
- Weather Tower labels that do not overlap.

**Add (after the starter level ships, #503)**
- Each building its own silhouette, and its sign hung on the building with an icon.
- One thing to do by touch per room: pull a book off a shelf, a real sky over the Weather Tower, coins out of the Mint, goods and sellers on the stalls.
- The Cartographer's map as a table you walk up to.
- Townsfolk in the town.
- Faiz's calls: rename or merge Archive and Hall of Records; one book or two for the Codex and the Book of Wisdom.

## Ranked against the board

| Rank | Work | Priority | Why |
|---|---|---|---|
| 1 | #494 starter build 2 (walls, moat, Book of Wisdom) | keep top | Unchanged scope; question added on one book or two (comment on #494, tracked in #503) |
| 2 | #502 town bug sweep | P0, small | Fixes, not new places; the hidden books are a real data-display bug |
| 3 | #485 touch controls | P1 | Unchanged |
| 4 | #495, #496, #497 starter builds 3 to 5 | P1 | #497: spec section 7's door rule covers only the Mint, Weather Tower and Town Hall (it also hides their "Where to?" rows, the Standing Quests card and today's round's Quests card and chip count); Hall of Records, Market Quarter, Workshop and Archive have no door rule yet (comment on #497) |
| 5 | #498 one-shot sound cues | P2 | Unchanged |
| 6 | #503 one building, one idea | P2 | Waits for the freeze to lift after the starter ships |
| — | #395 store interior | park | Another new place, which the freeze rules out |

## Not checked

Load time and frame rate (hidden pane), the phone, a Mint lever pull, the deployed commit, the holding lands and the Siege Field, and any young player's reaction.
