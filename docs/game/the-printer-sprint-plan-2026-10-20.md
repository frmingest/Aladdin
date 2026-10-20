# The Printer: sprint plan and Stitch picture list (2026-10-20)

Status: **Sprint P1 written, not merged, not deployed** ([P1 doc](printer-p1-ledger-engine-2026-10-20.md)); P2 to P5 not started. Decisions are in section 6. The 12 pictures in section 5 arrived 2026-10-20 and are not yet packed or wired. The style rules, truth rules and review checklist in [stitch-master-object-art-2026-10-11.md](stitch-master-object-art-2026-10-11.md) stay in force.

## 1. What The Printer is, in plain words

A new room in the fortress: the **Royal Mint**. A wall of brass levers. Each lever is a real tool central banks use. Pull one and the kingdom gets more or less money. Then you press a big **STAMP** button and watch what happens: coins flood or drain, the weather in the kingdom changes, and each of your own holdings reacts.

**Visual verb + scene:** *Stamp.* You stand at a brass lever wall in the Royal Mint, pull a lever and hit STAMP; coins pour into the kingdom or drain through the floor, the sky and tide shift, and each of your buildings reacts. The real fact it encodes: how much each of your holdings would move, as a range and a confidence tag.

It is a game of consequences, not a trading signal. Every number comes from fixed, sourced assumptions run by plain code (never by the AI), is shown as a range, and says how sure we are.

**How it was chosen:** three design teams competed (2026-10-20). Kingdom Mint (story and spectacle) won. Ideas borrowed from the other two: from Control Room, the "Tide: indirect" label and the five channel gauges; from Time Machine, "direction only when we are not sure", the lesson line at the end, a scored challenge, and history missions (later).

## 2. The levers (13)

"Tide" says whether the tool really changes the amount of money, or only nudges it indirectly. We say so on screen instead of pretending.

| Playful name | Real tool | Tide |
|---|---|---|
| Toll Gate | Policy rate (cut or raise) | Indirect (through borrowing) |
| Great Press | QE, bank buys bonds with new money | Up |
| Great Melt | QT, bonds run off | Down |
| Treasure Rotation | Operation Twist | Neutral on amount, flattens the curve |
| Vault Rule | Reserve requirements | Looser up, tighter down |
| Moat Loan Desk | Standing repo / discount window | Up when used |
| Vault Interest | Interest on reserves | Higher is down |
| Herald | Forward guidance | Indirect (moods move first) |
| Rate Cap | Yield curve control | Up while defending the cap |
| Below-Zero Cellar | Negative rates | Up, indirect, doubtful |
| Coin Rain | Helicopter money / monetary financing | Up, sharply |
| Harbour Guard | FX intervention (buy or sell krone), sterilised or not | Depends on the toggle |
| Builders' Fund | Bank lending programmes (TLTRO / BTFP style) | Up |

## 3. How it works (the honest part)

1. **Lever to world.** A fixed, versioned table says what each lever does to five things: the short rate, the long rate, expected inflation, the krone against the dollar, and credit spreads (plus the change in money amount where it applies). Every cell has low / base / high, a source, a date and a confidence tag (High, Medium, Low).
2. **World to holding.** Each of your holdings has a sensitivity profile: how rate-sensitive, how much debt, how much of its income is in dollars, whether it is tied to oil, salmon or gold, and its pricing power. Most of this already exists (sector tags, the beta every holding got in the Siege Simulator, moat data). Where a number is only guessed, it is marked Low.
3. **Result.** Per holding and for the whole book: a range in NOK, a "real terms" view (after the inflation effect), and a short why. **When confidence is Low we show only a direction, never a NOK figure.** Pulling levers in opposite directions is shown as "cancelling". Stacked pulls are capped and the screen says interactions are simplified.
4. **Nothing is saved to your real data.** The Printer overlays the fortress and never changes a stored rating, wall or portfolio figure.
5. **The AI only writes flavour lines** from numbers already computed (and in the first version the lines are hand-written, as decided for advisors).

Data already in the app that the Printer can start from: Norges Bank policy rate and 10-year yield, USD/NOK, EUR/NOK, Norwegian and US inflation, Fed funds, US 10-year, the US yield curve and high-yield spread. **Missing:** a money-supply (M2) series. The gauge can run on percent change without it, so this is not a blocker; adding a free series (for example from FRED) is a small optional step.

## 4. The sprints (what each is for)

A sprint here is one small, finished step you can look at, so we never build a big thing you have not seen. Each ends with a short summary and a git description, and goes through a feature branch and a PR for you to merge.

**Sprint P0, Decisions (you).** Done 2026-10-20, see section 6.

