# 3D Royal Mint: the Printer as a room with a lever wall (2026-11-15)

Status: **plan and first build on `feature/royal-mint-room`. Not merged, not deployed, not seen in a browser.** Issue #413 (order 3 of 4 from the 3D review of 2026-11-14). Scope chosen by Faiz in chat on 2026-11-15: **build the whole room now, with an honest fallback** where the backend gives no amount.

## What a sprint is for (plain words)

Give the Printer (its engine and API are finished, nothing on screen uses them) a place in the 3D town: walk into the Royal Mint, pull a lever, stamp, and read on the wall what it would do to each of your holdings. It is the first place that exists only in the world, not as a copy of a flat page.

**Visual verb + scene:** *Stamp.* A brass lever wall and a coin press in a stone room; the wall opposite fills with one plate per holding.

## What you will see

- **A new building on the east lawn beside the Town road** ("Royal Mint"). Press E at its door to go in; the door inside walks you back out.
- **The lever wall** (north): one brass lever for each lever the backend lists (today five: Toll Gate, Great Press, Great Melt, Coin Rain, Harbour Guard). Walk up and press E to move it one notch; each press goes to the next size (per variant), and after the last it springs back to off. The board above it says the name and the notch in words.
- **The span post:** press E to switch the look-ahead between 1 year and 3 years (default 1).
- **The press:** press E to STAMP. The room asks the backend (`GET /game/printer`) with the pulled levers and the span.
- **The result wall** (east and west): one plate per holding with a direction word and, **only where the backend says it may (`show_amount`, today the Toll Gate at 1 year), a NOK range**, plain and after inflation side by side, and the reason in a few words. Everything else shows the direction and the reason. A holding the engine cannot model says why. A portfolio plate gives the whole book the same way.
- **The temperament gauge:** a needle in the room that leans toward "restless" when the backend flags a wild pull (3 or more levers, or a very big one). It lives only in the room and is not saved.
- Banner on the north wall: "Scenario, not forecast." (the backend's own banner replaces it once a result is in). Old answers wear an "Old answer" board under each plate.
- **The lectern ("Ledger"):** press E for the same results as plain words, built from the same functions as the plates so it cannot say more than the wall.

## Rules this follows

- **Every number comes from the backend.** The room only places and prints values the API returned (through `lib/format.ts`); it prints no figure of its own (CLAUDE.md Rule 1). Notch sizes are quarter, half and full of the ledger's limits (inputs, not shown results), and the lever arm angle is a picture of the notch. Notch sizes are inputs sent to the backend, taken from the ledger's own min and max.
- **No amount without permission:** a plate shows a NOK range only when `show_amount` is true. Low confidence stays direction only.
- **Nothing is saved.** No write, no change to your real ratings, walls or portfolio.
- **Direction is a word and a shape, never colour alone.** Reduced motion: the lever and needle jump to their place.
- **No buy or sell wording.**

## Decisions worth knowing

1. **Temperament nudge is room-only.** The real temperament meter is computed from your journal and the backend has no way for a game pull to change it. Changing that would mean a new backend rule; if you want it, it is a separate issue. Decision 4 of the Printer plan is met as "a wild pull moves a needle and shows a warning line".
2. **Few NOK ranges, on purpose.** After P1.5 only the Toll Gate at 1 year can give a NOK range (see the [P1.5 doc](printer-p15-measured-sensitivities-2026-11-15.md)). Sourcing the other lever cells is its own issue, #430.
3. **Where it stands:** (28, 72), clear of the Weather Tower and Records step-out spots. (0, 98) was tried first and collided with them.

## Stitch pictures

**None block this build.** The room is built from code shapes and canvas plates like the Weather Tower. The 12 pictures from 2026-10-20 are not in the repo yet (see the [Printer plan](the-printer-sprint-plan-2026-10-20.md), section 5). Two would lift this room when you have them, described in plain words: (1) **the Mint crest**, a round gold medal with a coin press seen from the side, for the sign over the door; (2) **the Mint Master**, a kindly old coin-maker with round spectacles and a cloth cap, for a later advisor line. Everything else stays code-drawn.

## Game checklist

- **Pages touched:** one new place (Royal Mint), the Town (one building), the parity register (the "planned" Printer row becomes a real door), Game3DPage and Scene (wiring).
- **Identity:** the Mint is new; 3 on paper (scene, lever kit, a fact in each plate and the needle, Plain view = a side panel at the lectern (E) with the same words as the plates). Seen in a real browser on the demo stack on 2026-11-15; not yet seen by Faiz. Re-score from his screenshots.
- **Taps:** common task "see what a lever does to my book": walk in, E on a lever, E on the press = 2 presses.
- **Cut line:** if it runs long, the needle and the span post go before the plain direction fallback.

## What changed while building (2026-11-15)
- The wall holds **6** levers, not 8 (8 put the outer ones outside the room). Spawn is z=4 so the hero starts clear of the door.
- Click-through on the demo stack (written, not deployed): the Toll Gate lever prompt appears and E tilts the lever and updates its board; STAMP sent `pull=toll_gate:-3:default&horizon=1`; the east wall filled with plates (direction only, plus the backend's reason, or "Not modelled"); the lectern opens the plain panel; the span post toggles 1/3 years.
- Only Toll Gate at 1 year shows a NOK range today (backend `show_amount`). Other levers show direction and reason; sourcing them is issue #430.

## What the player learns, and what is open
- After a stamp the player learns which way each holding leans and why; unknown stays "Not modelled" and a moved lever marks the old answer. Nothing rewards pulling levers or coming back.
- Game-voice labels: Toll Gate, Great Press, Great Melt, Coin Rain, Harbour Guard, STAMP, Ledger, Old answer, Not modelled, Direction only.
- **Open (needs Faiz's eyes on a real GPU, desktop and phone):** the default camera shows the east wall only partly from the press, so the result wall is not in view at stamp time (a follow-up issue tracks framing it); plate legibility; phone profile; walking into lever bases (no colliders yet).
- Performance: the plate texture is drawn once per result; the Old-answer tab is a separate board so a lever pull redraws nothing. Not measured on a phone yet.
