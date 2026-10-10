# Aladdin → Stitch hand-off pack (2026-10-10)

How to use: paste **Part 1** once as the project's design brief / design system in Stitch. For each screen, paste **Part 2** for that page, then add what you want improved and the **Output format** block at the end. Check any output against **Part 3** before it goes anywhere near the app. Stitch makes images/screens; the app's art is hand-coded SVG/CSS, so treat Stitch output as direction and reference, not as drop-in files.

Status: a planning doc. Nothing here is built into the app. The AI art pack (PR #94) was merged and then reverted by #95 at Faiz's request, so `main` has no AI-generated art.

---

## Part 1. Global design brief (paste once)

**App.** Aladdin: a personal value-investing advisor. In "game mode" the user's real portfolio is a fortress: each stock is a tower, the whole app is a candlelit study. It must look like a strategy game on every page (painted fortress, scrolls, ravens, wax seals), never like a normal dashboard with a sepia filter.

**Mood.** Candlelit medieval study, hand-painted, warm, quiet. Not neon, not cartoon, not pixel art, not stock fantasy.

**Palette (dark, default).**
- Background `#140F0B`, surface `#1F1812`, raised `#2A2119`
- Border `#4A3B2C`, subtle border `#34291F`
- Text `#EEE4D3`, muted `#BBAC96`, faint `#92836F`
- Accent gold `#D6A85A`, hover `#E8C480`, accent wash `#382B18`
- Gold metal gradient `#FFF0B8` → `#D9A93E` → `#6E4A12`; dark ink `#2A1A06`; wax red `#7A1D18` (seal)
- Light variant (parchment): background `#ECE3D0`, surface `#F6EFE0`, ink `#291F14`, accent `#926218`
- State colours stay standard: green = good, red = bad, amber = caution. Never recolour them, and never show status by colour alone (add shape, icon, pattern or text).

**Type.** Headings: Marcellus (flared serif, one weight, no faux bold), fallback Palatino/Georgia. Body: clean sans. Numbers tabular. No other font families.

**Components already in use.** Gilded thin panel edge with a faint warm sheen at the top; small gold lozenge before section titles; dark iron frame with gilded inner rule and four cast corners; parchment folio panel; dark "night" panel; wax seal; room crest (shield with a glyph); page banner with title plate, crest left, actions right; scroll with wooden rollers; fog patch for "unknown".

**Layout.** Left sidebar, tab strip of eight rooms across the top (Fortress, Marketplace, Siege Simulator, Chronicle, Council, Records, Circle, Map), then a room banner, then the page. List the rooms once, not in both the sidebar and the tab strip. Desktop first, must work at phone width (touch targets 44 px).

**Hard rules.**
1. Art may not make a weak or unknown fact look good. Unknown = fog, grey or "?".
2. No buy/sell/rebalance language, points, streaks, timers or rewards.
3. Every page needs a plain version with the same facts as labelled blocks.
4. No looping animation as identity (no pulse); static composition first. Reduced motion respected.
5. Visuals replace words, they do not add paragraphs or taglines.
6. No emoji as icons. No invented numbers, quotes or analysis text: use obvious placeholders ("0.0%", "Lorem") for sample data.
7. Text no smaller than 12 px.

---

## Part 2. Per-room briefs (paste the one you are working on)

Every room's job and the real facts its picture is allowed to carry. Anything not listed must stay decoration.

**Fortress (main painting).** The realm at a glance. Towers = holdings (height by weight class, wall material = balance-sheet strength, a crack = the "knife-edge" warning), moat = moat rating, enemy camp on far hills = siege weather (calm / gathering / besieged), fog = not yet surveyed, ravens = new reports, lamp and genie = help. A resource bar above shows realm value, vault, tower count, weather, temperament. Already the strongest page; improve polish, not concept. The tower count in the bar must equal the towers drawn.

**Council.** A quarterly review room. Shows what the fixed rules put on the agenda and what the two advisers say (Oracle: the owner-minded scholar; Partner: the sharp-eyed sceptic). Facts: items with a tone, which holdings they concern, lines from each adviser. Do not show a number of seats or figures that is not the real count of items/advisers.

**Circle (Circle of Competence).** A ring map: holdings placed by how well the owner understands them, inner = well understood, outer = not. Facts: ring position, size by weight. Night-chart palette (dark, star dots, warm vignette). Do not draw rings or points that are not real data.

**Records.** The decision journal as a hall of tomes: what was written, what the price did, which reviews are owed. Facts: one tome per entry, wax seal state (reviewed or owed). Do not bake in a count of tomes or scrolls.

**Chronicle.** The fortress replayed through time, plus "what the record cannot show" (days the worker was off). Facts: dates, changes, gaps. Gaps must look like gaps, not like quiet days.

**Siege Simulator.** Stress test: what would a market fall do to the towers. Facts: scenario, per-tower result, siege level (calm / gathering / besieged). Weather and camp size must match the real level; never draw calm for an unsurveyed realm.

**Map (Cartographer).** A fantasy continent: provinces = sectors, settlements = holdings, fog patches over what is unsurveyed, pan/zoom. Do not bake fog patches into a background: fog is data.

**Marketplace and Store.** Booths = holdings or instruments; Sal the sales rep. Facts: price, holding, status. Keep the booth identity; no promotional wording.

**Scroll reader and Scrolls library.** Reports open as a parchment scroll behind a wax seal, with rollers; the library is rolled scrolls on wooden shelves, one per period. Seal broken/unbroken = opened or not.

---

## Part 3. Review checklist for anything Stitch produces

- [ ] Palette within Part 1; state colours unchanged; no extra fonts or colours
- [ ] No baked-in numbers, counts, fog, weather, figures or status that real data would contradict; counts agree with each other
- [ ] No invented analysis text, quotes or advice
- [ ] Status readable without colour
- [ ] Works at phone width; 44 px touch targets; 4.5:1 text contrast; text 12 px or larger
- [ ] Fewer words than before, not more
- [ ] A plain version is possible with the same facts
- [ ] Static (no looping motion)
- [ ] No emoji icons; no buy/sell/rebalance wording
- [ ] Not a Card-with-a-list: a scene header or bespoke illustration, plus one real fact encoded visually

---

## Part 4. Files to upload or point Stitch at

Design rules: `.claude/standards/game-visual-identity.md`, `.claude/standards/game-ui-standards.md`, `docs/game-sprint-checklist.md`

Design reasoning: `docs/game-visual-identity-2026-10-09.md`, `docs/game-pages-identity-audit-2026-10-09.md`, `docs/game-design-challenge-2026-10-09.md`, `docs/game-identity-kit-council-2026-10-09.md`, `docs/game-identity-circle-2026-10-09.md`, `docs/game-identity-map-2026-10-09.md`

Tokens and styles: `frontend/src/index.css` (skin tokens around line 58; frame ~306; scroll reader ~737; page kit ~880; night panel ~915), `frontend/src/components/fortress/dispatchSeal.css`

Screens to show as reference (best done by Faiz, from the live app with real data): one screenshot per room at desktop width and one at phone width.

Code that draws each room (reference only): `frontend/src/components/fortress/FortressScene.tsx`, `sceneWorld.tsx`, `GameFrame.tsx`, `kit/GamePageHeader.tsx`, `kit/Crest.tsx`, `kit/ParchmentPanel.tsx`, `kit/NightPanel.tsx`, `kit/CouncilChamber.tsx`, `kit/CircleMap.tsx`, `kit/HallOfRecords.tsx`, `kit/RealmMapBody.tsx`, `kit/WorldMap.tsx`, `kit/FogPatch.tsx`, `kit/SealMark.tsx`, `components/marketplace/MarketArt.tsx`, `SalesRepArt.tsx`, `components/ScrollStage.tsx`, `ScrollsLibrary.tsx`, `LampLogo.tsx`

Earlier Stitch material (Claude project): `claude/stitch-art-prompts-2026-10-09.md` (prompt library and style bible), `docs/art-pack-trial-2026-10-10.md` (what was tried and dropped, and why).

## Output format (paste at the end of each Stitch prompt)

```
Output format:
1. One screen per result, 1440 px wide desktop, plus a 390 px wide phone version.
2. Export as PNG and as a single self-contained HTML file with plain CSS or Tailwind and no JavaScript frameworks. Put every colour in CSS variables at the top, using the palette above. Make the layout responsive, not a fixed pixel width.
3. Use real text as live HTML, not baked into an image. Mark all sample numbers as sample.
4. Any illustration is a separate element: its own PNG, flat plain background, one object per image, no text, no figures, no fog, no counts.
5. List the fonts, hex colours and spacing values you used.
```

## Lessons from the first Stitch round (images)
- Stitch bakes in things you did not ask for (fog patches, three seated figures, tent counts, a seal symbol). Say "no figures, no fog, no counts, no text" in every prompt.
- Ask for one element at a time on a plain background; tiles and transparency are not reliable.
- It had no aspect ratio control; crop afterwards.

## Lessons from the second round (Fortress screen, desktop HTML + PNG)

Format worked. Worth keeping: iron panel with small square gold corner studs and a thin inner rule; resource bar layout (small-caps label over large value); the tower row with masonry textures, a dashed "?" fog tower and a crack drawn as a shape plus the words "Crack Alert"; plain ledger table; legend row.

Broke our rules (put the fixes in the next prompt):
- Invented facts: sample figures, a rates value, "interest coverage 2.1x EBIT", and an LLM-style quote with a "+34.2% Discount". The header said 8 keeps while 7 towers were drawn.
- A baked single-castle backdrop that reads as "your fortress" while the real fortress is the tower row; its weather text used terms the app does not have (the app: calm, gathering, besieged).
- Many new words (taglines, a "Value Canon", "Study Atmosphere", a "Sovereign Regent" label).
- Emoji used as icons, a "Rebalance Keep" button (trade wording), a pulsing dot (looping motion), 8-10 px text.
- Fixed 1440 px width with no phone version; the eight rooms listed in both the sidebar and the tab strip; extra fonts and a teal moat colour outside the palette; a Google-hosted background image link that may expire.

Next step (Faiz to choose): re-prompt Stitch with the fixes above, or port only the good parts (iron-panel corners, resource bar) into the app behind a switch.
