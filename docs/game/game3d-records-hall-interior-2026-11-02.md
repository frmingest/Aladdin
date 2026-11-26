# 3D courtyard S18 (PR 5): inside the Hall of Records (2026-11-02)

**Status: written on `feature/game3d-records-hall-interior`, branched from `main` after #257. `tsc --noEmit`, `npm run lint` (0 errors), `npm test` (155 files, 1284 tests) and `npm run build` passed in this session. NOT looked at in a browser, not merged, not deployed.** This is the last open piece of S18.

## What a sprint is for (plain words)

The Hall of Records building in the Town used to be a door that opened a page. Now you walk in. Inside is an archive room with three bookcases, and **one book for each decision in your journal**. You can see at a glance how many decisions you have made and which ones are owed a look-back, then press E at the shelves to open the full Hall of Records page.

## What you will see

- **Walk-in:** E at the Hall of Records door (the big castle at the far end of the Town) takes you into the archive. E at the little door by the south wall, or the "Back to the Town" button, takes you out at the same door.
- **Books:** every book is the same size (a big decision is not a bigger book). The leather colour is the same tan, red, blue and so on as the flat Hall, because it comes from the flat Hall's own `tomeFor`. A gold ribbon hangs from a book when a review is owed.
- **Seals on the spine, told apart by shape:** whole disc = sealed, split disc = owed, empty ring = written (the same three states, and the same three words, as the flat Hall). Colour never has to carry it.
- **The plate over the shelves:** "The Hall of Records", then "N decisions on the shelves", then "N books wear a ribbon: a look-back is owed" when some do, then "N more in the page" when the shelves are full (36 books fit). No records yet: "No books yet. Write a decision at the desk." The plate hangs from the top of the middle bookcase and always shows (#521: it used to sit at 4.4 m, under the HUD bar and below the 12 px size floor from both the spawn and the shelf spot, so nobody saw it). Measured headless (software WebGL, mocked API, 1280x720 and 375x812): it is on screen below the toolbar at the spawn and at the shelf spot, in the books, empty and fog states. Its cost: from both spots it covers the middle case's top row (six book slots), and from the spawn its text is small (about 9 px on desktop, 7 px on a phone). A sign standing on the rug instead covers the lower row and the hero's head; a plate above the cases slides under the toolbar from the spawn. Which trade-off to keep is open for Faiz on #521's PR.
- **E at the shelves** opens the flat Hall of Records page in the world panel (the same panel the Town door used to open), so every date, price and review stays in the page's own words.

## Why it is trustworthy

- Books are read through the same call as the flat page (`getRecords`) and drawn from the flat Hall's own mapping (`lib/hall.ts` `tomeFor`); a test checks each book equals `tomeFor` of its record.
- **No outcome is drawn:** a test builds two records that differ only in price change and verdict and checks the two books are identical.
- Until the journal has been read once in this page session (the first load is on its way, or the first read failed), a dust sheet in the kit fog colours hangs over each bookcase, with a fold over the top, under a fog plate with no number: "Not read yet." or "Could not read the books just now." (#505; before it the shelves stood bare, which looked the same as an empty journal). A failed re-fetch after a good read keeps the books shown (`lib/queryCache.ts`). An empty journal stays bare boards. No placeholder books, no guessed numbers.
- No buy or sell words and no picture characters on the plate (tested). Game voice: short, playful, numbers exact.
- The Records page is still reachable the two other ways it was: the "Where to?" sign and E at the shelves (register row `/fortress/records`, level A).

## Files

- `game3d/recordsHallRoom.ts` (+ test): room size, door, spawn, bookcase and book geometry, `bookSlot`, `bookPlans`, `shelfFacts`, `shelfPlate`, nearness helpers, `archiveExit`.
- `game3d/RecordsHallRoom.tsx`: the room (code-built walls, rug, three bookcases, books, seals, ribbon, plate, door).
- `game3d/Scene.tsx`: an `inRecords` branch beside `inHall` (teleport in and out, room swap).
- `pages/Game3DPage.tsx`: `inRecords` state, E handling, prompts, back button; E at the Hall of Records door enters the room.

## Decisions I took (you may overrule)

- **Shelves hold 36 books** (three cases, two rows of six). More are counted on the plate, not drawn, to keep the draw-call budget. Order is the flat Hall's order.
- **Seals are small code-built shapes**, not a model; the room is code-built like the Town Hall hall. The KayKit Dungeon Remastered shelves are a later swap.
- **Time capsules are shown as the two seals on each book**, the way the flat page shows them, rather than as separate objects.
- No Stitch picture is needed.

## Not done / not checked

- **Not seen in a browser:** please walk in and tell me if the plate is too small to read, the books look crowded, or the seals are too tiny to tell apart at the shelf spot.
- Deploy not checked. S18 is otherwise complete once this merges; S19 waits for The Printer and S20 needs your call on more people.
