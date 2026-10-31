# 3D courtyard: Standing 2, the writing desk (2026-10-31)

Status: **written and tested (tsc, lint, vitest 1015 passed, build green), rendered in a headless software browser in three data states, NOT merged, NOT deployed, not seen on a real GPU or on Railway.** Branch `feature/game3d-writing-desk`. Plan: [game3d-standing-2-sprint-plan-2026-10-31.md](game3d-standing-2-sprint-plan-2026-10-31.md) (docs PR #220). Builds on [Standing 1](game3d-standing-2026-10-31.md). **No backend change.**

## What this sprint is for (plain words)
Before, the game told you to write why you own each holding and then sent you out of the game to the Journal page. Now there is **a writing desk in the courtyard**, west of the keep door. Walk up, press E, write two lines (why you own it, what would prove you wrong), press "Write it down". A shelf beside the desk grows **one book for every holding that has both lines**. No points, no save file: the shelf and the level come from your real journal every time.

## Decisions (Faiz said "you decide")
1. A desk entry records the action **hold** with today's date. A real buy or sell still goes through the Journal page.
2. **Open-air nook** by the keep wall, not a room.
3. **Code-built desk** (no KayKit furniture download); revisit only if it looks thin in the real browser.

## What changed (frontend only)
- `desk.ts`: where the desk and shelf stand, talking range (4.2, leave 5.6), `bookCount` and fixed `bookSlots` (max 8; a shelf grows, it is never redrawn). `Desk.tsx`: the code-built desk, chair, shelf and books with the ink outline, no light source, no animation.
- `questV2.ts`: **Quest 1 version 2**. A holding counts only when one entry has a reason **and** a wrong-if line, the same test as Level 3 in the backend, so the quest and the level cannot disagree. `quest.ts` (v1) is untouched.
- `deskForm.ts` and `DeskPanel.tsx`: the panel (holding already chosen: the biggest unwritten one; two boxes; one button). It creates one **new** entry with `POST /journal` and never edits or deletes an old one. Sample fortress, unreadable or loading journal and an empty fortress cannot save, and say why. A failed save keeps what you typed.
- `Game3DPage.tsx`, `Scene.tsx`: press E at the desk opens it (E at a person still talks; the two are far apart); walking away closes it; after a save the journal and Standing are read again. A small hint, "Press E to write at the desk".
- `dialogueV3.ts`: while something is unwritten the Oracle adds one line pointing to the desk (15 words). `QuestLog.tsx`: goal and done words follow v2, a line says where to write, the journal button became "Old entries: the journal". v1 and v2 dialogue files are not edited.

## Checklist, section B
1. **Pages touched (from the diff):** `/game3d` only: the desk and shelf in the courtyard, the desk panel, the Quest log words, the Oracle's talk. Backend and flat Fortress untouched.
2. **Identity:** `/game3d` before 3 (Standing 1, by judgement) | after 3 (Faiz to confirm) | the shelf shows a real fact (books = holdings with both lines) without a number | Plain view: the panel says "2 of 3 holdings have both lines" and the Quest log carries the same facts in words.
3. **Visual win:** *the shelf of reasons*, delivered. Verb: write. Words deleted: the "go to the Journal page" paragraph.
4. **Words:** panel title 2 words, labels 3 and 4 words, button 3 words ("Write it down"), Oracle line 15 words. Game voice; numbers exact.
5. **Checks run:** `tsc --noEmit` clean; `npm run lint` 0 errors (the same 2 old warnings); `npm test` 1015 passed (new: quest v2, desk placement and shelf, desk form, dialogue v3, panel); `npm run build` ok. Backend not touched, so no `pytest` run.
6. **Seen (headless software browser, mocked API, built `dist`):** with real-looking data and one written holding the shelf shows 1 book; I walked to the desk, the hint appeared, E opened the panel, I wrote both lines, **the app sent exactly one `POST /journal`** (`action: hold`, today's date, both lines, the right holding), the shelf showed 2 books and the panel moved on to the next unwritten holding. With the **sample fortress** the panel opened with every field off and nothing could be saved. With an **empty fortress** the panel opened with every field off. No page errors.
7. **Not seen:** a real GPU, Railway (the real backend and a real journal write), the 60 fps check (press P), reduced motion, a colour-blind pass (books differ by being there, not by colour), a phone. The 3D look was judged from software-rendered screenshots only.
8. **Taps:** walk up, E, type, one button = 2 presses plus typing (was: leave the world). Measured in the headless run, not by a person.
9. **Identity debt left:** Level 4 (The Watch), quests as data, Storm Drill and the drill camp, Level 5.

## For Faiz after deploy
Open `/game3d`, walk to the keep door and go west: a desk and a shelf. Press E, write a real reason and wrong-if for one holding, save. Check: the shelf gets a book, the Standing card moves, and the Journal page shows the new entry (action Hold). Playtest question: can you find the desk in two minutes without being told? Check 60 fps with P.
