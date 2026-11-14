# 3D tidy-up: one list of things you can walk up to, and a camera that stops at walls (2026-11-14)

Issue #411, item 1 of 4 from the 3D review of 2026-11-14. Status: **written, not merged, not deployed.**

## What this was for

Every new object in the 3D world (a post, a door, a board) used to mean edits in four or five places: a "near" switch
on the page, a callback into the scene, a watcher in the room, a branch in the E key and a branch in the prompt. That
made the next 3D items slow to build. This change puts all of it behind one list. Nothing a player sees changes,
apart from the camera indoors.

## What changed

| Before | After |
| --- | --- |
| 27 separate "am I standing near X" switches on the page | One answer, kept in one place (`nearStore.ts`) |
| The scene took 51 inputs, 27 of them one callback per object | The scene takes 9 inputs; none is about a single object |
| 8 watchers (one generic, one per room) | One watcher over one list (`SPOTS` in `near.ts`) |
| The E key: a 120-line branch per place and per object | One table: for each kind of thing, its prompt and what E does |
| 12 "walk into X / walk out of X" functions | Two: go in, go back out |
| `Game3DPage.tsx` 1,384 lines, `Scene.tsx` 669 lines | 1,057 and 391 lines |

## How to add a new thing to walk up to

1. Add one entry to `SPOTS` in `frontend/src/game3d/near.ts`: which place it is in, where it stands, how far its reach goes.
   Its position in the list is its turn when two things are in reach at once (a person beats a door, a door beats the desk).
2. Add one entry to the `acts` table in `frontend/src/pages/Game3DPage.tsx`: what its prompt says and what E does.
   The code does not compile until this entry exists.
3. Draw it in the scene. If it should light up when you stand at it, read `useNear("<its key>")`.

Nothing else: no new switch, no new input on the scene, no new watcher.

## The camera

In the Town Hall, the Hall of Records and the Weather Tower the camera used to drift out through the wall behind you
and look back in through it (the door stood between you and the view on arriving). Now it comes in along its own line
of sight until it is just inside the walls and under the ceiling: the same view, only closer (`cameraRoom.ts`).
With your back flat against a wall the camera ends up at the hero's own head, so she is not drawn for that moment and
you see the room from where she stands. Outdoors nothing changes.

## Small differences a player could notice

- Indoors the camera stays in the room (the point of the change).
- On walking through a door the prompt goes quiet for the short fade and comes back on arrival. Before, it went quiet
  the same way; the page did it by hand at every door.
- A panel opened at a post (vault, watch post, perch, Realm post) now also closes when you walk through a door. Before,
  it could stay open on the other side if the door and the post were both in reach.

## How it was checked

- Unit tests: 2,053 pass (21 new: the list has one entry per spot, every place has exactly one way back out and it
  comes last, the courtyard's order is unchanged, the watcher only asks the place you are in, the camera stays inside
  every room from every standing spot, angle and zoom).
- Browser, demo stack, software graphics: the regression suite passes, with two new tests that walk up to the shelves
  in the Hall of Records and a board in the Town Hall, read the prompt, press E and check it did what the prompt said.
- Same walk on `main` and on this branch, side by side (courtyard, Town Hall, Hall of Records, Weather Tower, Siege
  Field, Market Quarter, a holding's land): the same prompts in the same order, E does the same thing.
- Not checked: how the camera feels on a real graphics card with a mouse. That is a person's look.

## Not in this change

- #410 (the model whose odd UV breaks a merge) and #382 (renaming the 29 file pairs that collide on Windows) are their
  own PRs. This change adds no new colliding pair.
- `npm run smoke:3d` runs against the live site, so it can only be run after a deploy.
