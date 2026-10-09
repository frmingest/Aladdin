# Game mode visual identity: why Circle and Council look plain, and the fix — 2026-10-09

Status: **proposed, nothing built, nothing changed in tracked files.** Source: three read-only agent passes (game-designer / art director, game-ux + feel audit, process drafter) over `origin/main` at `d4d0a70` and the unmerged agent-team branch. Judged from code only; **nothing was seen in a browser**, so every identity score below is an inference to confirm with screenshots.

## 1. Your observation is right, and it is systematic

- Circle (`CompetencePage.tsx`) imports no painted component: the "circle" is a 12 px progress bar, the rest is selects, inputs and lists. Council (`CouncilPage.tsx`) is one `Card` with a numbered list; the only drawing is the 44 px advisor portrait. Both only get the brown "study" colour skin.
- Across the game: Fortress scene, Marketplace, Store and the Scrolls library/reader score 3; Siege and Chronicle 2; Council, Records and the Map 1; Circle, the room tab strip and the Ledger 0. Five of eight fortress rooms are at 0–1 (Council, Records, Map, Circle and the tab strip). Details: [game-pages-identity-audit-2026-10-09.md](game-pages-identity-audit-2026-10-09.md).

## 2. Why it happened (process, not carelessness)

1. The 2026-10-01 scope decision made only the Fortress home scene a game screen; other pages were "re-skinned", i.e. recoloured.
2. The 2026-10-07 noise audit named Council and Records "the benchmark" and left them alone. Good for words, but it never asked for art.
3. The review agents check noise, accessibility and performance only. Nobody asks "does this feel like the game?".
4. No sprint item ever scheduled art for Council, Circle, Records, Map, Siege or Chronicle.

## 3. Low-hanging wins (all reuse existing parts, no new dependency)

**One edit lifts ~15 pages:** a game-mode banner inside `PageHeader` (`ui.tsx`): crest, title plate, torches.

**Council** (details in [circle-council-design-2026-10-09.md](circle-council-design-2026-10-09.md)):
- Agenda items become parchment folios with a wax seal (shape and glyph, not colour alone): ~3 h.
- Advisors seated with speech bubbles, reusing `Portrait` and the Marketplace bubble: ~2 h.
- "What the council cannot see" as a fog alcove: ~1.5 h.
- Hero: a round-table chamber with eight fixed seats, one per agenda kind. An empty seat is a neutral chair, never green; no gavel (implies a decision), no hourglass (timer), no "3 of 8": ~5–6 h.

**Circle:**
- Hero: a real ring map. Know sits inside the line, "partly" straddles it, outside is beyond it, unmarked is dashed fog at the rim, funds and gold are "not judged" by the gate. Marker size follows real weight; unknown is never smaller or fainter: ~6 h.
- Shape-coded three-state control replacing the `<select>`, boundary stones: ~2 h.
- Holdings list behind a disclosure to protect the word budget: ~0.5 h.
- Neutral colours instead of green/red for knowledge (green/red reads as a quality verdict).

**Map / Cartographer's table** (details in [map-design-2026-10-09.md](map-design-2026-10-09.md)). Today: two cards; fog is a 2 px green `bg-positive` bar, so a surveyed tower reads as a good one, and the reasons sit in hover-only tooltips. No map is drawn.
- Quick win 1 (~3 h): replace the green bar with five fog patches per tower, one per survey check. Fog is a hatched cloud with "?" (shape, pattern and glyph, never colour alone); clear is an empty ring; not judged is a dashed ring.
- Quick win 2 (~2 h): game header, parchment panel, shorter intro (about 48 words to 17), footer.
- Quick win 3 (~2.5 h): a tower slate showing the five checks with their reasons on press, so touch devices get them too.
- Quick win 4 (~3 h): commissions as numbered seals that plant flags on the towers they cover; the list stays as the accessible source of truth.
- Later PR (~6 h): the drawn realm map using the same tower layout as the home scene. Surveying never changes how a tower looks, there is no score or "n of 5", and fog returns when an analysis ages.

**Shared kit** (`components/fortress/kit/`): `GamePageHeader`, `Crest`, `ParchmentPanel`, `SealMark`, `FogPanel`, `HudBar`, `Speaker`, `TorchPair`. Records, Chronicle and Siege get most of the benefit from header + parchment + seal + fog (a few hours each). Other identity wins from the audit: draw the Map with fog, weather palette behind Siege and Chronicle, lamp and HUD on every room, emblems on the tab strip.

Suggested slice: kit + header (0.5 day), Council (1 day), Circle (1 day), Map wins 1–4 (about 1 day), then screenshots and look-and-judge. About 3–4 days; the full drawn Map is a follow-up PR.

## 4. Making the agents learn this (proposal, drafts ready)

Full files in `docs/game-identity-2026-10-09/process-proposal/` (also on your computer). Summary in [game-identity-process-changes-2026-10-09.md](game-identity-process-changes-2026-10-09.md).

- New standard `game-visual-identity.md`: a 0–3 identity ladder (a new or changed game page must reach 2 to ship), anti-patterns ("a Card with a list is not done"), the rule that visuals replace words, and a "direction memory" section describing the game's look so agents learn it.
- `game-designer`: every spec and idea needs a "visual verb + scene" line. `game-ux-designer`: gets a second lane, Game Identity, scoring before/after and blocking below 2. `game-feel-engineer` owns the shared kit. `frontend-engineer` builds from kit + pure mapping. `playtest-qa` screenshots every game page in game mode, Plain view and normal mode side by side.
- New `/game-ideas` command for idea gathering (each idea gets a page and a visual verb), updated `/game-review` with an identity table, and `docs/game-sprint-checklist.md` that every game sprint plan and review must answer. 8-line addition for CLAUDE.md.
- Deliberately **no** separate art-director agent: it would be a third verifier on the same diff. Ownership is split instead.

## 5. Decisions needed from Faiz

1. Approve building the kit + Council + Circle slice (and in which order versus C1 Siege back-test, D1, D2).
2. Neutral map palette for the Circle instead of green/red/amber? (Recommended.)
3. Council seats for inputs the council could not evaluate: add an additive backend field `kinds_unevaluated` so those seats show fog, or keep all non-occupied seats neutral for now?
4. Merge the agent-team PR (`feature/claude-agent-team-and-game-skills`) first, then apply the identity changes on top.
5. Add the CLAUDE.md game-identity lines.
6. Map: neutral palette instead of green (recommended); remove the "n of 5 surveyed" count from the map face (recommended); ship wins 1–4 first and the drawn map as a second PR? The Map design lists eight small decisions.

## 5b. Map decisions (Faiz, 2026-10-09)

Neutral palette (no green for clear): **approved**. "n of 5 surveyed" removed from the map face: **approved**. Wins 1–4 first, drawn map as a second PR: **approved**. The five smaller calls: **accepted as recommended** (see section 8 of the Map design). Still open: decisions 1–5 above for the Circle, Council, agent-team PR and CLAUDE.md lines, and the go-ahead to build.

## 6. Verify before building

Whether `Competence.sectors` lists every sector; whether `Council.as_of` is the snapshot date (a data-age candle would lie otherwise); the starting identity scores (re-score with real screenshots in the first `/game-review`). The local checkout `E:\Aladdin` is stale (`feature/currency-edit-and-nok-equivalent`, behind `origin/main`); build from fresh `main`.
