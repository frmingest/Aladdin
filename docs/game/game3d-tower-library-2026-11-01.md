# 3D courtyard: walk into a tower and read its library (2026-11-01)

Status: **written and tested, in PR `feature/game3d-tower-library`; not merged, not deployed, seen only in a headless browser (software WebGL, mocked fortress with eight made-up holdings), not on your real data and not on a real GPU.**

## What this is for (plain words)
You asked to walk up to a holding's tower, go inside, and find a library where each shelf stands for one financial side of that holding. That is now built. Walk to the little door on any tower (it has a lamp over it), press **E**, and you stand in a hall with **six shelves**. Walk up to a shelf and press **E** to read it in words. Walk to the big door (or press the "Back outside" button) and you step out in front of the same tower.

Nothing new is computed. Every shelf reads the facts the fortress already stores for that holding (the same row the flat Fortress uses), with the same wording. The shelf only adds a picture: **how many books stand on it**.

## The six shelves
| Shelf | Asks | Reads | Books (of 8) |
|---|---|---|---|
| The Walls | Can it take a hit? | wall tier, the reason, debt and cover figures, "close to the line" warnings | basalt 8, granite 6, brick 5, timber 3, rotted 1 |
| The Moat | Can rivals cross it? | moat tier | wide 8, narrow 4, none 1 |
| The Land | Is the price fair? | price tier, the reason, margin of safety, last verdict | bargain 8, discount 6, full price 4, dear 2 |
| The Oath | Is the story still true? | thesis state, tripwires fired, how old the reading is | intact 8, review 4, breached 1 |
| The Treasury | How big a slice? | size, share of the fortress, worth in NOK, sector, kind | great 8, medium 6, small 4, tiny 2 |
| The Storm Test | What if the sky falls? | stored stress result, shared weak walls | sheltered 8, exposed 4, breach risk 1 |

Rules that keep it honest:
- **Unknown stays fog.** A tier that is not surveyed gets an empty shelf behind a frosted pane, a "?" on the plaque and "Not surveyed" in words. It never gets books.
- **Does not apply** (a gold store has no balance sheet) gets a bare shelf and a "–".
- **A weak tier never gets more books than a stronger one** (a test checks every tier order). A rotted wall still shows one book: weak, not missing.
- **Colour carries nothing.** Books are coloured by position only. The plaque has a mark (✓ ! ✕ ? – •) and the side page has the words.
- Every tower has the same door and the same hall: a weak tower is not harder to enter. No buy or sell wording (a test checks the words).

## What changed
- **Pure code, tested:** `libraryShelves.ts` (shelf facts and words), `libraryRoom.ts` (the hall: six bays, door, reading spots), `towerDoor.ts` (which door you are at, and where you step out).
- **3D:** `Library.tsx` (the hall, drawn from inside only so the follow camera can sit outside the walls), a timber door with a lamp on every tower in `TowerMesh.tsx`, and `Scene.tsx` swaps the courtyard for the hall while you are inside (warm dim light, same for every shelf).
- **Page:** `Game3DPage.tsx` handles E (people first, then a tower door, then the writing desk; inside: a shelf or the door), the prompts ("Press E to go into Alpha Energy", "Press E to read The Walls", "Press E to go back outside") and a "Back outside" button. `ShelfPanel.tsx` is the plain view: it lists **all six** shelves in words, with the one you are reading open.
- **Hero:** `Player.tsx` can be moved through a door.

## Two bugs found while looking, both fixed
1. **The hero fell through the library floor.** The first frames in a new room hitch (shaders compile), and one long physics step dropped a falling hero straight through a floor that was there. Now the hero hovers for the first four calm frames after any door, and if it ever falls out of the world it is put back where the last door left it. Checked: it rests on the floor on arrival and on return, for three towers.
2. **Stepping out of one tower could land you inside the writing desk's shelf** (the pad at the north-west is close to it). The exit spot now slides round the tower until it is clear of the desk, the shelf, the keep, the people and the other pads; a test checks every pad at every tower size.

## Checklist section B (game identity and interaction cost)
1. **Pages touched:** `/game3d` only. No flat Game mode page changed.
2. **Identity:** `/game3d` stays 3 or better. New scene: a library, six bays, a rug and a reading table; one real fact per shelf encoded as books; a Plain view (the side page lists every shelf).
3. **Visual verb + scene:** *shelving books in a hall*. Voice: short and playful ("Can it take a hit?", "What if the sky falls?"); the heavy words stay in the side page.
4. **Rules:** truth: unknown is fog, not applicable is bare, weak is never more than strong. Colour-blind: marks on every plaque. Reduced motion: nothing moves. Performance: no new model files, no new downloads; **draw calls and frame rate not measured on a real GPU** (check P).
5. **Taps (cold load):** enter a tower = walk up + E (2); read a shelf = walk up + E (1 each); leave = E at the door, or one button.
6. **Checks run:** `tsc`, `npm run lint` (the same 2 old warnings), `npm test` (125 files, 1068 tests), `npm run build`: green. Backend untouched, not run.
7. **Seen:** the walk-up prompt, entering, a good tower, a bad tower (nearly bare shelves), a not-surveyed tower (frosted shelves), a gold store (bare shelves), reading a shelf, stepping back out. **Not seen:** a real GPU, your real holdings, a phone.

## For Faiz after deploy
Open `/game3d`, walk to any tower's little door and press E. Read two or three shelves. Check one tower you know is weak, and the gold or fund towers (they should show bare shelves, not fog). Press P in the hall and check the frame rate. If you do not like it, one revert takes it all out; the courtyard is unchanged.

## Not done (ideas, not built)
- Deeper shelves: valuation scenarios, the advisors' words and the journal lines for that holding could each become a book you open.
- A phone view: the hall works with the same keys; touch walking is not part of this sprint.
- A lit-lamp or dust effect for "analysis is stale" (the Oath shelf says it in words only).

## Git commit description
`3D courtyard: walk into a holding's tower and read its library (six shelves from the stored facts, unknown stays fog), hero hover after doors, exit spot clear of the desk`
