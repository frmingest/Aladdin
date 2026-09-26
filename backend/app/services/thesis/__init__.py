"""Sprint 11 — thesis tracking over time ("is my thesis still intact?").

Tripwires (app/services/thesis/tripwires.py), "what changed since the
latest analysis" (app/services/thesis/history.py), the verdict timeline
(app/services/thesis/timeline.py) and the cross-portfolio monitor
(app/services/thesis/monitor.py) are all deterministic, database-only —
CLAUDE.md Rule 1: nothing here is computed by the LLM, and
app/services/thesis/prices.py's stored-data-only prices mean none of it
ever calls a live market-data provider either.
"""
