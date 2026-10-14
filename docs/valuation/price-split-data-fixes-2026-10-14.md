# Price and split data fixes (2026-10-14)

Status: **written, not yet deployed** (branch `feature/price-split-data-fixes`). Follows the diagnosis in [valuation-data-diagnosis-2026-10-06.md](valuation-data-diagnosis-2026-10-06.md), items 3 ("Kongsberg share split") and "Equinor price".

## What was found

- **Equinor 41.95 USD is not a bug.** The stored price is 402.80 NOK. The app values Equinor in USD (its filing currency), and 402.80 x 0.10414 = 41.95. The conversion is right. Faiz still needs to compare 402.80 with the live Oslo quote; that is a look at a number, not a code change.
- **Kongsberg is a real bug.** A filing reports shares and EPS as they stood at its date. After the 5-for-1 split (May 2024) today's price is a fifth of what it was, but FY2023's share count is still the old, smaller one. The history table "old shares x today's price" gave a market cap five times too small, so every FY2023 multiple was off by 5x.

## What changed

1. **Splits are stored.** New table `stock_splits` (migration `v1d2e3f4a5b6`, additive). It fills from Yahoo's split history whenever a price is refreshed. Best effort: a Yahoo failure adds nothing and never blocks the price.
2. **Older years are restated to today's price basis.** In the multiples history (`multiples_over_time`), a year before a split gets its shares and EPS multiplied/divided by the split ratio, with a note on the row ("shares and EPS restated x5 for the 5-for-1 split after this year, to match today's price"). A year whose filing already reports post-split figures is left alone, so a split is never counted twice.
3. **Sudden price jumps are flagged.** If the latest stored price is 25% or more away from the one before it, the valuation lists a warning beside the number. A drop to about a fifth reads as "looks like a 5-for-1 split and none is on file". A jump that a stored split explains is not flagged. A change of price currency is flagged too.
4. **One-time holding-currency check.** `GET /system/holding-currency-check` (read-only) lists holdings whose saved currency disagrees with the currency their latest price is quoted in, or with their exchange (an `.OL` stock saved as anything but NOK). It changes nothing.

## How to use after deploy

- Open `/system/holding-currency-check` on the backend (or ask Claude to). An empty `findings` list means every holding matches. If a NOK holding shows USD or EUR, the Nordnet CSV "Valuta" column is the cause; fix the holding's currency on its page.
- Splits arrive on the next price refresh. Press Refresh on Kongsberg, then open its multiples history: FY2023 should now show the "restated x5" note.

## Limits

- Fiscal years are treated as ending 31 December, as elsewhere in the multiples code.
- Only the multiples history and the valuation warning use the split data. The share count used for today's valuation already comes from a current source and needed no change.
- Duplicate price refresh rows and the stale EUR rate (diagnosis items 8) are separate and untouched.
