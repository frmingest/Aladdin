# 3D text and labels: proposal and sprint plan (2026-11-08)

Game design team (game-designer, game-ux-designer, game-feel-engineer), from Faiz's screenshots of 2026-11-08 (Siege Field at `/game3d?at=siege`, the old battlefield, the siege wall from the side, the Exxon holding land). Plan only, no code yet. Built or not built was checked on `main` at `0a6511a` (#305) by grep, not in a browser.

## 1. What is wrong (from the screenshots and the code)

| # | Finding | Where | Cause |
|---|---|---|---|
| F1 | **White text vanishes on the light sky.** "Apple Inc.", "JPMorgan Chase & Co", "-31.5%", "The old battlefield" are pale text with no plate on a pale sky and mist. | Siege Field, Battlefield, Town, Quarter arch, Siege gate, Market Quarter | `className="g3d-nameplate"` is used 14 times (SiegeField 7, Battlefield 3, Town, QuarterArch, SiegeGate, MarketQuarter 1 each), but **no CSS defines it**. The labels fall back to unstyled text. A bug, not a style choice. |
| F2 | **Black boxes look like debug tags.** A black rectangle with white text, sitting over painted wood and grass, reads as a dev overlay, not a game. | 15 places: NPC names ("· press E"), "Door · back outside" in Library, Town Hall and Records Hall, Land ladder, gate stone, stream band, Library bays | Ad-hoc Tailwind `bg-black/65 text-white`, a different recipe in each file. |
| F3 | **Paragraphs float in the sky.** "Fog over 1 tower. Too little price history; left out of the total." wraps into a one-word-wide column and shrinks to unreadable. | Siege Field fog title, gate stone, Town Hall / Records Hall notes | A sentence placed in an `Html` label with no width and `distanceFactor` scaling. Long text belongs in a panel. |
| F4 | **Far labels shrink to specks, near ones crowd.** Ten tower names and ten percentages show at once from anywhere on the field; at range they are 6 px. | Siege wall from the side, Library shelf tags ("? The Council") | `distanceFactor` keeps shrinking with distance; nothing hides a label that is too small to read. |
| F5 | **Labels ignore the world.** Names hover in the sky over the wall rather than being on it, and show through scenery. | Siege wall, holding land | `Html` overlays are drawn on top of the canvas. The tower signboards (`TowerMesh.paintSign`) are the one place text is painted into the world, and they read best. |

Identity score for text today: about 1 (it works as a label, but nothing about it says "game", and F1 fails the truth rule because a number that cannot be read is a number not shown).

## 2. The proposal: three kinds of text, one family

Game rule we copy from RPGs: **names live on things, prompts live on the HUD, sentences live in panels.** Nothing floats as bare text.

### A. Painted signs (names that never move)
Building names, siege wall sections, tower names, the Records house, the Quarter arch, "The old battlefield". Painted onto a plank, banner or stone in the world with a canvas texture, the way the tower signboards already are. They sit behind walls, they get smaller like any object, and they look like part of the town.
- Shape by place: hanging plank (town buildings, shops), cloth banner (siege wall sections, the battlefield), carved stone (gate stone, land markers).
- Ink `#2a1a06` on cream `#F6EFE0` with a timber rim, the Stitch outline `#26253B` round the plank. Name in the display face (Marcellus).
- Numbers that belong to the object are **chalked on it**, not floated over it: the siege loss "-31.5%" chalked on the wall section under the name, in tabular figures, with the state colour as a stripe and a glyph (▼), never colour alone.

### B. Nameplates (things that move or that you are near)
NPC names, a holding's name when you walk up to it, shelf tags in the Library. One shared component, **parchment tag**: cream parchment, ink text, a thin gold-brown rim and a soft drop shadow. Light enough to be a game object on the dark interiors, dark-rimmed and shadowed so it holds on the light sky. It replaces both the undefined `g3d-nameplate` and all 15 black boxes.
- **Show only what is near.** Full size within about 12 m, fades out from 12 to 18 m, hidden beyond. The thing you face or have targeted always shows. No more ten labels at once.
- **Never smaller than 12 px on screen.** A label that would get smaller hides instead of shrinking.
- Unknown stays fog: a grey parchment tag with a dashed rim and a "?" seal, never a number.

### C. Prompts on the HUD (what you can do now)
"Press E", "Door · back outside", "Back to the Town": these are actions, so they move off the objects into **one key-cap prompt at the bottom centre of the screen**, as in most third-person games: `[E] Talk to the Oracle`, `[E] Back to the Town`. Only the nearest action shows, one at a time. The NPC tag goes back to being just a name.

### D. Sentences go into panels
The fog explanation, the gate-stone text and the hall notes leave the sky. In the world: a fog seal with "?" and a two-to-four-word title ("1 tower in fog"). The full sentence is in the object's panel when you press E (Siege Field: the existing Siege yard panel).

### The mapping (pure, tested)
`frontend/src/game3d/labelPlan.ts`: `labelFor({kind, distance, focused, fog}) -> {tier: "sign" | "plate" | "prompt" | "hidden", opacity, fog}`. Unknown always gives the fog look; distance never turns a fog label into a number. Tokens in one place (`gameTokens.ts`), with a unit test that each text/plate pair is 4.5:1 or better.

