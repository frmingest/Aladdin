# 3. Support Nordnet's real export format alongside the canonical schema

## Status

Accepted

## Context

§7's canonical portfolio schema (Ticker/Name/Asset class/Quantity/Weight %/Cost basis/Currency/
Sector/Notes) was a design-time assumption. The real file Faiz's broker (Nordnet) produces —
"Beholdningstabell eksport" — looks nothing like it:

```text
Handel	Valuta	Antall	GAV	% i dag	siste kurs	Belåningsverdi	Verdi NOK	Avkast.	Avkast. NOK
```

Encoded UTF-16 with a BOM, tab-delimited despite the `.csv` extension, Norwegian headers, no
exchange ticker column at all, and no weight column — weight has to be derived from each row's
share of "Verdi NOK". This is the file he'll actually upload, not a hypothetical.

## Decision

`app/services/portfolio/parser.py` auto-detects the input shape from its headers rather than
requiring the user to reformat their broker export by hand:

- **Encoding/delimiter sniffing** for CSV: try UTF-8 (with BOM) then UTF-16; pick tab vs. comma
  by counting which appears more in the header line.
- **Format detection**: if the header set contains Nordnet's signature columns ("Handel",
  "Verdi NOK"), route through the Nordnet converter; otherwise use the existing canonical-schema
  alias mapping. XLSX uploads are canonical-schema only for now — no Nordnet XLSX export sample
  exists yet to build against.
- **Instrument name as the holding key.** There's no ticker in this export. Rather than invent
  one (risking silent mismatches against a real ticker later), the instrument name itself
  ("Vår Energi", "L&G Gold Mining ETF") is used as `Holding.ticker`. If Faiz later gets a
  ticker-bearing export, reconciling the two will need a manual pass — not attempted
  automatically.
- **Weight derived, not read.** `weight_pct` = each row's "Verdi NOK" ÷ the upload's total
  "Verdi NOK" × 100. The upload response surfaces this as an explicit warning ("weights were
  derived...") so it's never mistaken for broker-reported data (§13.3: no false precision).
- **Asset class inferred narrowly**: "ETF" in the name → ETF, everything else → Aksje (equity).
  This report is a stock/ETF holdings table, not a multi-asset-class platform export, so a two-
  way heuristic is honest about its own limits rather than guessing at fund/bond/cash labels it
  has no basis for.
- **Live/derived columns are dropped, not stored**: "% i dag", "siste kurs", "Belåningsverdi",
  and both "Avkast." columns are market data and performance, not portfolio composition — they
  belong to Phase 2's market-data layer (real prices, computed returns), not to a snapshot of
  what's held.
- A real (anonymized-filename) sample lives at `backend/tests/fixtures/nordnet_beholdningstabell.csv`
  and is asserted against directly in `tests/unit/test_portfolio_parser_nordnet.py`, rather than
  only testing a synthetic approximation of the format.

## Consequences

- The upload endpoint accepts what Faiz's broker actually produces with no manual reformatting.
- Holdings created from a Nordnet upload are keyed by name; if a canonical-schema file is ever
  uploaded for the same holdings using real tickers, two separate `Holding` rows will result
  until reconciled by hand. Worth a follow-up (e.g. an `aliases` field on `Holding`) if this
  becomes a recurring re-upload pattern.
- Supporting a third export format later is a matter of adding another signature + converter
  function, not restructuring the parser.
