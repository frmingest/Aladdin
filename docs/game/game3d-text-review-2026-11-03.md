# 3D game text review: every line a player reads

Date: 2026-11-03. Scope: `/game3d` (the 3D courtyard, Town, Town Hall, Library, Market Street, Siege Yard, Vault, Night Watch, desk and quests). Review only: no code was changed.

## What we did

A script pulled every piece of player-facing text out of the 3D code, including the shared cards the 3D panels reuse. Six design reviewers (game-designer and game-ux-designer roles) then read each line in its source, worked out where the player sees it, and scored it 0-3 on three questions:

- **Theme**: does it sound like the painted-fortress world?
- **Engaging**: is it short, plain, playful, a verb for the player's act?
- **Clear**: could someone with no finance background get it on first read?

Scale: 3 = ship as is, 2 = small polish, 1 = needs a rewrite, 0 = blocker. Every line below 3 got a rewrite in game voice (numbers stay exact, unknown stays fog, no buy or sell wording). The full table, with every line, its score and its rewrite, is in the spreadsheet `game3d-text-review-catalogue-2026-11-03.xlsx`.

## The result in numbers

| | |
|---|---|
| Lines catalogued | 1,341 |
| Lines a player can actually see in 3D | 1,118 (the rest are flat-mode-only, code, or hidden) |
| Average theme / engaging / clear | 2.30 / 2.12 / 2.17 out of 3 |
| Lines scoring 3 on all three | 333 (30%) |
| Lines with at least one score below 3 | 769 (70%) |
| Lines marked rewrite | 605 |
| Lines marked cut or move | 40 |
| Lines that score 1 or less on "clear" | 243 |
| Lines that score 1 or less on "engaging" | 237 |

By area (theme / engaging / clear):

| Area | Lines | Theme | Engaging | Clear |
|---|---|---|---|---|
| Journal, quests and advisors | 168 | 2.49 | 2.39 | 2.47 |
| Market and booths | 227 | 2.48 | 2.23 | 2.22 |
| Vault, Night Watch and ravens | 143 | 2.36 | 2.31 | 2.34 |
| Navigation and HUD | 144 | 2.22 | 2.10 | 2.42 |
| Towers and Library | 170 | 2.31 | 2.06 | **1.77** |
| Siege, realm and lamp | 250 | **2.02** | **1.80** | 1.94 |

The world's own words work. Place names, the "Press E to..." prompts, "Raising the walls...", "Gold, silver and friends.", Sal's "Hold your hat" and "Who whispered it?" are the voice to copy. The trouble starts when a panel reuses a flat-mode card or shows text the backend wrote.

## Why the other 70% falls short: six causes

1. **Finance words leak in.** Margin of safety, thesis, tripwire, beta, EBITDA, net debt, interest cover, return on equity, stale, filing, stagflation, churn, invalidation. Worst clarity is on the Library shelves, the Siege results and the store gates.
2. **One thing, many names.** The reason you own a company is called thesis, reason, why, both lines and wrong-if. A review is a reckoning, a look-back, a review and a check. The flat page is the flat page, the flat fortress, the flat view and Plain view. The Where-to menu says "Margin of safety" while the Town Hall board for the same page says "Cushion".
3. **Walls of words above the play.** Footnotes of 33 and 44 words, four-sentence disclaimers under every dialog, a panel title repeated by the card inside it.
4. **System voice.** "stored", "queue", "frames stored", "the server refused the request", and one error that says "Could not load your journal" when a save failed. Some backend sentences reach the player raw.
5. **Buy and sell flavour.** The Library shows the raw "Last verdict" (it can read Buy, Sell or Avoid). The Realm panel counts "Strong Buy ... Avoid". Verdict labels say "Wait for the price" and "Pass for now". The desk footer says "real buys or sells". The game rules forbid this wording.
6. **Unknown is worded five ways.** "not surveyed", "not stored", "not analyzed", "no stress result stored", "cash not entered". Fog is already the game's word for unknown.

## Bugs found while reading (verified in the source)

- `hallPrompt` builds "Press E at the **The** Big Board board" (the title already starts with "The"), and "the Purse and Scoreboard board".
- Pressing the Stats button puts "{fps} fps · {draws} draws · {k}k tris" in the toolbar. It is a developer readout (scored 0/0/0).
- `QuestLog` adds a full stop to Standing lines that already end in one ("Nothing is known..").
- The save error says "Could not load your journal" for a failed save (`describeError` always says load).
- A failed look-back save in the old-books panel shows nothing at all.
- The tip-note error in the Hype Booth is set but only shown in two of the phases, so the player never sees it.
- The quest says "no written reason" while the quest counts a holding as missing if it lacks the why or the wrong-if line. The wording and the count disagree.
- Two strings (`STREET_EMPTY`, `SOON_AS`) have no call site. An empty Market Street gives no hint toward Sal.

## The better structure: Sign, Line, Look closer, Rules

