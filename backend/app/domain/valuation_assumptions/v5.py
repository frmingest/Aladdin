"""v5 valuation assumptions (2026-10-14): reject betas that make no sense.

Identical to v4 in every number and guardrail. The one change: a vendor beta
below 0 or above 3 is not used. The default beta (1.0) is used instead and
the valuation says so next to the number.

Why: Yahoo gave Equinor (EQNR.OL) a beta of -0.66. CAPM with a negative beta
puts the cost of equity below the risk-free rate (2.3% against a USD
risk-free rate of 5.24%). The 8% floor on the cost of equity happened to
catch that case, which hid the bad input and left a 45% margin of safety
resting partly on it. A negative beta for an operating company is a data
error (Yahoo measures an Oslo listing against a different, thinly traded
market), not a finding; a beta above 3 is the same kind of error from the
other side.

- plausible range 0 to 3: wide on purpose. Real equity betas sit roughly
  between 0.3 and 2; this only catches values that cannot be right, and
  leaves a merely low or high beta to the cost-of-equity floor and to the
  reader's judgement.
- fallback: the existing default beta of 1.0 (the market), a conservative
  choice for a company with no usable beta. It was already the behaviour
  when no beta could be fetched at all.

CLAUDE.md Rule 3: do not edit these numbers once a real analysis has used
them. Add v6.py instead.
"""
from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from app.domain.valuation_assumptions.v4 import VALUATION_ASSUMPTIONS_V4

VALUATION_ASSUMPTIONS_V5 = replace(
    VALUATION_ASSUMPTIONS_V4,
    version="v5",
    beta_plausible_min=Decimal(0),
    beta_plausible_max=Decimal(3),
)