**Sprint P1, The Ledger and the engine (no pictures).**
*For:* getting the numbers honest before anything looks pretty.
*Build:* the lever-to-world table with sources (Claude researches and cites each cell, and marks thin evidence Low), holding sensitivity profiles from existing data, the five core levers (Toll Gate, Great Press, Great Melt, Coin Rain, Harbour Guard), an endpoint, and hand-checked tests.
*You see:* a plain page or JSON showing, for a chosen lever and size, the range per holding. Nothing playful yet.

**Sprint P2, The Mint Floor.**
*For:* making it playable.
*Build:* a new Game-mode page (`/fortress/printer`) with all 13 levers, the money gauge, the Realm Report (ranked holding cards with ranges, real-terms switch), and the Ledger of Truth (every assumption, source, date, confidence in one tap). A plain view stays behind a toggle as the fallback. Drawn with code art first; Stitch pictures slot in through the existing `?art=stitch|svg` switch.
The Realm Report updates the moment a lever moves (live preview), so the common task costs one tap and STAMP is the show, never a step you must take to see a number.
*You see:* pull levers, read the result. No animation yet.

**Sprint P3, The STAMP moment.**
*For:* the "wow".
*Build:* the STAMP button, coins flooding or draining, weather and tide in the kingdom, each holding reacting (Vår Energi's derrick spins, Salmon Evolution's pens wobble, the gold vault glows), sound with a mute switch, reduced-motion respected. The size of the animation follows the size of the computed effect, never the reverse. The Mint Master advisor speaks (hand-written lines, short and playful).
*You see:* the full experience. This is where the Stitch pictures matter most.

**Sprint P4, Lessons, challenge and the reign record.**
*For:* learning and replay.
*Build:* the five channel gauges (rates, liquidity, inflation expectations, krone, credit) between lever and result; a one-line lesson from the advisor (inflation is a hidden tax, own real things, pricing power is a moat); "Save this reign" into the Records Hall; an optional scored challenge that feeds the hit-rate view.

**Sprint P5, History missions (later, optional).**
*For:* the Time Machine idea. Replay 2008, 2020 and 2022 with your levers, next to what really happened, reusing the Siege back-test replay. Only if P1 to P4 land well.

## 5. Stitch pictures to generate

Paste the shared block from `stitch-master-object-art-2026-10-11.md` section 5 at the start of every prompt, attach `spire-granite` as the style reference, ask for **square, one object, pure white background, no text**. Code draws every fact (gauge level, glow, which lever is pulled, labels, weather, tide, reactions), so the pictures stay neutral.

### MUST (7), needed by P3 (the code-drawn version works without them in P2)

| # | What to show (short, non-technical) | Prompt subject line | Used for |
|---|---|---|---|
| P1 | **The printing press**: a big old brass-and-timber coin press with a heavy wheel on top and a flat stamping plate below | `Subject: a large brass and timber coin-minting press, a heavy spoked flywheel on top, a flat stamping plate underneath, riveted iron bands, teal accents, no coins on it, no figures, no text.` | The centrepiece of the Mint Floor |
| P2 | **One brass lever**: a tall lever with a round knob, resting in the middle position | `Subject: a single upright brass lever with a round cream-coloured knob, mounted on a small stone-and-iron base plate, resting in the middle position, no scale, no markings, no text.` | Shown 13 times; code tilts it up or down and prints the name |
| P3 | **The STAMP button**: a big round brass button in a stone frame | `Subject: a big round domed brass push button set in a square riveted iron frame, blank face, no text, no symbol.` | The main action button |
| P4 | **A pile of gold coins** | `Subject: a heap of plain round gold coins, about forty, blank faces with a simple raised rim, no symbols, no text.` | The "flood" and the money counter |
| P5 | **One gold coin**, front view | `Subject: a single plain round gold coin, blank face, raised rim, seen slightly from the side.` | Falling, flowing and draining animations (code copies it) |
| P6 | **The Mint Master**: head and shoulders of an original wise, kindly old master of coin, round spectacles, a plain cap, ink-stained cuffs | `Subject: bust of an original elderly mint master, round spectacles, plain cloth cap, calm half-smile, ink-stained cuffs, neutral pale background, same bust framing and outline as the Oracle and Partner busts. Original character, not resembling any real person.` | The advisor who comments |
| P7 | **The Mint crest**: a round medal with a coin press seen from the side | `Subject: a round gilded medallion crest, brass rim with a teal enamel centre, one simple raised symbol in cream: a coin press seen from the side. No letters, no numbers.` | The room's mark and the nav entry; same family as the other room crests |

### SHOULD (4)