Today every panel mixes all five kinds of text at one volume. The proposal is to give each kind its own place, size and word budget, so the player reads the first layer and only digs if they want to.

| Layer | What it is | Where it sits | Budget | Example |
|---|---|---|---|---|
| **Sign** | The name of a thing | Painted or floating in the world, plates, tabs, buttons | 3 words | "Granite walls" |
| **Line** | The one answer, with its number | Top of the panel, large | 1 short line | "Strong walls" |
| **Caption** | One plain sentence that says why | Under the line | 12 words | "Debt is 1.4 times yearly profit." |
| **Look closer** | The jargon, the exact number, the source | Hover or tap, never on the page face | 1-2 sentences | "EBITDA means yearly operating profit before interest and tax." |
| **Rules** | Method, data gaps, disclaimers | One "Rules" foldout per panel | no limit | "Built from your saved analyses. Not advice." |

Panel anatomy, top to bottom: the picture (tower, shelf, wall) -> **Line** -> **Caption** -> a small "Look closer" mark on any jargon -> one "Rules" foldout -> one close button. No paragraph sits above the play.

House rules that every line follows:

1. **Answer first.** The first words are the answer, then the reason.
2. **One word per idea.** Use the glossary below, in every area, including menus, prompts, plates and dialogs.
3. **Unknown is fog.** Say "in fog" or "not checked yet", never "not stored" or "not surveyed".
4. **One failure phrase.** "Can't read X right now. Try again." and "Couldn't save that. Try again." No server words, no error codes on the face (they go in Look closer).
5. **One close verb per kind of panel.** "Step away (E)" for desk and drill, "Goodbye (E)" for dialogue, "Close" for readers.
6. **Numbers as people say them.** "1.4 times yearly profit", "4% over", "3 of 5 torches lit". Digits stay exact.
7. **No commands in player lines.** A shell command ("python -m app.worker") belongs in Look closer.
8. **Pictures replace sentences.** Where a mark, torch or colour already says it, delete the sentence.

### Before and after (all from the review; the full list is in the spreadsheet)

| Where | Now | Proposed |
|---|---|---|
| Where-to menu | Margin of safety | Cushion (hover: "How far price sits from fair value") |
| Where-to menu | Thesis monitor | Reasons |
| Town Hall prompt | Press E at the The Big Board board | Press E to read The Big Board |
| Market stall plate | In range · +4% | In reach · 4% over |
| Library, Walls shelf | net debt is 1.4x EBITDA (granite: 1x or less) | Debt is 1.40 times yearly profit. Granite means 1 or less. |
| Library, Walls label | net debt / EBITDA | Debt vs yearly profit |
| Library, Land shelf | Last verdict: Buy | Cut from 3D (see decisions) |
| Siege results | Weighted beta | Sway (hover: "1.0 moves with the market") |
| Siege results | Differs from the stress case | Fortress test disagrees (hover has the long note) |
| Siege results | At this fall the modelled book crosses the storm line. | Crosses the storm line. |
| Storm Drill | no stored beta, so it is not modelled | Not enough price history to test it. |
| Realm weather line | macro regime: stagflation | Prices rising while growth stalls |
| Temperament | Churn / Sold an intact thesis | Too much shuffling / Left a plan that still held |
| Night Watch stamp | Watch: 3h ago · 120 frames stored | Last look 3h ago. (hover: 120 readings saved) |
| Wire status | tripwire fired | wire rang |
| Store gate | The valuation was computed, then withheld as not credible against the price. No number is shown. | The worth estimate looked wrong next to the price. No number shown. |
| Store gate | Return on equity | Profit on owners' money |
| Advisor (Marlie) | Invert it. A holding with no written reason is one you can never be shown wrong about... | No why on paper? Then nothing can prove you wrong. Convenient. |
| Save error | Not saved: Could not load your journal. | Couldn't save that. Try again in a moment. |
| Quest card | Unwritten Thesis | Write Your Whys |
| Quest chip | Open | To do |

### How to build it so it stays fixed

- **A wording file per place, with all five layers.** Extend the existing `*WordsV1.ts` files to `*WordsV2.ts` with `{ sign, line, caption, look, rules }` per object. New version files, not in-place edits, in line with how the standing words already go V1, V2, V3.
- **One glossary file.** The table below as code, used by every wording file, so a word is changed in one place.
- **A game-voice layer for the reused flat cards.** Vault, ravens, Night Watch, temperament, realm verdict and the store gates are the flat cards in a frame, so flat wording leaks. Give the shared cards a `voice="game"` option; flat mode keeps its neutral wording (the standard says plain view stays neutral).
- **A guardrail test.** A unit test that fails if a 3D string breaks the word budget for its layer, or uses a banned word (thesis, tripwire, beta, EBITDA, "flat page", "stored", "Buy", "Sell", "Avoid") on the page face. This is the same idea as the existing word budgets and noise audit.
- **Backend text.** Night Watch lines, Council (advisor) lines, standing labels and wire labels are written by the backend. They need a new versioned wording on that side, and the Night Watch card finds its "new report" lines by matching the backend's own wording, so both sides must change together.

