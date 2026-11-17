# Game 3D (`/game3d`) standard

Fills the gap found in `docs/ops/agentic-coding-audit-2026-11-01.md` (contradiction 4): the 2D visual-identity standard is written for SVG/CSS pages and says nothing about `/game3d`. `game-ui-standards.md` and `game-visual-identity.md` still win on conflict; sections 1 to 8 here only say how they apply in 3D. Method skills stay the same (`game-visual-identity`, `game-feel-and-performance`, `game-ux-onboarding-accessibility`).

**Status of this file:** rules marked *Existing* come from code or docs already in the repo (source named). Rules marked *Proposed* are new and need Faiz's yes before a reviewer may block a PR on them (decision list at the end).

## 1. What "identity" means in 3D
The place is the page. A 3D place (courtyard, tower, Town Hall, Market Quarter, Siege Field, Royal Mint, Weather Tower, holding land) is judged with the same 0-3 ladder as a 2D page, read like this:
- **(a) Scene header** becomes the place's own silhouette and signature object that a screenshot identifies as Aladdin (not a stock model dropped on grass).
- **(b) Shared kit** becomes the shared 3D pieces: the CC0 pack models in `artManifest3d.ts`, the label tokens in `frontend/src/game3d/gameTokens.ts`, the label plan in `labelPlan.ts`. No one-off hex or one-off model where a token or kit piece exists.
- **(c) One real fact encoded** in the world: a size, position, fill, crack, fog or weather that comes from a real number through a pure mapping with a test, with unknown drawn as fog. *Existing:* pure plans in `*.ts` with a `*.test.ts` beside them (for example `holdingLand.ts`, `hourglassPlan.ts`).
- **(d) Plain view** is a flat, labelled copy of the same facts. *Existing rule* (`game-ui-standards.md` rule 3): a Plain view is always available. *Existing in 3D for the Royal Mint only* (`MintPlainPanel.tsx`); other places do not have one, so they are listed as identity debt, not blockers, until Faiz decides how a 3D place satisfies the rule (decision 1 below).
- **(e)** truth, colour-blind, reduced-motion, keyboard, phone, performance (sections 2 to 6).
A new or changed place below 2 is a blocker, same as a 2D page.

## 2. Truth (Existing, from `game-ui-standards.md`)
Unknown stays fog: never drawn as a default-good state. The fog label plate never carries a number (`gameTokens.ts`). A weak or unknown holding never looks handsome because a model is nice. Nothing in 3D buys, sells or says Buy/Sell (see issue #375 for the open wording decision on the Realm verdict).

## 3. Performance budget
- *Existing:* the courtyard target is **300 draw calls or fewer, then 150** (`docs/game/game3d-discovery-sprint-plan-2026-11-02.md`); the in-game stats overlay (press P) shows draw calls and fps; the `PerfProbe` / `PerfBreakdown` components report per group.
- *Existing practice:* repeated pieces are drawn in one go (instancing or `StaticBatch.tsx`); one instanced draw per model, no shadows on small scatter (`docs/game/game3d-a4-meadow-plants-2026-11-04.md`); the outline is a back-face copy per mesh, so it costs about twice the meshes (`docs/game/game3d-polish-audit-2026-11-06.md`), drop it on small pieces first if over budget.
- *Rule:* a change that adds meshes states its draw-call delta per place and says whether it was measured. **A headless software-GL run (about 2 fps) cannot measure the budget**; say "not measured" and put "open `/game3d`, press P" in the PR's "After deploy (Faiz)". Never write "within budget" without a number from a real GPU.
- *Proposed:* add an automated draw-call count to `frontend/e2e/regression/game3d.spec.ts` as a report-only number first (issue to be opened).

## 4. Art and assets
- *Existing:* models are free CC0 packs (KayKit, Kenney, Quaternius and similar), packed by the `scripts/pack-*.mjs` scripts and kept small (GLB under about 0.9 MB each, `docs/ops/agentic-coding-audit-2026-11-01.md`). Check the licence before adding a pack. Run `scripts/glb-colour-audit.mjs` on every new GLB, and record the result in the sprint doc.
- *Existing:* inline hex colours in `game3d/` are a finding when a token exists (65 were counted on 2026-11-01). New colours go into a token file, owned by `game-feel-engineer`.
- *Existing:* file-name case collisions (29 pairs) are tracked in issue #382; do not add a new one.

## 5. Text in the world
- *Existing:* every label is a parchment plate with ink that passes **4.5:1** contrast, checked by `gameTokens.test.ts`. A new text/plate pair is added to `LABEL_PAIRS` so the test covers it.
- *Existing:* wording lives in versioned word files (`dialogueV*.ts`, `*WordsV1.ts`) with tests; a change to words already shown to Faiz is a new version file, not an in-place edit.
- *Existing:* game voice rules (section 6 of `game-visual-identity.md`) apply to every 3D string: short, plain, player verbs, caveats in a foldout.
- Text must not clip or wrap into a one-word column on a portrait phone (issues #439, #440, #434 are the reference failures).

## 6. Motion, sound and access
Reduced motion is honoured through `motionPref.ts`; every loop and camera move has an instant alternative. Sound is off until the player opts in. Everything the mouse can do has a keyboard path, and the "press E" prompts say what E will actually do (the courtyard had up to 28 prompts of 12 kinds whose text could disagree with the action).

## 7. Interaction cost
Same gate as 2D: name the place's main task, count the taps or key presses from a cold load in a real browser, target 2 or fewer for the common case. Moving between places has a name and a fade, not an instant jump.

## 8. Evidence a review must show
- `playtest-qa`: screenshots of each touched place at desktop and phone, and what could not be rendered. If the run was headless software WebGL with a mocked API, the PR says **"headless only"** in "Seen in a browser?". This stays honest until issue #378 decides who does the real-GPU look; until then the real-GPU look is Faiz's, written in "After deploy (Faiz)".
- `game-ux-designer`: identity score before and after for each touched place, the tap count, and the identity-debt list.
- `game-feel-engineer`: draw-call delta, token and kit use, reduced-motion path.
- `rules-auditor` / `docs-sync-checker`: as for any change.

## Decisions for Faiz
1. Approve the *Proposed* rules above (draw-call count in the e2e report) and decide how a 3D place satisfies the Plain-view rule, so reviewers may block on them.
2. Issue #378 (rule contradictions): does a headless run count as "seen"? Until you decide, this file says it does not count as a real-GPU look.
3. Should the 3D identity score be written into `docs/game/game-sprint-checklist.md` sections A and B? (Proposed: yes, one line each.)
