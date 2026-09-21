"""Deterministic valuation engine (Sprint 3 — Brain Step 4). CLAUDE.md
Rule 1: every function here is plain arithmetic over numbers the caller
supplies; growth/discount-rate *inputs* come from growth.py,
discount_rate.py, and app/domain/valuation_assumptions/ — dcf.py only
combines them into scenarios, a reverse-solved implied growth rate, and
(multiples.py) historical trading multiples."""
