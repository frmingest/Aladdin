# Weather Tower "gaps" dials and text pass 4g, 2026-11-09

Two small pieces from [remaining work](../sprints/remaining-work-2026-11-06.md), in one PR. Written and tested in a cloud workspace; not deployed, and the dial fix has not been seen in a browser (it needs a redeploy and a Refresh).

## 1. Weather Tower: why four dials had no needle
- **What was seen (T5, live site, 2026-11-09):** the four dials on the north wall ("The gaps") had a cream face and a centre dot, no needle and no trace under them. The side-wall dials showed needles. So it was not a drawing bug.
- **Cause:** a needle and a trace need at least two stored months. The computed spreads (real policy rates, Norway minus US 10-year, the Norway 10y-3m curve) were built from the two series' latest values only (`build_derived`) and never got a history, so the Tower had nothing to draw.
- **Fix (backend, `services/macro/indicators.py`):** `_derived_history` subtracts the right-hand series from the left for each month **both** have a stored monthly point. A month one side lacks is left out, never filled in. Plain arithmetic in app code; the LLM is not involved. The `history` field was already in the API, so the frontend needed no change, and the Macro page's charts get the same history.
- **Not touched:** the regime rule reads the base series, not the derived ones, so risk bands are unchanged.
- **Tests:** two new unit tests (month-aligned values, a month one side lacks is skipped; one empty side gives an empty history). Macro unit tests 28 pass.
- **After deploy (Faiz):** open the Weather Tower and look at the north wall. A spread whose two series share fewer than two months still shows no needle, on purpose.

## 2. Text pass 4g: temperament sentences in game voice
- `game3d/temperWordsV1.ts` rewrites the backend's event explanations, the meter summary and the rule names on the 3D Vault card only. Examples: "1 of 2 judged event(s) restored the meter…" becomes "1 of 2 moments calmed the needle, from 3 decisions and 1 look compared in the last 90 days."; "Churn" becomes "Too much shuffling"; "Kept the position while the price fell 12.5% between snapshots (…)" becomes "Held on while the price fell 12.5% between two saved looks (…), and no tripwire had rung."
- Counts, names, dates and percentages are copied from the sentence; singular counts read as singular; the low-confidence tail is kept. An unknown sentence comes back untouched. Backend and flat Fortress are not edited (the card takes `voice="game"`).
- **Tests:** every backend template through the layer (banned words absent, numbers kept), the card in both voices.
- **Still open in text pass 4:** Council and standing labels, frame-change lines with numbers, the remodelling counts line, and the Realm "Buy/Sell" call (Faiz).

## Checklist section A (3D text)
1. Pages touched: `/game3d` Vault panel (temperament card), Weather Tower north wall.
2. Identity before/after: unchanged.
3. Visual verb + scene: the Tower's spreads get a needle and a paper trace like every other dial; temperament words stay on the same card.
4. Words: shorter, no "(s)", "snapshot", "judged". Numbers exact.
5. Rules kept: unknown is fog (no history means no needle, never a made-up one), flat page keeps its wording, new version file, no LLM arithmetic.
