# Holding currency: why USD shows for a NOK holding, edit after the fact, NOK equivalent

*2026-10-07 · branch `feature/currency-edit-and-nok-equivalent` · written and tested, **not merged, not deployed, not seen in a browser***

## 1. The question

Faiz: some securities are registered with USD or EUR even when NOK was specified. Example:
Equinor ASA (`EQNR.OL`), header "Energy · NOK", but the Overview shows Price USD 42.57,
Base value USD 82.74. Is that the case, how do we handle it, and how can it be changed afterwards?

## 2. What the code does (read, not run against the live database)

| Thing | Which currency | Where |
|---|---|---|
| The holding's own currency | `holding.trading_currency` (what Faiz chose; header shows it) | `models/holding.py`, `api/holdings.py` |
| Price, base value, margin of safety on the Overview | **`valuation_currency`**: the currency of the latest filing's line items; only when there are none does it fall back to `trading_currency` | `services/valuation/holding_valuation.py::_valuation_currency` |
| Live price | The vendor's own currency (NOK for `EQNR.OL`), converted into `valuation_currency` with a stored FX rate | `_current_price_in_valuation_currency` |
| Watchlist "buy below" | The holding's `trading_currency` at the moment the target is saved | `api/watchlist.py` |

**Equinor is the reporting-currency case, not a wrong save.** Equinor files in USD, so the valuation
(a DCF on USD cash flows) is in USD and the NOK price is converted to USD to compare with it.
The same will happen for any company that reports in a different currency than it trades in (EUR filers).

## 3. Other ways a holding can get USD or EUR (code read; **not checked against Faiz's data**)

- **CSV import:** the holding's currency is the broker export's "Valuta" column (`portfolio_import/csv_parser.py`, `ingestion.py`). If the broker reports the instrument's currency, a NOK-listed holding can still arrive as something else.
- **Watchlist add of a new ticker:** the currency sent by the add form (Sal's booth, the watchlist form).
- **Add-holding form:** defaults to NOK.

How to tell the cases apart: the Holdings list "Currency" column is `trading_currency`. If it says NOK and the
valuation says USD, it is the reporting-currency case. If the column itself says USD/EUR, it was saved that way.

## 4. What this change does

1. **Currency can be edited on the Holdings list.** The inline *Edit* row now has a Currency select next to Ticker / Type / Sector. It uses the existing `PATCH /holdings/{id}` (the backend already accepted `trading_currency`); no schema or migration change.
2. **NOK equivalent next to the valuation figures.** `GET /valuation/holdings/{id}` returns two new fields, `trading_currency` and `trading_currency_fx_rate` (valuation currency → trading currency). The Overview's Price and Base value tiles show `≈ NOK 425.70` under the USD figure. The valuation itself is unchanged and stays in the filing's currency.
   - A plain GET reads only a **stored** FX rate (never a first-ever vendor call, per the Sprint 20 rule); the *Refresh* endpoint may fetch one. Until a USD→NOK rate is stored, the line is simply absent (no guess).
   - The conversion is display only: backend supplies the stored rate, the frontend multiplies for display. Nothing in the analysis, the evidence packet or the board uses it.

## 5. What changing a holding's currency does and does not do

- It changes which currency the live price is read in (the vendor's own currency is still preferred over the hint), and the FX pairs warm-up fetches.
- **Existing watchlist targets keep the currency they were saved in** (the number was typed in that currency, so relabelling it would silently change its meaning). After a change the watchlist can show `currency_mismatch` until the target is re-saved.
- Stored valuations and page snapshots refresh on the next Refresh or worker pass, not instantly.
- Journal entries already written keep their currency.

## 6. Verification

- `ruff check .` clean (pinned 0.16.8); `MACRO_DATA_PROVIDER=none pytest -q`: **1,724 passed, 2 skipped** (5 new in `tests/integration/test_valuation_trading_currency.py`: stored rate added, no stored rate = currency but no rate and no vendor call, refresh may fetch, same currency adds nothing, unknown valuation currency adds nothing).
- Frontend: `tsc --noEmit` clean, `npm run lint` 0 errors (2 existing warnings), `npm test` 328 passed (2 new in `keyNumbers.test.ts`), `npm run build` OK.
- Built and verified in a cloud clone because the PC sandbox had no disk space for the test dependencies; `E:\Aladdin` is untouched.

**Not done / not verified:** not seen in a browser; not run against the real database; the CSV-import currency source was read, not tested with a real Nordnet export; the board, watchlist and Margin-of-safety pages still show the valuation currency only (the NOK equivalent is on the holding Overview).

## 7. Not built (each needs a go)

- Stop the CSV import trusting "Valuta" blindly (prefer the exchange currency from the price provider).
- Show the NOK equivalent on the Margin-of-safety board and Watchlist rows.
- Re-currency a watchlist target when the holding's currency changes (a conversion, which is a decision, not a relabel).
