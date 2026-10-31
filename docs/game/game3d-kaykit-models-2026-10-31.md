# 3D courtyard: free CC0 character models (KayKit), 2026-10-31

**Status: S0 (assets and licence) written and committed on `feature/game3d-kaykit-models`, not pushed, not merged, not deployed. S1 to S5 not started.** The full plan (why, decisions, budget, S0 to S5, risks) is the Claude project doc `claude/game3d-kaykit-sprint-plan-2026-10-31.md`.

## S0 result

- Branch `feature/game3d-kaykit-models` off `origin/main` at `f33d4bb` (#205).
- **Correction to the plan:** the repo is `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` (with the `KayKit-` prefix), commit `672074b`. The name `Character-Pack-Adventures-1.0` in the plan returns 403/404. Hexagon and Dungeon repo names (only needed for the optional S4 props) are not re-checked; expect the same prefix.
- Copied unmodified to `frontend/public/models/`: `Rogue_Hooded.glb` (3,597,652 B), `Mage.glb` (3,589,240 B), `Knight.glb` (3,659,532 B), plus `CREDITS.md` and `LICENSE-KayKit-Adventurers.txt` (pack licence: CC0).
- `.pre-commit-config.yaml` blocks only `pdf|pptx|xlsx|xhtml|xbrl|zip`; `.glb` is not blocked and not gitignored.
- Raw total 10.8 MB, over the 1.5 MB per character budget until S4 compresses them. Nothing loads them yet, so the app is unchanged.