## Glossary: one word per idea

| Finance word | Game word | Where it lives |
|---|---|---|
| Thesis, reason, rationale | **why** | scroll |
| Invalidation, wrong-if line | **what proves me wrong** | crack in the wall |
| Review, reckoning, 6-month review | **look-back** | hourglass |
| Tripwire, alert | **wire** (it rings; "I have looked") | wire in the courtyard |
| Margin of safety | **cushion** | wall / cushion |
| Stress test, what-if loss | **Storm Drill**, "what the fall does" | siege camp |
| Drawdown, market drop | **fall** (30%) | storm |
| Weighted beta | **sway** (hover: how hard market swings hit it) | storm gauge |
| Balance-sheet strength | **walls** (strong, fair, stretched, weak) | Walls shelf |
| Competitive advantage | **moat** ("rivals struggle to catch up") | Moat shelf |
| Bear, base, bull case | **low, middle, high case** | price board |
| Fair or intrinsic value | **worth estimate** | scroll |
| Rating (Buy, Hold, Sell) | **the analyst's mark** (top, middle, low), never the label | seal |
| Net debt / EBITDA | **debt vs yearly profit**, in times | walls |
| Interest cover | **times profit covers interest** | walls |
| ROE, ROIC | **profit on owners' money, on money put in** | engine |
| Position size, weight | **share of the fortress** | tower size |
| Sector | **line of business** | sign |
| Macro | **The Wide Weather** | weather |
| Policy rate | **main interest rate** (hover: set by Norges Bank) | coin |
| Not surveyed, unknown, not stored | **in fog** / **not checked yet** | fog |
| Stale | **old figure** | hourglass |
| Intact | **still stands** | tower |
| Filing, annual report | **report** | scroll |
| Dispatch | **Night Watch note** | lantern |
| Snapshot, frames stored | **saved looks, readings saved** | map |
| Demo data | **Sample fortress** | banner |
| Flat page, flat fortress, flat view | **Plain view** | page |
| Standing, level | **torches lit** (3 of 5) | torch |
| Low confidence | **few clues yet** | fog |
| Churn | **too much shuffling** | dust |
| Stagflation, regime | **prices up, growth stalled** | weather |

Two places the reviewers disagreed, and the choice made here: tripwire is "wire" (not "bell" or "alarm"), because the courtyard already has wires; "Plain view" beats "plain reader".

## Decisions for Faiz

These touch the game rules or the backend, so they are not mine to settle.

1. **Cut "Last verdict" from the Library Land shelf, and the analyst-verdict block from the Realm panel?** Both can print Buy, Sell or Avoid. Suggested: cut both from 3D, or show only the mark (top, middle, low) with the stored label in Look closer.
2. **Where-to menu names.** Move to the world names (Cushion, Reasons, The Wide Weather) with the flat name in a hover?
3. **Open stores inside the world panel** instead of the "Enter the store" and "Watch the queue" buttons that leave `/game3d` for flat pages?
4. **Backend wording pass.** Night Watch lines, Council lines, standing labels and wire labels. This needs a backend version and a matching change in the Night Watch card.
5. **Advisor voices.** Barren Wuffet warm and in full phrases, Marlie Chunger clipped and dry ("Convenient."). OK?
6. **Remove the Stats readout** from the player toolbar (or put it behind a debug flag)?

## Suggested order of work

1. **Quick fixes (one small PR):** the bugs above, remove or flag the Stats readout, hide the doubled panel titles, use a single "…" for loading text.
2. **Names (one PR):** the glossary file, menu and prompt names, close verbs, one failure phrase.
3. **The worst panels first:** Siege results and Realm panel (2.02 / 1.80 / 1.94), then the Library shelves (clear 1.77), then the store gates.
4. **The game-voice layer** for the shared cards (Vault, ravens, Night Watch, temperament).
5. **Backend wording** once decision 4 is made.
6. **The guardrail test**, so it stays fixed.

## What this review did not cover

- **Sal's and the Hype Booth's speech lines, the symbol hints and the "Who whispered it?" options.** They live in `lib/salesRep.ts` and `lib/hype.ts`, which were not in the staged copy. They hold the main spoken text of the market, so they need their own pass.
- **The embedded store page** (`embed=world`) and the other Town Hall pages. They carry the normal app's wording, which the standard keeps neutral. The store gates inside them are the exception, reviewed through `lib/marketplace.ts`.
- **Backend-written text.** It appears in the catalogue as "keep, backend" lines.
- **Sixteen lines** (nine in the Vault and Night Watch group, seven in the market group) could not be scored because their source files were not in the reviewed copy. They are marked in the spreadsheet.
- **Not playtested.** Every line was read in the code and judged from its call site, not seen on screen. Scores are one reviewer's judgement per line. A spot-check of 20 lines in the running game is worth doing before the rewrites are applied.
- **Nothing was changed in the repo.** All rewrites are proposals.
