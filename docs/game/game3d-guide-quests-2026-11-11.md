# 3D game: First Steps, a five-quest guide (2026-11-11)

**Status: written and tested, in a PR, not deployed, not seen in a browser.** Frontend only: no backend, migration or prompt change.
Branch `feature/game3d-guide-quests`. Checks run in `frontend/`: `tsc --noEmit` clean, `npm run lint` 0 errors (3 old warnings), `npm test` 225 files / 2,019 tests passed, `npm run build` ok.
Proposal: Claude project doc `claude/game3d-quest-ladder-proposal-2026-11-11.md` (Faiz approved it with "go").

## What this is for (plain words)

A new player used to walk in and hear about writing a "why" for every holding. Now the first minutes are five small quests. Each is a short walk and one action, and each points at the next person or place. A small teal diamond floats over whoever hands the next one over, and later over the place it leads to.

## The five quests

| Lvl | Quest | Mark over | Done when |
|---|---|---|---|
| 1 | Meet the advisors | Barren and Marlie (each until met) | you talk to both |
| 2 | Visit Sal's counter | Barren, then Sal's counter | you open Sal's counter |
| 3 | Stock a stall | Sal | a stall exists (you picked a company off Sal's shelves) |
| 4 | See the weather | Marlie, then the Weather Tower door | you walk into the Weather Tower |
| 5 | Write your first why | Barren, then the desk | one holding has a why in the journal |

"Level" is only how many of the five are done in a row. No XP, no reward, no cheering, no buy or sell wording. After level 5 the old quests (Write Your Whys, Look-back, Storm Drill) carry on as before.

## How it works

- **Handing a step over:** talking to the giver hands it over. The second advisor you meet can finish step 1 and hand over step 2 in the same talk. The other advisor says who has the job ("Barren has a job for you").
- **Real facts:** steps 3 and 5 read the watchlist and the journal. While those cannot be read, or on the sample fortress, they stay open (unknown stays unknown).
- **Saved, in this browser only:** the "you went there" facts (who you met, Sal visited, tower visited) and which steps were handed over. Key `aladdin.game3d.guide.v1`. If storage is blocked the guide just does not remember.
- **Replay:** the Quest log card has "Start the guide again". It keeps what is on the street and in the journal and asks for one more of each, so someone with data can walk it again.
- **Quest log (Q):** a new first card, "First Steps: N of 5 done", the five steps, the open step's goal and where to go.
- **Marks:** teal diamond, still with reduced motion. Colour is not the only signal (the diamond shape is).
- **Words:** `guideWordsV1.ts` (new version file); `dialogueV7.ts` speaks the Guide first and falls back to `dialogueV6` unchanged. Step 5 uses the advisors' existing "why" lines, which already say what a why is and where the desk is.

## What changed

- New: `guideQuests.ts` (steps, levels, saving, mark spots), `guideWordsV1.ts`, `dialogueV7.ts`, `QuestMarks.tsx`, tests `guideQuests.test.ts`, `dialogueV7.test.ts`.
- Changed: `DialoguePanel.tsx` (reads v7, a `guide` snapshot; only the close button shows while the Guide speaks), `QuestLog.tsx` (the card), `Scene.tsx` (`questMarks` prop), `pages/Game3DPage.tsx` (state, facts, hooks into E at an advisor, Sal's counter, the Weather Tower).

## Differences from the proposal

- **No "Take it / Not now" buttons.** Talking to the giver is taking the quest; the existing "Got it (E)" closes the talk.
- **No glowing trail on arrival.** The advisors stand just inside the gate, so both get a mark over their head instead.
- **Level 5 needs at least one real holding**, because the desk writes a why for a holding. A company that only has a stall does not count.

## Not checked

- Not seen in a browser: how the diamond reads from the gate, whether the Weather Tower mark (floating high, scaled up) is visible from far, whether it clips Sal's roof. Heights are `y` values in `guideQuests.ts`.
- Not walked end to end by a person. The logic is covered by unit tests; the page wiring is covered by `tsc` and the build only.
- Frame rate: up to two small unlit meshes at a time.

## For Faiz after deploy

Open `/game3d` and press Q: the First Steps card shows. Your data already satisfies steps 3 and 5, so you would walk 1, 2 and 4. Press "Start the guide again" to walk all five (you need to add one stall and one why). Tell me if a mark is hard to see or in the way.

## Git commit description

`3D game: First Steps guide, five easy quests (meet the advisors, visit Sal, stock a stall, see the weather, first why) with quest marks over givers and places, dialogue v7, Quest log card, replay`
