# 3D game: touch controls, a plan (2026-11-22)

Issue #480 (feel fixes), item 4: "Touch controls: a plan first, its own issue if bigger than this." This is that plan. Nothing here is built. Building it is issue #485.

## What is wrong today

`/game3d` needs a keyboard for everything: W A S D to walk, Shift to run, Space to jump, E to act, Q T G M P H B for panels and places, and the mouse to look around. A phone or tablet player can open the page, read the panels and tap the toolbar, but cannot walk, so cannot reach an advisor, a stall, a door or a lever. Every walk-up place is out of reach on touch.

## Visual verb + scene

*Push* a brass compass rose with your thumb to walk the hero across the courtyard; *tap* a wax-seal button to act on what you stand at.

## The choice

| | A. Stick and action button | B. Tap to walk |
|---|---|---|
| How | A thumb stick bottom-left walks; a round "E" seal bottom-right acts; dragging on the right half of the screen looks around | Tap the ground: the hero walks there; tap a thing to walk up to it and act |
| Fits the code | Yes: the stick writes the same `Keys` the keyboard writes (`useKeys.ts`), as an analog vector into `moveVector` (`movement.ts`). The action button calls the same action table the E key does (`near.ts`: "a prompt can never promise something E does not do") | No path finding exists. The hero would walk into stalls, advisors and walls on the way; it needs a nav grid or steering, and a "walk up and act" queue |
| Taps for the common case | Walk there (hold), 1 tap on E: the gate's target of 2 or fewer holds | 1 to 2 taps, when the path works |
| Risk | Low: input only, nothing new in the world | Medium to high: new movement logic, new failure cases (stuck on a corner) |
| Size | One PR | Two or three PRs |

**Recommendation: A.** It reuses everything the keyboard already drives, so the prompt, the E table and the solid-body physics (#480 made the hero collide reliably on slow frames, which phones are) stay the single source of truth. B can come later on top of A if players ask for it.

## Plan A in detail

- **When it shows:** only on a touch screen (`matchMedia("(pointer: coarse)")`), never on a desktop with a mouse. The keyboard keeps working everywhere.
- **Stick:** bottom-left, 96 px across, a brass compass rose (shared kit, owned by `game-feel-engineer`). Push past 85% of its radius to run, so Shift is not needed. Lets go: the hero stops (the same rule as a key release).
- **Action seal:** bottom-right, 64 px, shows the same words as the on-screen prompt ("Talk", "Read", "Pull"), and only while a prompt is shown. Hidden when there is nothing to act on, so it never promises an action E would not do.
- **Look:** drag on the right half of the scene turns the camera (the same orbit the mouse drives, `useOrbit.ts`); pinch zooms (the wheel's job).
- **Panels and places:** the toolbar already takes taps. "Back outside" and "Where to?" are already buttons. Jump is left out on touch at first (a third button can follow if a place turns out to need it).
- **Accessibility:** both controls 44 px or larger, labelled for screen readers ("Walk", and the action's own words), no motion beyond what the thumb does, colour-blind safe (shape and word, never colour alone). Reduced motion: nothing animates.
- **Phone performance:** no per-frame React state: the stick writes into the existing `keys` ref, as the keyboard does.

## Done when (for #485)

- A phone in a real browser can walk from the gate to Barren, talk to him, walk to Sal and open his counter, and enter the Weather Tower, with tap and hold counts written in the PR.
- The stick and the action seal never show on a desktop with a mouse.
- Playwright on the demo stack, with touch emulation, checks that the action seal appears at an advisor and opens the dialogue.
- The real look on a phone is Faiz's (After deploy).

## Not decided here

Whether touch play should wait for the starter level (#476, #477). This plan does not add a place, a lever or a reward, so it does not cut across the "freeze new places" proposal, but its priority against the starter level is Faiz's call.
