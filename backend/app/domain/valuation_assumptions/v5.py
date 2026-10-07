"""v5 valuation assumptions (2026-10-07): cash-based owner earnings for upstream oil and gas.

Identical to v4 except for how owner earnings are built for an upstream
producer. The net income basis (net income + D&A - capex - leases -
decommissioning) is wrong for a company under the Norwegian petroleum tax:
most of the tax expense is deferred, not paid. Vår Energi FY2022: tax expense
4,920m of 5,856m pre-tax profit, yet operating cash flow was 5,682m against
net income + D&A of 2,384m. The net income basis gave negative owner earnings
in FY2020-24 and the company went unranked, while operating cash flow less
capex was positive in five of six years.

v5 uses operating cash flow - capex - decommissioning payments - lease
payments - interest paid classified in financing (app/services/metrics.py,
free_cash_flow_to_owners) for holdings detected as upstream (Energy sector and
decommissioning payments on file). The note on the valuation names the basis
and shows what the net income basis would have given. Every other holding is
unchanged, as is the v4 normalised-median logic that then runs on these figures.

CLAUDE.md Rule 3: do not edit these numbers once a real analysis has used
them. Add v6.py instead.
"""
from __future__ import annotations

from dataclasses import replace

from app.domain.valuation_assumptions.v4 import VALUATION_ASSUMPTIONS_V4

VALUATION_ASSUMPTIONS_V5 = replace(
    VALUATION_ASSUMPTIONS_V4,
    version="v5",
    upstream_owner_earnings_basis="cash",
)
