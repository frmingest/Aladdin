# 3D courtyard: Standing 3, T4, look and judge (2026-10-31)

Status: **T4 of 4 done in a headless browser on a local test database. Merged: T1 to T3 (#223, #227, #228); this write-up is a docs-only PR. Deployed: not checked. Seen on real data: no.** Plan: [game3d-standing-3-sprint-plan-2026-10-31.md](game3d-standing-3-sprint-plan-2026-10-31.md).

## What this step is for (plain words)
The first three steps were written and tested but never watched by a person. This step runs the real app (backend, Postgres, frontend, a real Chromium) and clicks through it like a player: an empty fortress, the sample fortress, a real-shaped fortress with a wire that fired, and one wire marked "I have looked".

## How it was run
Clean clone of `main` at `2ab3c41` in the cloud workspace, Postgres 16, `alembic upgrade head`, FastAPI on :8000, Vite on :5173, Chromium with software WebGL. Test data is the same seed the backend tests use (5 holdings, all written up, one armed wire). **Nothing touched Railway or your real database.** Frame rate cannot be judged on software WebGL.

## What was seen
| State | Standing card | Torches | Result |
|---|---|---|---|
| Empty fortress | "Standing: not started. Bring in your holdings." | 4 posts, all dark | as designed |
| Level 3, watch never reported | Level 3 of 4: Reasons, "The watch has not reported. Nothing is known." | 3 lit, 4th dark | unknown shown as unknown |
| Level 3, watch fine, wire fired | "1 wire fired, not yet looked at." plus a Watch card: "A wire fired on Cash Rich. Look at it." / "ROIC under 10%" / **I have looked** | 3 lit, 4th dark | list and button read well |
| After pressing the button | "Level 4 of 4: The Watch. The watch reports in. Every wire looked at." | 4 lit; the Watch card is gone | one `POST /thesis/tripwires/{id}/acknowledge`, nothing else written; API now says level 4 |
| Watch quiet for 40 hours | Level 3, "The watch is not walking the walls" | 3 lit | level drops, as designed |
| Sample fortress | "Sample fortress: no Standing yet." Watch card: "Sample fortress, not yours. Nothing to mark." | none lit | no button, no write |
| Phone width (390) | Standing card readable, torches behind it | 4 lit | fits; see debt below |

No uncaught page errors in any state. The only console error is one blocked outside request (the workspace proxy), unrelated to the game.

## Checklist section B
1. **Pages touched:** `/game3d` only (torch row, Quest log Standing card and Watch card). Backend: `standing_v2`, `GET /game/standing` fields.
2. **Identity:** `/game3d` stays 3. The new fact is a torch: lit or dark, plus the count.
3. **Visual win:** the fourth torch, delivered. **Voice check** (shipped words): "Wires to look at", "A wire fired on <name>. Look at it.", "I have looked", "Keep it up. Look at each wire that fires.", "The watch has not reported. Nothing is known.", "The watch is not walking the walls". Each reads in one breath. No buy, sell or score words.
4. **Look-and-judge for Faiz:** the question is *"When a wire fires, do you notice the dark fourth torch before you read anything?"* Screenshots were taken at desktop and phone (sent in chat, not committed). Plain view and normal-mode side by side were not taken: this sprint changed no Plain view.
5. **Checks:** tsc, lint, test, build and backend pytest ran green at T3. Not re-run here (docs only). **Not seen:** your real data, Railway, a real GPU frame rate, reduced-motion, colour-blind pass, a failed acknowledge (covered by a unit test only).
6. **Status:** merged yes (T1 to T3), deployed not checked, seen on real data no.
7. **Direction memory:** look unchanged.
8. **Taps, measured (cold load, real browser):** `/game3d` level: **0** (torches in view from the spawn). Look at a wire: **2** (Q, then "I have looked"). No duplicate control, no confirm-only step. With an empty fortress the Quest log opens by itself; otherwise Q opens it.
9. **Identity debt:** none new.

## Found, not fixed
- On a phone the green "Done! Every holding has both lines." pill in the Quest log wraps into a fat oval. Old, not part of this sprint.
- The Quests button badge read 1 both before and after the wire was marked seen, so a fired wire does not add to it. Left as is; say if you want it counted.

## Git commit description
`docs: Standing 3 T4 look-and-judge write-up (headless browser, test database), progress and index`
