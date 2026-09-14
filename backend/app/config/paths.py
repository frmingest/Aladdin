"""
Repository-root-relative paths for versioned, non-Python assets that live
outside `backend/` (architecture §30 Recommended Repository Structure):
persona/synthesis prompts, the LLM structured-output JSON schema contract,
and scoring configuration.

These are read as plain files rather than packaged as Python resources so a
non-engineer (or an LLM-assisted edit) can change a prompt or a scoring
weight by editing one file, without touching application code — the same
reasoning as §2.4 "version everything that can change interpretation" and
§11.1 "the persona is a versioned prompt template ... not hardcoded
application logic".
"""

from pathlib import Path

# backend/app/config/paths.py -> parents[3] is the repository root
# (parents[0]=config, [1]=app, [2]=backend, [3]=repo root).
REPO_ROOT = Path(__file__).resolve().parents[3]
PROMPTS_DIR = REPO_ROOT / "prompts"
SCHEMAS_DIR = REPO_ROOT / "schemas"
SCORING_DIR = REPO_ROOT / "scoring" / "versions"
# Central-bank/macro series registry (architecture §9.1, §26 Phase 4) — see
# app.domain.macro_series. Versioned for the same reason as SCORING_DIR: the
# mapping from a canonical series key to a vendor series id can change
# without touching application code.
RESEARCH_DIR = REPO_ROOT / "research" / "versions"
# Macro/stress-scenario registry (architecture §18, §26 Phase 5) — see
# app.domain.scenarios. Same versioning discipline: a scenario's shocks are
# data a non-engineer can tune, not an if/elif chain in application code.
SCENARIOS_DIR = REPO_ROOT / "scenarios" / "versions"
# Discount-rate suggestion registry (architecture §17, ECON-001 fix, ADR
# 0014) — see app.domain.discount_rate. Maps a holding's trading currency to
# the macro series that anchor its risk-free rate, plus the equity risk
# premium constant, so a DCF discount_rate_pct default can be grounded in
# the macro data Phase 4 already fetches instead of being free-typed with no
# visible anchor. Same versioning discipline as SCORING_DIR/RESEARCH_DIR.
DISCOUNT_RATE_DIR = REPO_ROOT / "discount_rate" / "versions"
