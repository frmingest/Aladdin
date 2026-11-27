# 3D game: touch controls, a plan (2026-11-22)

Issue #480 (feel fixes), item 4: "Touch controls: a plan first, its own issue if bigger than this." This is that plan. The build is issue #485: see "Build" at the end.

## What is wrong today

`/game3d` needs a keyboard for everything: W A S D to walk, Shift to run, Space to jump, E to act, Q T G M P H B for panels and places, and the mouse to look around. A phone or tablet player can open the page, read the panels and tap the toolbar, but cannot walk, so cannot reach an advisor, a stall, a door or a lever. Every walk-up place is out of reach on touch.

## Visual verb + scene

*Push* a brass compass rose with your thumb to walk the hero across the courtyard; *tap* the wax seal, which reads the prompt's own word ("Talk", "Read", "Pull"), to act. No prompt, no seal.

- **Unknown state:** none of its own. The seal never shows a guess: it appears only when the on-screen prompt does, with the prompt's word.
- **Identity score:** the controls are HUD, not a page; `/game3d` stays at its current score (2) before and after. The compass rose and seal come from the shared kit, so they add game look, not a re-skinned button bar.

## The choice

| | A. Stick and action seal | B. Tap to walk |
|---|---|---|
| How | A thumb stick (bottom-left by default) walks; a round wax seal (bottom-right) with the prompt's word acts; dragging on the open scene looks around | Tap the ground: the hero walks there; tap a thing to walk up to it and act |
| Fits the code | Yes, with two small changes. The stick writes the same `keys` ref the keyboard writes (`frontend/src/game3d/useKeys.ts`); `moveVector` (`frontend/src/game3d/movement.ts`) takes on/off keys today, so it needs an analog stick vector added. The seal calls the same action table the E key uses (the `acts` table in `frontend/src/pages/Game3DPage.tsx`, run by its E handler), and `frontend/src/game3d/near.ts` keeps its rule that a prompt can never promise something E does not do. `useOrbit.ts` handles mouse and wheel only, so touch look and pinch are new there | No path finding exists. The hero would walk into stalls, advisors and walls on the way; it needs a nav grid or steering, and a "walk up and act" queue |
| Taps for the common case | Walk there (hold), 1 tap on the seal. A Mint lever round is Pull, then STAMP: 2 taps. The gate's target of 2 or fewer holds | 1 to 2 taps, when the path works |
| Risk | Low: input only, nothing new in the world | Medium to high: new movement logic, new failure cases (stuck on a corner) |
| Size | One PR | Two or three PRs |

