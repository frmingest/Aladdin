# 3D courtyard S13: page doors, "Where to?" and Plain view (2026-11-01)

**Status: written, not committed as a PR, not merged, not deployed.** Branch `feature/game3d-parity-layer` (built on top of the S9 branch, so S9's commit is underneath). Seen only as test output; no browser picture yet.

## What a sprint is for (plain words)

Faiz's rule: every page of the normal Game mode must be reachable from the 3D game. Before this sprint most flat pages had no way in. S13 gives every built page a door, with no new art, and adds a test so a future page cannot be forgotten.

## What you can do now

- Walk to the new **signpost** just inside the gate (a few steps from where you arrive) and press **E**, or press **G** anywhere, or press the **Where to?** button at the top. A menu lists the places; pick one and the page opens in a panel right in the world. Two taps.
- The panel is the flat page itself (loaded with `?embed=world`, no sidebar), so every number comes from the same code as the flat page. **Open the flat page** goes to the full app; **← Where to?** goes back to the menu.
- The top-left link now reads **← Plain view** (it already opened the flat Fortress).

## Files

- `game3d/parity3d.ts` (earlier commit): the register, one row per flat route, with place, level (A reachable, B shown, C played, planned) and sprint.
- `game3d/parity3d.test.ts`: reads `App.tsx`; fails if a route has no row, if a row names a route that is gone, if a `:param` page is not reached through a listed page, and (checked by removing a row inside the test) when a row goes missing.
- `game3d/signpostSpot.ts` (+ test): where the sign stands, its ranges, the G key and the short words. The file is named `signpostSpot` because `signpost.ts` next to `SignPost.tsx` clashes on case-insensitive Windows.
- `game3d/SignPost.tsx`: the code-built post. Furniture, no fact, no motion.
- `game3d/WorldMenu.tsx`, `WorldPanel.tsx`, `WorldMenu.test.tsx`; small edits to `Scene.tsx`, `Toolbar.tsx`, `pages/Game3DPage.tsx`; `components/Layout.tsx` (earlier commit) hides the sidebar for `?embed=world`.

## Game sprint checklist

Pages touched: `/game3d` only. Identity score stays 3. Visual win: the signpost. Words short and playful, no number, no buy or sell word. Interaction cost: E at the sign then pick = 2; button then pick = 2 (to be measured in a real browser). Budget: one small code-built prop, no model, nothing loaded until a page is opened.

## Checked so far (2026-11-01, Faiz's Windows machine)

- `npm run lint`: 0 errors (2 old warnings, not in this change).
- `npm test`: 1128 of 1129 passed, including the new tests. The one failure is an untracked stray `frontend/public/art/New folder/.../screen.png` (784 KB) tripping `artAssets.test.ts`; not from this change.
- `tsc` and `vite build` fail on Windows only, from old file-name case clashes (`Desk.tsx`/`desk.ts`, `KeepModels.tsx`/`keepModels.ts` and others); CI on Linux is the real check. Not run on Linux in this session.

## Not done (cut line)

Real doors replacing the sign, district by district (S14, S15). Panels for pages that assume a full layout may need small wrappers (open risk). Headless screenshot and measured tap counts still to do.
