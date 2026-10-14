# Loss-making companies: "can't be ranked yet" and what the price assumes (2026-10-14)

**Status:** written and tested, not merged, not deployed. Branch `feature/loss-making-cant-rank`, off `main` `5135a8f`.
Decision (Faiz, 2026-10-14): do not force a score on a loss-making company (Vend Marketplaces, Salmon Evolution,
Vår Energi). Keep it "can't be ranked yet" with the reason, and show what the price assumes, as information only.

## What was already there

The Margin-of-safety board already lists every holding without a DCF under "Can't be ranked yet", with a one-word cause
(`shortReason`). That part is unchanged. A company that is not ranked has no zone, no margin of safety and no price target.

## What is new

**What the price assumes** (`backend/app/services/valuation/price_assumes.py`, plain arithmetic, no forecast):

    market cap = owner earnings x (1 + g) / (r - g)
    owner earnings needed = market cap x (r - g) / (1 + g)

It is the Gordon terminal value (`dcf.terminal_value`) solved for the cash flow. `r` is the cost of equity the DCF would
have used (same CAPM, floor and optional regime add-on), `g` is the assumptions' terminal growth rate. Nothing new is
assumed. The sentence on the page: at this price the market already counts on about X of owner earnings a year, growing g,
to earn r; the company's own latest owner earnings (negative for a loss-maker) sit beside it.

**When it is shown:** only when the DCF is refused because earnings are not positive: the latest year is a loss, only one
profitable year, or a volatile history whose median is not positive. It needs a price and a share count; without them it is
left out. It never changes `valuation_status` (stays `unavailable`), `zone`, the ranking or the reason text on the board.

**Where:** a quiet block ("What the price assumes", with a line saying it is not a valuation) inside "Why" on each
"Can't be ranked yet" row, and under the empty DCF on the holding's valuation panel. No badge, colour or number that looks
like a score. API: `price_assumes` on `GET /valuation/holdings/{id}` and on each board row (optional, null otherwise).

Also: a volatile history with a non-positive median now reads "Loss-making" on the board chip (it said "Not valued yet").

## Checks

Backend: 1,947 tests pass, 2 skipped (`MACRO_DATA_PROVIDER=none`); `ruff check .` clean. Frontend: `tsc --noEmit`, `npm run lint`
(0 errors, 2 old warnings), `npm test` (790 pass) and `npm run build` pass. New tests: the formula and its refusals, the three
loss-making paths, a profitable company has no reading, the board row carries it and keeps its DCF reason and ranking, the
payload schema, the sentence builder. Not rendered in a browser; not run on real holdings.

## After deploy (Faiz)

1. Press Refresh on Margin of safety (or reload) so the board is recomputed.
2. Open "Can't be ranked yet" and "Why" on Vend Marketplaces, Salmon Evolution and Vår Energi: the block should read a
   plausible yearly owner-earnings figure beside a negative latest figure. If a figure looks wrong, check the share count
   and price currency first.

## Not done, by design

No score, zone or price target for loss-makers. No reverse-DCF growth rate (there is no positive base to grow). No change
to the plausibility guard or to profitable companies.
