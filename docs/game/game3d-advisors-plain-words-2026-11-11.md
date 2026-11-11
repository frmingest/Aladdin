# The two advisors: side by side, in plain words (2026-11-11)

Status: **written and tested, in a PR, not deployed, not seen in a browser.** Frontend only: no backend, migration or prompt change.
Branch `feature/advisors-together-plain-words`. Checks run in `frontend/`: `tsc --noEmit` clean, `npm run lint` 0 errors, `npm test` 223 files / 2,003 tests passed, `npm run build` ok.

## What Faiz asked
1. Put Barren Wuffet close to Marlie Chunger.
2. Simplify and improve the language: it was not intuitive; involve a game designer and a UX designer.

## 1. Placement
Both now stand just inside the south gate, west of the road in, about 3.3 units apart (Marlie unchanged at -10.5, 25.5; Barren moved from the keep door to -7.4, 26.4). The first people you meet on the way in are the two advisors. The nearer one answers E; the prompt gets a second line, "Also here: <the other>". `npcs.test.ts` keeps them a pair (2 to 3.6 apart), checks E picks the nearer one, and the existing clearance tests (pads, desk, scenery, market, street, booths, townsfolk, signpost, siege field) all still pass.

## 2. Language (reviewed by the repo's game designer and UX designer roles)
What was wrong, in plain terms:
- **The task was never said.** "Still need words", "both lines", "wrong-if" and "missing line" all meant the same thing and none was explained.
- **The share was a bug, not a style.** The backend sends the share as a raw string, so Marlie read out `16.55923263615708780773615393%`.
- **"The desk by the keep door" gave no direction**, and only Barren said it. The desk is a long walk from the gate.
- **A dead-end button:** the only button was "Goodbye (E)".
- **The voices blurred:** Marlie's lines were taunts with no task in them ("Convenient.").

What changed (`dialogueV6.ts`, new file; v4 and v5 stay as shown):
| State | Before | After |
|---|---|---|
| Barren, 1 missing | "1 of your 7 holdings still need words: Orkla." | "One holding has no why yet: Orkla." |
| Barren, task | "Write why you own each one, and what would prove you wrong. Do it now, before the price has an opinion." | "A why is two short notes: why you own it, and what would prove you wrong." |
| Desk | "The desk by the keep door is waiting." | "Write them at the desk. It is straight on toward the keep, on your left." |
| Marlie, task | "No why on paper? Then nothing can prove you wrong. Convenient." | "Orkla: about 17% of your fortress. No why yet." |
| Marlie, next step | "Start with Orkla, 16.559...% of the fortress. Biggest tower with a missing line." | "Write two notes: why you own it, what proves you wrong. The desk is straight on toward the keep, on your left." |
| Close button | "Goodbye (E)" | "Got it (E)", or "Not now (E)" beside Bring in my holdings / Try again |

Shares are said as a person says them: 10% and up as a whole number, under 10% with one decimal, "about" whenever it was rounded, exact when already round ("40%"), "under 0.1%" for a sliver, and nothing when unknown. This only changes the display; the stored figure is untouched.
Also: the dialogue panel is 92% wide on phones (was 55%). Counts, names and confidence numbers still come straight from the data. No buy or sell wording, no cheering, unknown stays unknown (a test covers each). `dialogueV6.test.ts` ties the desk words to the real coordinates: if the desk or the advisors move, the test fails until the words are updated.

## Decisions for Faiz
1. **Go to the desk.** Both reviews want help getting from the gate to the desk. Walking is how you reach the Town Hall (you chose that over a teleport), so I only added words. Options: a lit marker on the desk while a why is missing (no new control), or a "Take me to the desk" button that closes the panel and walks or teleports you. My lean: the marker.
2. **Share format.** "about 17%" instead of the exact figure. Tell me if you want one decimal everywhere.
3. **Name words.** The lines say "holding" like the Quest log and the flat app, not "tower", because the holdings now stand outside as buildings.

## Not covered
Other advisor surfaces (the Library Council shelf, Quest log text) keep their current words. Not seen in a browser: reach, how the pair reads from the gate, whether the figures overlap in motion. Deploy not checked.
