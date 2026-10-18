# Council: fewer clicks (2026-10-18)

Status: written and tested locally, not merged, not deployed, not seen in a browser.

## What Faiz hit
Council, Game mode: press "Ask the Oracle" on the room picture (it only scrolls down and says "Pick a tower first"), pick a tower, pick a question, then press "Ask the Oracle" again. Four taps and the same button twice for one answer.

## Why it got through
The game gates scored looks (identity, voice, words) and nothing scored interaction cost, and the lectern was reviewed from the diff and screenshots, never clicked through. Gate added: [game-sprint-checklist.md](game-sprint-checklist.md) A9 and B8, CLAUDE.md "Interaction cost", skill step 0.

## Change (`CouncilLectern.tsx`)
- A tower (first on the table: agenda-named, then biggest), the question "Why is this here?" and the Oracle are picked from the start; the answer is already on the table when the page opens (read-only `GET /game/council/ask`, no LLM, nothing saved).
- Tapping a tower, a question or a councillor re-asks at once. No Ask step, no "Pick a tower first" gate, nothing disabled.
- "Who answers" is a two-way choice (radio) with the speaker lit, not a second set of Ask buttons.
- A press on the Oracle or Partner in the room picture makes them the speaker and scrolls the answer into view: 1 tap.

## Taps (from the code and the screenshots, not yet measured in a browser)
| Task | Before | After |
|---|---|---|
| Hear the Oracle on the first tower | 4 (room button, tower, question, Ask) | 0 (already shown) |
| Same, from the room picture | 4 | 1 |
| Another tower, same question | 3 | 1 |
| Another question | 2 | 1 |
| Partner on the same thing | 1 | 1 |

## Not done
Look at it live with Game mode on, desktop and phone, after deploy. The room picture's two "Ask" buttons are unchanged.