**Recommendation: A.** It reuses what the keyboard already drives, so the prompt, the E table and the solid-body physics (#480 turned on CCD so the hero stops at solids on slow frames, which phones have; checked headless) stay the single source of truth. Tap-to-walk would leave a young newcomer stuck on corners without path finding. B can come later on top of A if players ask for it.

## Plan A in detail

- **When it shows:** only on a touch screen (`matchMedia("(pointer: coarse)")`), never on a desktop with a mouse. The keyboard keeps working everywhere.
- **Stick:** a brass compass rose (shared kit, owned by `game-feel-engineer`), 96 px across. It floats: it appears where the thumb first lands in the bottom-left zone, so it suits small and large hands. Push past 85% of its radius to run, so Shift is not needed. Lift the thumb: the hero stops (the same rule as a key release). Left-handed: a setting swaps the stick and seal sides.
- **Action seal:** 64 px, shows the prompt's word only (no "E": it means nothing on a phone), and only while the prompt is shown, using the same arrive and leave distances as the prompt so it does not flicker at the edge. Hidden while a panel or dialogue is open.
- **Look:** dragging on the open scene (not on the stick, the seal or the toolbar) turns the camera; pinch zooms (the wheel's job). Both are new in `frontend/src/game3d/useOrbit.ts`.
- **Who takes a touch:** the seal and the toolbar take their own taps first; the stick takes the touch that started on it; the scene gets the rest. Stick and look can run at once (two thumbs); a pinch never moves the stick. The canvas stops the browser's own pinch-zoom and scroll (`touch-action: none`).
- **Screen edges:** the stick and seal keep clear of the notch and home bar (`env(safe-area-inset-*)`), in portrait and landscape.
- **Words on screen:** the keyboard hint line ("W A S D walk · Shift run ...") is replaced on touch by a short touch line ("Push to walk · Tap the seal to act"; the built words differ, see "Build"). The toolbar chips (Quests, Towers, Where to?, Sound; Stats shows only with `?debug`) grow to 44 px tap targets on touch.
- **Panels and places:** the toolbar already takes taps. "Back outside" and "Where to?" are already buttons. Jump is left out on touch at first (a third button can follow if a place turns out to need it).
- **Accessibility:** both controls 44 px or larger, labelled for screen readers ("Walk", and the action's own word), no motion beyond what the thumb does, colour-blind safe (shape and word, never colour alone). Reduced motion: nothing animates.
- **Phone performance:** no per-frame React state: the stick writes into the existing `keys` ref, as the keyboard does.

## Done when (for #485)

- A phone in a real browser can walk from the gate to Barren, talk to him, walk to Sal and open his counter, and walk to the desk (the starter route, not an expert place such as the Weather Tower), with tap and hold counts written in the PR.
- The stick and the seal never show on a desktop with a mouse.
- Playwright on the demo stack, with touch emulation, checks that the seal appears at an advisor with the prompt's word and opens the dialogue, and that it hides when the prompt does.
- Reduced motion and a screen-reader pass (the stick's and seal's names) are written in the PR.
- The real look on a phone is Faiz's (After deploy).

## Not decided here

Whether touch play should wait for the starter level (#476, #477). This plan does not add a place, a lever or a reward, so it does not cut across the "freeze new places" proposal, but its order against the starter level is Faiz's call; #485 should serve the route #477 will use.

## Build (#485, 2026-11-27)

The #485 PR builds plan A. Written, PR to open, not deployed. What it does, checked against the code in that PR:

- **Where (all under `frontend/src/`):** `game3d/TouchControls.tsx` (stick and seal), `game3d/touchInput.ts` (pure maths: stick vector, dead zone 12%, run past 85%, seal word, pinch, hand setting), `game3d/useTouchScreen.ts` (`(pointer: coarse)`), `game3d/touchWordsV1.ts` (the touch hint and names), `game3d/useOrbit.ts` (one-finger look, two-finger pinch, no pointer-lock request after a touch), `game3d/movement.ts` (`moveVector` takes the stick's analog push), kit art `components/fortress/kit/TouchControlsArt.tsx` (compass rose, knob, wax seal; colours in `TOUCH_TOKENS`, `game3d/gameTokens.ts`).
- **One deviation from the plan:** the stick writes one shared stick value (`touchStick` in `game3d/touchInput.ts`) that the hero reads every frame beside the keyboard's `keys` ref, rather than the `keys` ref itself, because the keys are on/off and the stick is analog (a half push walks at half speed). Still no React state per frame.
- **The prompt on touch** is a plain plate with the words only (no key cap, no button), so the seal is the one control for the action: no control appears twice on one screen.
- **Hidden** while any panel, card, plate or the talk is open (the hint line's panel and talk rule; no first-visits or mouse-lock check), and the seal shows only while the prompt names an E action and E is not blocked.
- **Toolbar on a touch phone:** chips stack their icon over a small name so the toolbar fits (measured in an ad hoc local run, not a committed check: on `main` it is 441 px wide on a 375 px phone, and with the new chip but before the stacked chips 489 px on a 390 px touch phone; 333 px after), each at least 44 px; key letters hidden. A "Swap hands" chip shows on touch only.
- **Starter route by emulated touch**, an ad hoc local run, not a committed check (the PR's `frontend/e2e/regression/touch.spec.ts` covers the stick, Barren and the seal; headless Chromium, `hasTouch` + `isMobile`, 390 x 844, API stubbed, software WebGL; headless only): gate to Barren 1 hold + 1 tap (Talk), close the talk 1 tap, Barren to Sal 1 hold + 1 tap (Talk: open a new stall), close Sal's card 1 tap, Sal to the desk 1 hold + 1 tap (Write). Total 3 holds and 5 taps; each place is one hold and one tap. The real look on a phone is Faiz's.
- **Practice yard by emulated touch** (same local run, `?at=practice`): Sal's card opens by itself; closing it is 1 tap, walking to the counter 1 hold, and the seal "Open" brings the card back (1 tap). The lectern: 1 hold, seal "Read" opens the Book (1 tap). The gate: 1 hold, seal "Leave". The stick is hidden while a card or a plate is up, so the yard leads.
- **The seal's word:** the first word of an E prompt, three shapes ("Press E to talk...", "Press E at the shelves to read...", "Press E: look 3 years ahead"); a verb with "back" keeps it ("Head back"). Unit-tested in `frontend/src/game3d/touchInput.test.ts`.
- **Sideways phone:** on a touch screen the 3D view's floor is 160 px (480 px with a mouse), so the stick and the seal stay on a 390 px tall screen; held sideways the prompt and hint stay low, between the two controls.
- **Identity:** `/game3d` 2 before and 2 after, as judged by the game-ux-designer review of the #485 PR (the controls are HUD).
- **Open for Faiz:** whether the controls should stay up under the Quest log and Towers panels (built: hidden under every panel), whether "Swap hands" stays a toolbar chip, and the real look on a phone.
