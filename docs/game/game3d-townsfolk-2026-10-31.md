# 3D courtyard S8: townsfolk, casting and the quest-done cheer (2026-10-31)

Status: **written and tested (977 tests, tsc, lint, build green), not merged, not deployed, not seen rendered (no browser here).** Branch `feature/game3d-townsfolk`. Plan: [kaykit sprint plan](game3d-kaykit-sprint-plan-2026-10-31.md) (S8).

## What this sprint is for (plain words)
The courtyard had three people. Now it feels lived in: a guard stands by the gate road, a scout looks at the quest board, and Barren Wuffet raises his hands while you talk to him. When you have written a reason for every holding (quest 1 done), everyone cheers and confetti goes up over the fountain.

## What changed
- `Barbarian.glb` (guard) and `Rogue.glb` (scout), 0.5 MB each, made with `scripts/optimize-models.mjs` (now takes names). Axes, shield, mug and crossbows hidden. No dialogue, no name tag, not in `NPCS`, so nothing opens when you walk up. Credits added.
- `townsfolk.ts` (placement, tested clear of pads, props, scenery, people, spawn and the gate road), `Townsfolk.tsx`.
- Oracle plays `Spellcasting` while his dialogue is open (`pose` on `Avatar`).
- Cheer: `celebrate.ts` fires only when quest 1 is exactly `done`, not on the sample journal, once per page load. Hero and all four people play `Cheer` for 3 s (`chooseClip`), `Confetti.tsx` shows one instanced burst of 150 pieces (teal, gold, white, blue; no red or green). Reduced motion: no cheer, no confetti, no casting.
- Rule exception recorded: this is the only place a model shows a fact.

## Not done
Teal retint of the hero's hood (shared palette texture; left as is). Smaller cheer for quest 2: no, by design.

## To look at (Faiz)
Walk to the gate: guard on the west side, scout near the board. Talk to Barren Wuffet: he casts. With every holding written up, reload: a 3 s cheer and confetti. Check 60 fps with P.
