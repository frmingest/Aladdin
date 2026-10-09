# Aladdin rules (what "correct" looks like) — the standard the rules-auditor reads
Source of truth is CLAUDE.md; this file adds checkable patterns.
- Math: functions in `services/valuation/`, `services/metrics.py`, `services/performance/` take numbers and return numbers. No prompt text asks the model to calculate.
- Evidence: every claim field in an analysis schema carries `evidence_ids`; ids exist in the run's packet.
- Versioning: `backend/prompts/**` and schema files are append-only once used; new behaviour = `vN+1`.
- Blind pass: its input builder has no import of notes/thesis modules.
- Untrusted text: excerpt text is wrapped as data; evidence-ID-like strings in issuer text are neutralised.
- Migration: `alembic/versions/*` file present in the same diff as any model change; up/down/up checked.
- Destructive endpoints: signature has `confirm: bool`; no call to them in tests against a real DB URL.
