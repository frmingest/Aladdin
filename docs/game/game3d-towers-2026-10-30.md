# 3D courtyard, week 2: your holdings stand as towers (2026-10-30)

Status: **written and tested, not merged, not deployed, not yet seen in a browser** (the built-in
browser cannot reach a dev server started from the shell). Branch `feature/game3d-towers`, off `main`
after PR #198 (week 1) was merged.

## What a sprint is for here
Week 1 gave you a courtyard to walk in, with eight empty pads. Week 2 puts your real holdings on
them, so the place starts to mean something: a strong company looks sturdy, a weak one looks weak,
and what nobody has checked yet stays in fog.

## What it does
- `GET /game/state` is read once when the page opens. One pure function, `stateToWorld()`
  (`frontend/src/game3d/stateToWorld.ts`), turns it into what is drawn. Nothing in it decides a fact.
- The biggest holdings take the pads, in the same order as the flat Fortress. Holdings beyond eight
  are counted in the panel ("not on a pad"), never dropped.
- Tower height and width come from the stored size class (great, medium, small, tiny).
- Walls: basalt, granite, brick, timber, rotted. Colour is fixed per material, **and** strength is
  shown three more ways so colour alone never carries the verdict: the crown loses battlement teeth
  (8, 8, 6, 4, 2), cracks appear (0, 0, 1, 2, 4), and the moat ring is wide, narrow or absent.
- Ivy climbs the wall when the analysis is ageing (low) or stale (high). A flag on a pole shows the
  stored thesis: intact, under review, or breached (hangs low and askew).
- **Unknown stays fog:** an unsurveyed wall or size draws a pale see-through tower with no teeth,
  cracks or flag, labelled "(not surveyed)". A moat not surveyed is mist, not water.
- Names float over the towers; **the facts are in the side panel** "Your towers", in the same words
  as the flat Fortress (wall, moat, size, thesis). Sample data is labelled "Sample fortress". If the
  state cannot load, the pads stay bare and the panel says so with a Try again button: no towers are
  ever invented.
- Lighting is still flat and the same everywhere. No buy or sell wording.

## Tests
`stateToWorld.test.ts` (9): empty state, order, overflow, weaker wall always looks weaker on every
signal, a big rotted tower never looks strong, unknown is fog, thesis/freshness pass through, demo
flag, plain facts match the 3D values. `TowerPanel.test.tsx` (4): words match, unknown reads "not
surveyed", sample label and load failure, overflow note. Typecheck and ESLint clean (no new
warnings); `vite build` ok (3D chunk 2.9 MB, 1.0 MB gzipped, loaded only on `/game3d`; page chunk 7 kB).
Full `vitest run` has one failure that is not from this change: "packed object art" finds the 12
unpacked Printer pictures in the gitignored `frontend/public/art/printer` on this disk (known:
not packed yet, see PROGRESS).

## Fix after first look on Railway (2026-10-30)
Faiz walked it on Railway (165 fps, 71 draws, 3k tris) and could not look straight up when standing
close to a tower. The camera could only look down at the hero. Now pulling the mouse past level tilts
the view up (down to about 80 degrees up), while the camera itself stays above the ground
(`movement.ts`: `MIN_PITCH` -1.4, `lookUpHeight`). Branch `fix/game3d-look-up`; not yet seen in a browser.

## Known gaps
- Not seen in a browser, so frame rate, readable labels and the look of the towers are unjudged.
- Towers share one cylinder look per structure type; no real art yet. Moat is not walkable-blocking.
- Draw-call count not measured yet (instanced crowns and cracks keep it low; check with P).

## To look at (Faiz)
Run the frontend, open `/game3d`: do your towers stand on the pads, is the weakest holding clearly
the weakest from across the courtyard without reading anything, do the panel words match what you
see, press P and note the frame rate.

## Next (week 3)
Two characters to talk to (the Oracle and the Partner) and the first quest, "Unwritten Thesis",
reading the journal the app already keeps. Real hero model to replace the capsule.
