# 3D macro room: design note (2026-11-08)

Status: **approved by Faiz 2026-11-08** (name: The Weather Tower; door next to the Town Hall; the longer Norway curve comes in the first build). Built in [game3d-weather-tower-2026-11-08.md](game3d-weather-tower-2026-11-08.md). Item: "Hall of Records (idea, Faiz 2026-11-06)" in [remaining-work](../sprints/remaining-work-2026-11-06.md). Checked against `backend/app/domain/macro_series.py` and `frontend/src/game3d/` on 2026-11-08.

## What this step is for (plain words)

Decide what the new place is called, what it shows and how it relates to the rooms we already have, before anyone builds it.

## 1. The name: "Hall of Records" is already taken

The Hall of Records already exists, in both modes. It is the journal and time-capsule building: flat page `/fortress/records`, 3D area id `records` (`areaWordsV1.ts`), the room in `RecordsHallRoom.tsx`, and the C2 hit-rate ledger. So the rate room cannot reuse the name, and the "Records Hall that PROGRESS listed as next" is that finished room, not something to wait for.

Names also taken: Town Hall, The Wide Weather (the Macro board in the Town Hall), Royal Mint (The Printer), Vault, Night Watch, Oracle, Siege Field, Market Quarter.

| Option | Why it fits | Watch out |
|---|---|---|
| **The Weather Tower** (chosen) | Continues "The Wide Weather" board: the board is today's headline, the tower is where you climb up and read the instruments | The 3D sky already has a weather lamp for the portfolio's mood; the tower's words must say it shows the economy's weather, not yours |
| The Gauge House | Neutral, says "dials" straight away | Less story |
| The Tide Clock | Rates as tides | The Printer already uses Tide for something else |
| The Rate Observatory | Clear | Sounds like a lab, not a game |

## 2. What it shows

The room reads the same stored data the Macro page and the Town Hall board already read (`GET /macro/indicators`, cache key `macro-indicators`). One instrument per series, drawn from the catalogue, not hand-placed, so a new series in the catalogue becomes a new instrument.

Catalogue v2 had **13 fetched series and 4 computed ones**. Decision 3 adds five Norway curve points (catalogue **v3**: 18 fetched, 4 computed).

| Side | Instrument group | Series (publisher) |
|---|---|---|
| Norway | Rates | Policy rate, NOWA overnight, 3-month and 6-month and 12-month T-bills, 3-, 5-, 7- and 10-year bonds (all Norges Bank, daily; the 6M, 12M, 3Y, 5Y, 7Y are new in v3) |
| Norway | Inflation | CPI 12-month change (SSB table 14710, monthly) |
| Norway | Krone | USD/NOK, EUR/NOK (Norges Bank, daily) |
| United States | Rates | Fed funds upper bound, 10-year Treasury, yield curve 10y minus 2y (FRED, daily) |
| United States | Inflation and jobs | CPI 12-month change, unemployment rate (FRED, monthly) |
| United States | Credit | High-yield spread (FRED, daily) |
| Computed (north wall) | Gaps | Norway real policy rate, US real policy rate, Norway minus US 10-year, Norway curve 10y minus 3m |

Every instrument shows what the Macro page shows: latest value, as-of date, the 3- and 12-month change, the 24 months of history, and `stale` when the series is old. Same formatting code as the flat page (`lib/format.ts`); no number is made up in the room.

Also fed by these series, so shown as context rather than separate dials: the regime reading (baseline, stagflation or crisis) from the portfolio risk page, and the CPI used for real returns.

**Not stored, so not shown (honest gaps):** NIBOR (Norges Bank does not publish it), any Norwegian credit spread (no free source found), money supply M2 (the Printer plan notes it is missing).

## 3. How it relates to the other rooms

- **The Wide Weather board (Town Hall):** stays as it is, the quick headline and the door to the flat `/macro` page. The tower is the depth. Nothing is removed, so the flat/3D parity rule stays met.
- **Hall of Records:** no data link. Kept separate. Only the name was the problem.
- **The Printer (Royal Mint):** its levers move these same series. Later, the tower can show where a lever would push a dial; not v1.
- **Rate sensitivity per holding** (open item, no code yet): the natural next growth slot, "which of your holdings feel this dial". Not v1.

## 4. Visual verb and scene

**Read.** You walk a ring of brass instruments inside the tower. Each dial is one real series; the needle and the paper-roll trace under it come from stored data. Norway on one side, the United States on the other, the computed gaps on the north wall, and a rail of posts down the middle for Norway's own curve.

The art carries no fact: the instruments are plain objects, and code decides every needle, trace, post height and `stale` tag, then draws it on top. State is told by shape and by a word, never only by red or green; no buy, sell or good/bad words. A series with no reading shows an empty dial, never a placeholder number.

## 5. Identity score (target 3)

Scene (a brass tower room, not a card with a list) + shared instrument kit across all dials + one real fact per dial encoded visually (needle and trace) and the curve as post heights + the Plain view is the flat `/macro` page. Scores 3 on paper; re-score with screenshots after the first look.

## 6. Decisions (Faiz, 2026-11-08)

1. Name: **The Weather Tower**.
2. Door: next to the Town Hall.
3. The longer Norway curve (catalogue v3): in the first build.