### Visual verb + scene
**Sign and seal**: names painted on planks and banners in the scene, numbers chalked on the object they describe, unknown as a "?" fog seal; actions as one key-cap prompt on the HUD. Words deleted: every "· press E", every "Door · back …" label, the floating fog sentence, the duplicate name + percentage over each wall section. Identity score for 3D text: 1 → 3 (signature object: the chalked banner on the siege wall).

## 3. Sprint (five small PRs)

| PR | Item | Files (expected) | Done when |
|---|---|---|---|
| T1 | **Label kit and the F1 fix.** `WorldLabel` (parchment tag) and `labelPlan.ts` with tests; tokens and a contrast test; swap the 14 `g3d-nameplate` and the 15 black boxes. | `game3d/WorldLabel.tsx`, `labelPlan.ts`, `index.css`, the 14 files | No bare or black-box label left (grep); every label readable on the light sky. |
| T2 | **HUD prompt.** One `[E]` key-cap prompt for the nearest action; remove "· press E" and the door labels. | `ActionPrompt.tsx`, `NpcMesh`, `Library`, `TownHallRoom`, `RecordsHallRoom` | One prompt at a time; phone shows a tap button with the same words. |
| T3 | **Painted signs.** Generalise `paintSign` into `signTexture.ts` (plank, banner, stone); siege wall sections get a banner with name and chalked loss; town buildings, Quarter arch, battlefield, gate stone get planks or stones. | `signTexture.ts`, `SiegeField`, `Battlefield`, `Town`, `QuarterArch`, `SiegeGate`, `HoldingLand` | Names sit on the objects; percentages are on the wall, not in the sky. |
| T4 | **Declutter.** Near-only reveal and 12 px floor; sentences moved into panels with a fog seal in the world. | `WorldLabel`, `SiegeField`, `siegeYardWordsV3.ts` (new version, V2 untouched), `HoldingLand` | From the siege camp at most about 3 nameplates show; no sentence in the sky. |
| T5 | **Look and judge.** Before/after screenshots of Faiz's four spots plus Library, Town Hall and the Town at night; fps with P. | Review doc | Checklist section B answered. |

**Status (2026-11-08):** T1 built, written and tested, not yet deployed: `WorldLabel`, `labelPlan.ts` (tested, not wired until T4 turns on the near-only reveal), `gameTokens.ts` with the contrast test, and all 29 labels swapped (grep finds no `g3d-nameplate` or `bg-black/` in world labels). T1 took the recommended defaults for decisions 1 and 2. T2 is built on top of T1 in its own PR: `ActionPrompt` splits "Press E to ..." strings into a key cap and the action, the NPC tag is a plain name, the three "Door · back ..." labels are gone (the page already shows the door prompt), and a tap on the prompt sends E.

**T3 (2026-11-08, written, not yet deployed, not seen in a browser):** `signTexture.ts` (one painter for plank, banner and stone; `chalkFor` is tested: loss is a stripe plus glyph plus number, unknown is a "?" seal with no number; chalk-on-board and ink-on-stone pass 4.5:1) and `WorldSign.tsx`. Applied to: siege wall sections (banner with name and chalked loss), fog ghosts (fog seal), Town door planks on a two-post sign, Quarter arch, siege gate, holding-land gate stone and records house, and the Battlefield title. Left as T1 plates for T4: the battlefield row notes, the board sentences under the title, the gate-stone note, the tent text, winch, marker stones, yardstick banners and the fog sentence. The three older `paintSign` copies (`TowerMesh`, `Booths`, `MarketQuarter`) are untouched and can fold into `signTexture` later.

Cut line: T3 for the Market Quarter and the Library bays (they keep the T1 parchment tag). Never cut: the fog look, Plain view, the screenshots.

## 4. Checklist section A

1. **Pages touched:** `/game3d` Courtyard, Town, Siege Field, Battlefield, Market Quarter, Library, Town Hall, Records Hall, holding land.
2. **Identity before → after:** 3D text 1 → 3. Pages themselves are unchanged in score; the text stops pulling them down.
3. **Visual win:** chalked banner on each siege wall section (fact: modelled loss per holding).
4. **Visual verb + scene:** section 2 above.
5. **Words:** Siege Field in-world words about 60 → about 25 (names and numbers only). Voice: "1 tower in fog", "[E] Talk to the Oracle", "[E] Back to the Town".
6. **Kit:** new `WorldLabel`, `ActionPrompt`, `signTexture` (owner game-feel-engineer); reuses `paintSign`, `PAL`, `Inked` outline.
7. **Cut line:** section 3.
8. **Rules:** numbers stay exact, unknown is fog, a loss is a stripe plus glyph plus number (colour-blind safe), the label fade is skipped under reduced motion (labels just show or hide), canvas signs are made once per name (no per-frame repaint), and `Html` overlays drop from about 29 to about 10, which should help frame rate.
9. **Taps:** unchanged at 1 (walk up, press E); the prompt makes the action visible without hunting.

## 5. Decision needed from Faiz

1. **Plate style:** parchment tag (recommended, holds on both light sky and dark halls) or dark timber with cream text (closer to the flat Market Street nameplate).
2. **Siege percentages:** chalked on the wall (recommended) or kept as a nameplate above it.
3. **Reveal distance:** about 12 m for nameplates, or always show every name on the field.
4. **Order with text pass 4:** do T1 first (it fixes a real bug), then text pass 4, then T2 to T5. Or the other way round.
