# 3D S25 PR 2: the survey lanterns, fog of war in 3D (2026-11-03)

**Status: written and tested (type-check, lint, 1484 tests, build). Not looked at in a browser, not merged, not deployed.** Plan: [S25 sprint plan](game3d-s25-holding-land-sprint-plan-2026-11-03.md). Builds on PR 1 ([land](game3d-s25-holding-land-2026-11-03.md), merged #276).

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge. PR 1 gave every holding its own land. This step puts the first real "what do we know about this holding?" picture in it: **four lanterns, one per survey check**. It is the fog of war from the flat Cartographer's table, now something you walk up to.

## What you will see

Walk into any tower door. Four lantern posts stand in an arc across the land, ahead of where you arrive. Left to right they are: **Latest report opened**, **Analysis fresh**, **Invalidation written**, **Valuation available**. Each has a name tag with a mark:

| Look | Mark | What it means |
|---|---|---|
| Open flame in a glass cage | tick | The check is clear |
| Hooded lamp in pale mist | ? | The check is in fog |
| Bare post, a crossbar | dash | The check was not judged (for example, demo data has no stored reports) |

Shape and mark carry the meaning, so it never depends on colour. Nothing is red or green.

**E at a lantern** shows a one-line plate: the check's name and the survey's own reason, for example "Analysis fresh. The analysis is weathered and is due a fresh run." Walking away puts it away. Reading the latest report at the records table lights the first lantern (it is the same "opened on this browser" mark as the flat page).

Until the report list and decision records have answered, the lanterns stay hooded. If the list cannot be read, the lantern stays in fog and says so. A missing answer is never shown as clear.

**Visual verb + scene:** *read the fog.* Fact encoded: the four survey checks.

## What changed in the code

- `holdingLand.ts`: `LANTERN_LOOKS` (shape and mark per look) and `nearestLantern` (with a wider leave range so the edge does not flicker).
- `LanternPost.tsx` (new): draws one lantern. Lanterns carry facts, so they sit outside the batch of still pieces.
- `near.ts`: `lantern` joins `Nears` and `Standing`. In a land the order is shelf, table, lantern, gate, so the E prompt always matches what E does.
- `Game3DPage.tsx`: on entering a land it reads that holding's report list and the decision records (the same calls as the flat Cartographer page) and runs `surveyTower`. Demo data uses the survey's own demo answers.
- `landLanternWordsV1.ts` (new): the prompt and plate frame. Labels and reasons come from `lib/survey.ts`.

## Tests

- Looks have three different shapes and three different marks; fog and not-judged are never lit.
- `nearestLantern`: finds the lantern you stand at, none from far off, keeps it a little further out, and offers none at the arrival spot or the gate.
- `standingAt`: lantern after shelf and table, before the gate; none in the courtyard.
- Words stay short; the plate adds no facts.

## Not checked

Not seen in a browser: the look of the posts, the name tags, E at a lantern, frame rate and draw calls (budget 120 for a land; four small posts and one light each are added, so press P and tell Claude the numbers). The lantern light is one point light per lit lantern, at most four.

## For Faiz to look at in `/game3d`

Walk into a strong tower and a foggy one. Check that the lanterns agree with the Cartographer's table for the same holding. Press E at each lantern. Read the report at the table and see the first lantern light. Say if the posts are too small, a tag is hard to read, or the light costs frames (the first cut is the point lights).

## Next

PR 3: the holding's own tower in the middle and the price post. Then S26 (the first dressings).
