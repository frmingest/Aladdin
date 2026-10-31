# 3D courtyard: free CC0 character models (KayKit), 2026-10-31

**Status: S0 (assets and licence) and S1 (loader and hero) written and committed on `feature/game3d-kaykit-models`, not pushed, not merged, not deployed. S2 to S5 not started.** The full plan (why, decisions, budget, S0 to S5, risks) is the Claude project doc `claude/game3d-kaykit-sprint-plan-2026-10-31.md`.

## S0 result

- Branch `feature/game3d-kaykit-models` off `origin/main` at `f33d4bb` (#205).
- **Correction to the plan:** the repo is `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` (with the `KayKit-` prefix), commit `672074b`. The name `Character-Pack-Adventures-1.0` in the plan returns 403/404. Hexagon and Dungeon repo names (only needed for the optional S4 props) are not re-checked; expect the same prefix.
- Copied unmodified to `frontend/public/models/`: `Rogue_Hooded.glb` (3,597,652 B), `Mage.glb` (3,589,240 B), `Knight.glb` (3,659,532 B), plus `CREDITS.md` and `LICENSE-KayKit-Adventurers.txt` (pack licence: CC0).
- `.pre-commit-config.yaml` blocks only `pdf|pptx|xlsx|xhtml|xbrl|zip`; `.glb` is not blocked and not gitignored.
- Raw total 10.8 MB, over the 1.5 MB per character budget until S4 compresses them. Nothing loads them yet, so the app is unchanged.

## S1 result (loader and hero)

- New: `Avatar.tsx` (drei `useGLTF`, `SkeletonUtils.clone`, hides the weapon nodes, scales to height measured on the *visible* meshes only, `AnimationMixer` with a 0.2 s cross-fade, shape figure while loading and on error), `modelFit.ts`, `animClips.ts` (Idle / Walking_A / Running_A, falls back to Idle then the first clip, logs a missing clip once), `models3d.ts` (hero only: `Rogue_Hooded.glb`, hides `Knife_Offhand`, `1H_Crossbow`, `2H_Crossbow`, `Knife`, `Throwable`). `Player.tsx` writes a `motion` ref each frame; capsule collider unchanged. Reduced motion holds Idle.
- Checks run locally in `frontend/`: `tsc --noEmit` clean, `eslint src/game3d` clean, `vitest run src/game3d` 65 passed (8 new: fit maths, clip mapping, registry), `vite build` ok (Scene chunk 3.0 MB, unchanged order of size).
- Headless render (swiftshader, API mocked to 500, built `dist`): the real hero loads (GLB 200, no model errors), stands facing the camera at spawn, walks and runs away from it; the arms swing out when walking versus resting when idle. The cape hides the legs, so leg motion was not judged from the shots. With the GLB request blocked the shape figure appears and one warning is logged, as designed.
- Not done in S1: the **teal retint**. The hood is the pack's green; recolouring needs the palette texture and was left alone until S4/Faiz decides. **No outline yet** on the model (S2). Facing: KayKit faces +z, so `MODEL_YAW` stays empty.
- Not seen on a real GPU or Railway; headless swiftshader only.
