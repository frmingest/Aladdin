# Valuation v4: normalised DCF base, equity-certificate banks, insurer ROE (2026-10-07)

**Status:** written and tested, not merged, not deployed. Branch `feature/valuation-normalised-base-certificates-insurer-roe`, off `cdc59ff`.
Context: [valuation-data-diagnosis-2026-10-06.md](valuation-data-diagnosis-2026-10-06.md).

Faiz's decisions: (1) leave the Kongsberg/Bouvet D&A extractor item, he will propose a separate generic feature;
(2) "you decide according to best practices in finance" for volatile earnings; (3) build the certificate-bank fix;
(4) fix the Storebrand "ROE n/m ... only 3.3% of total assets" refusal.

## 1. Normalised base for volatile owner earnings (assumptions v4)

| | v3 (before) | v4 (now, default) |
|---|---|---|
| Base | latest year's owner earnings | stable history: latest year, as v3. Volatile history: **median of the latest 5 years** |
| Growth | CAGR of the latest profitable run, capped 10%, fading to 2.5% | stable: as v3. Volatile: **terminal rate (2.5%), no extrapolated trend** |
| Volatile means | n/a | any of the latest 5 years above 2x the median or below half of it; a loss year counts |
| Too little history | n/a | fewer than 3 years: v3 method. Median not positive: DCF unavailable, with the reason |

Why: an endpoint-to-endpoint growth rate over a cyclical or one-off-driven history is not a forecast (Equinor
-35%/yr, Telenor -40%/yr, Aker Solutions +58%/yr). Graham's multi-year average and Damodaran's normalised earnings
are the usual practice. A median, not a mean, so one windfall or disposal gain does not lift the base. The v3 file is
unchanged (assumptions are versioned files); the plausibility guard (3x / 1/3 of price) stays.

**Hand estimates, not app output** (basic owner earnings after leases; the app's basis may differ):
Aker Solutions base about 1,747m NOK vs latest 2,838m; Equinor about 10,522m USD vs latest 1,908m; Telenor about 13,245m NOK vs latest 7,284m (4 years). The Equinor median is arguably generous against the FY2025 trough: a trade-off of any mid-cycle method. Run Refresh and read the page notes for the real figures.

## 2. Equity-certificate savings banks (Sparebanken Øst)

Certificate holders own only a fraction of the bank. Fraction = certificates x EPS / net income, used only when it is
between 5% and 85%. Book value per certificate = ordinary equity x fraction / certificates. P/E = market cap /
(net income x fraction); P/B = market cap / (equity x fraction). The valuation page and metrics add a note naming the share.
Outside that range the old behaviour applies. SB1NO may use it too once its facts have EPS.

## 3. Insurer and bank ROE (Storebrand)

The 5%-of-assets "depleted equity" guard is meant for industrials; insurers and banks run on thin equity by design.
For financials it now refuses only non-positive equity. All call sites (holding metrics, evidence packet, multiples
history, thesis metrics registry, financials valuation) pass the financial flag. Game mode and Ravens left unchanged (net debt only).

## 4. Tests

About 1,597 backend tests pass, Ruff clean (`MACRO_DATA_PROVIDER=none`). New tests cover: v4 differs from v3 only in
version and method; median, even window, stable history, minimum years, loss year; Equinor-shaped history v3 vs v4; steady grower identical under both;
no positive median; two-year history keeps v3; insurer ROE with thin equity; non-positive equity still refused;
certificate share boundaries; a certificate bank's P/E, P/B and book value.

## 5. After deploy

1. `git pull` in `E:\Aladdin`.
2. Railway must have no `ACTIVE_VALUATION_ASSUMPTIONS_VERSION` override (the default is now `v4`).
3. Press Refresh on Margin of safety; recheck Aker Solutions, Equinor, Telenor, Sparebanken Øst, Storebrand.

## 6. Not done

KOG/BOUV D&A tags (separate feature, per Faiz); Kongsberg split restatement; Salmon Evolution FY2020-21 scale;
loss-making method (Vend, Salme, Vår Energi); stale EUR rate; duplicate observation rows; Equinor stored price check.
