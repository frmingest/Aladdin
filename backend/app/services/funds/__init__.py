"""Fund / ETF analysis (Sprint 8, F9).

- facts.py: the typed-in fund facts and holdings (profile, returns,
  exposures), validation and linking fund holdings to the app's own
  Holding rows
- holdings_import.py: deterministic parser for provider holdings files
- metrics.py: every fund number (fee drag, excess return / tracking
  difference, concentration, look-through, overlap), in Python
- evidence.py: the fund evidence packet the LLM passes reason over

Decision 23 (2026-09-24): no LLM ever reads a fund figure out of a
document; see app/models/fund.py.
"""
