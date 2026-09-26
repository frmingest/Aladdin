"""Sprint 12 (2026-09-26) — portfolio risk & regime intelligence.

Four deterministic pieces, all database/provider-driven, none of it
computed by the LLM (CLAUDE.md Rule 1):

- price_history.py: a staleness-checked cache of daily closes per ticker
  (app/models/risk.py's PriceHistoryObservation), fetched via
  app/providers/base.py's MarketDataProvider.get_daily_price_history.
- correlation.py: a real Pearson correlation matrix over daily returns
  (app/services/calculations.py), plus a "correlated risk cluster" flag
  combining it with the existing concentration calc
  (app/services/portfolio_overview.py's HHI/top-N).
- stress.py: portfolio and per-holding drawdown scenarios, sized from
  either the holding's own historical volatility or its DCF bear case
  (app/services/valuation/dcf.py) — never an invented illustrative %.
- regime.py: a baseline/stagflation/crisis classification from the macro
  series app/services/macro/ actually stores, smoothed over a few months
  so one noisy print can't flip it.

app/services/risk/portfolio_risk.py wires all four into the one payload
GET /risk/portfolio (app/api/risk.py) serves.
"""
