# 3D courtyard prototype (week 1) — 2026-10-30

Status: written and tested, not merged, not deployed, **not yet seen in a browser** (the built-in
browser cannot reach a dev server started from the shell). Branch `feature/game3d-prototype`.

## Why
Faiz wants the Fortress as a real 3D game that feels like World of Warcraft: free walking with
the keyboard, desktop only, a place with characters and quests. Assessment and decisions:
Claude project doc `claude/3d-game-feasibility-2026-10-30.md`. Verdict: a walkable single-player
hub is feasible; an MMO is not. Multiplayer is out (real holdings must stay private).

## What week 1 built
- Route `/game3d` (lazy chunk, so the rest of the app downloads nothing extra; main bundle unchanged at about 258 kB).
- A walled courtyard: meadow, cobbles, curtain wall with a south gate, four corner towers, a keep,
  eight empty pads where week 2 raises one tower per holding. Plain shapes that are also the colliders.
- A stand-in hero (capsule body) you walk with W A S D or the arrows, Shift to run, Space to jump.
  Click the scene to capture the mouse and look round (Esc frees it; dragging works if the browser
  refuses capture). Wheel zooms. Camera follows behind and above.
- F3 shows frames per second, draw calls and triangles (for the week 4 go/no-go measure).
- No WebGL, or a crash in the scene: a plain card with a link to the flat Fortress.
- Lighting is flat and the same everywhere on purpose: nothing may flatter a weak holding (week 2 rule).

## Stack (pinned for React 18)
three 0.170, @react-three/fiber 8.18 (v9 needs React 19), @react-three/drei 9.122 (installed, not used yet),
@react-three/rapier 1.5, @types/three 0.170. Code lives in `frontend/src/game3d/`, page in `pages/Game3DPage.tsx`.

## Tests
`movement.test.ts` (keys to direction, camera limits, turning), `layout.test.ts` (gate, wall ring,
tower spots), `Game3DPage.test.tsx` (no-WebGL fallback). Typecheck and ESLint clean; `vite build` ok.

## To look at (Faiz)
Run the frontend, open `/game3d`: can you walk through the gate, round the keep and between the pads;
do the walls stop you; does the camera feel right; press F3 and note the frame rate.

## Next (week 2)
`stateToWorld()`: one pure function that turns `/game/state` into tower, wall, moat and fog values for
the eight pads, with tests that a weak holding always looks weak and unknown data is fog.
Known gaps: camera does not yet avoid clipping into walls; stand-in hero; no sound.
