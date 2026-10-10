# Art pack trial — 2026-10-10 (dropped)

Status: **dropped by Faiz on 2026-10-10; merged and then reverted.** `main` has no AI-generated art.

What happened:
- Faiz generated artwork with Google Stitch (prompts: [stitch-art-prompts-2026-10-09.md](stitch-art-prompts-2026-10-09.md)) and chose three images to try: P2 header banner v2, P5 Cartographer's table (top strip only), P7 parchment texture (as grain on the dark Night panel).
- Batch 1 was merged as PR #94 (`feature/art-pack-trial`, `38ddae5`, merge `7d1b7ac`) behind a **Painted art** switch (`?art=on|off`, localStorage `aladdin-art-pack`, `ART_PACK_DEFAULT`).
- Faiz then asked for all remaining images (batch 2: Council/Records/Chronicle room scenes, tab emblems, Oracle/Partner portraits, iron frame corners, wax seal, fog mist). That work was pushed to the same branch as commit `4e72e91` after #94 had already merged, so it is **not on `main`**. It exists only on branch `feature/art-pack-trial`.
- Faiz then asked to drop the AI art. PR #95 (`fix/revert-art-pack`) reverted the merge and was merged; `main` is back to its pre-#94 state.

Why some images were never wired (kept out on purpose): P3 full (three seated figures would claim three advisers), P4 ring map and P5 full painting (baked rings and fog), P11 siege A/B/C (baked weather and tent state would contradict the real siege level), P14 sprites and P9 crest (the app already draws per-room crests and sprites in SVG), P8 symbol seals (symbols the app does not give meaning). Baked-in data-like art conflicts with the truth rules in `.claude/standards/game-ui-standards.md`.

Originals remain untracked in `E:\Aladdin\frontend\public\art` on Faiz's machine. Next steps for Stitch work are in [stitch-handoff-2026-10-10.md](stitch-handoff-2026-10-10.md).