| # | What to show | Prompt subject line | Used for |
|---|---|---|---|
| S1 | **Brass pipe, straight piece**, 3:1 wide, flat ends so copies join | `Subject: a straight brass pipe section with riveted flanges at both ends, 3:1 wide, flat vertical ends, empty, no steam, no text.` | The pipes from levers to the five gauges (P4) |
| S2 | **Brass pipe, elbow piece** (a 90-degree bend) | `Subject: a brass pipe elbow with riveted flanges, 90-degree bend, same style as the straight pipe.` | Same |
| S3 | **Floor drain**: a round iron grate | `Subject: a round iron floor drain grate with radial bars, seen from above at 30 degrees, set in a small stone ring, dark, no water.` | The Great Melt (coins drain away) |
| S4 | **Empty coin chest**, lid open, and a **full** one (two prompts) | `Subject: an open wooden treasure chest with iron bands, completely empty inside` / `...filled to the brim with gold coins` | Before and after on the Realm Report |

### Not requested, on purpose
- **Holdings reacting:** reuse the existing sector pictures and the gold vault; code adds the spin, wobble and glow (a picture must not carry a fact).
- **Weather, tide, sky, coin flow:** drawn by code.
- **Ledger book:** reuse the Records Hall book.
- **A background room picture:** skip for now; the existing candlelit study skin carries the room. Ask later if it looks bare.

Alt text empty, as with the other pictures; the page states each fact in words.

## 6. Decisions (Faiz, 2026-10-20)

1. **Where it lives:** its own room, entered from the Fortress like the others.
2. **Time span:** 1 year or 3 years, your choice on the page, "if feasible". It is: the coefficient table carries a value per horizon. The 3-year numbers rest on thinner evidence, so they are shown wider and more often tagged Low (direction only). Default: 1 year.
3. **Real terms:** plain and after-inflation figures side by side.
4. **Temperament meter:** yes, wild multi-lever pulls give a small nudge and a warning line.
5. **History missions (P5):** kept as later.

## 7. Risks and guardrails (summary)

- **False precision:** always ranges, whole percentages, confidence tags, "scenario, not forecast" on screen. Low confidence shows direction only.
- **Contested economics:** each cell cites its source; thin evidence is Low and shown wide. Money supply is not one thing, so each lever says which measure it touches.
- **Looks like advice:** permanent banner "a game of consequences, not a trading signal"; no buy or sell wording; no link to the recommendation or analysis engines.
- **Spectacle over truth:** animation size follows computed effect size.
- **Tag errors** (a holding mislabelled): the profile is visible and editable.
- **Cost:** no paid data or services; the table is static and versioned, like the Siege scenarios (`printer_v1.py` beside `siege_scenarios_v*.py`).

## 8. Game sprint checklist, section A (CLAUDE.md gate)

1. **Pages touched.** New: the Mint Floor (`/fortress/printer`). Touched lightly: Fortress home (entry), Records Hall (P4, saved reigns), temperament meter (decision 4, yes).
2. **Identity score before to after.** `Mint Floor | none (new) | 3 | scene header = the lever wall, signature object = the press, fact = per-holding range and confidence`; `Records Hall | existing | unchanged ≥2 | reign books reuse the book picture`. Identity debt is unchanged by this work.
3. **Visual win.** The press and lever wall with the STAMP moment: replaces a table of assumptions with pictures; encodes the per-holding range. The Ledger of Truth holds the detail behind one tap.
4. **Visual verb + scene:** *Stamp*, see section 1. Unknown look: a Low-confidence holding shows a fogged building with a direction arrow only.
5. **Words.** Realm Report: target 12 words per holding card; lever names are the playful names; every caveat goes in the Ledger of Truth or a tooltip. Voice: player verbs "Pull", "Stamp", "Flood", "Drain", "Keep this reign"; no methods language on the floor.
6. **Kit.** Reused: page-scene kit, book picture, sector pictures, vault, advisor frame, `?art=stitch|svg` switch. Added (owner game-feel-engineer): lever, coin-flow, gauge, weather/tide layer.
7. **Cut line.** If a sprint runs long, cut the sound and the weather layer, never the Plain view, the Low-confidence "direction only" state or the screenshots.
8. **Rules.** Truth: pictures carry no fact, reactions are code-drawn from computed ranges, unknown stays fog. Colour-blind: direction is shape plus word, never colour alone. Reduced motion: STAMP shows a still result. Performance: CSS/SVG only, coin count capped, no looping motion on idle.
9. **Taps.** Mint Floor, common task "see what a lever does to my book": 1 tap from a cold load (the report shows a default lever pre-set and updates on each pull); STAMP is optional and adds no step.
