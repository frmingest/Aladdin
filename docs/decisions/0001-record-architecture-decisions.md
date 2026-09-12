# 1. Record architecture decisions

## Status

Accepted

## Context

The main architecture document (`docs/architecture.md`) captures the overall design. Individual
decisions made along the way — provider choices, schema changes, deviations from the original
design — should be recorded separately so the reasoning behind them survives even as the code
changes (architecture §2.4: "version everything that can change interpretation").

## Decision

Use lightweight Architecture Decision Records (ADRs) in `docs/decisions/`, numbered sequentially.
Each ADR: Status, Context, Decision, Consequences. Superseded ADRs are marked, not deleted.

## Consequences

Future contributors (including future you) can see *why* a choice was made, not just what it is.
