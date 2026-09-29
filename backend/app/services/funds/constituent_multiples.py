"""Refreshes the stored trailing P/E of every equity line in a fund's latest
holdings import (fund look-through valuation). A POST-only, slow operation
(one provider call per constituent) — never run inside a page GET.

Every line is stored, priced or not: a constituent the provider could not
price keeps a row with `trailing_pe` NULL and the reason, so the valuation's
coverage figure reflects what was really covered. Lines without an ISIN
cannot be looked up and are counted as uncovered."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.fund import FundConstituentMultiple
from app.models.holding import Holding
from app.providers.constituent_multiples import (
    ConstituentMultiplesProvider,
    ConstituentUnavailableError,
)
from app.services.funds.facts import latest_exposures

log = logging.getLogger("aladdin.fund_look_through")


@dataclass
class ConstituentRefreshResult:
    lines: int
    priced: int
    unpriced: int
    no_isin: int
    refreshed_at: datetime


def refresh_constituent_multiples(
    db: Session, fund: Holding, provider: ConstituentMultiplesProvider, *, now: datetime | None = None
) -> ConstituentRefreshResult:
    now = now or datetime.now(timezone.utc)
    _as_of, exposures = latest_exposures(db, fund.id, "holding")
    rows: list[FundConstituentMultiple] = []
    priced = unpriced = no_isin = 0
    for exposure in exposures:
        if not exposure.isin:
            no_isin += 1
            continue
        try:
            multiple = provider.get_trailing_pe(exposure.isin)
            rows.append(
                FundConstituentMultiple(
                    holding_id=fund.id, isin=exposure.isin, label=exposure.label, weight_pct=exposure.weight_pct,
                    resolved_ticker=multiple.resolved_ticker, trailing_pe=multiple.trailing_pe, reason=None,
                    provider=multiple.provider, observed_at=multiple.observed_at,
                )
            )
            priced += 1
        except ConstituentUnavailableError as exc:
            rows.append(
                FundConstituentMultiple(
                    holding_id=fund.id, isin=exposure.isin, label=exposure.label, weight_pct=exposure.weight_pct,
                    resolved_ticker=None, trailing_pe=None, reason=str(exc)[:255],
                    provider=provider.name, observed_at=now,
                )
            )
            unpriced += 1
        except Exception as exc:
            log.warning("constituent %s failed", exposure.isin, exc_info=True)
            rows.append(
                FundConstituentMultiple(
                    holding_id=fund.id, isin=exposure.isin, label=exposure.label, weight_pct=exposure.weight_pct,
                    resolved_ticker=None, trailing_pe=None, reason=f"unexpected error: {type(exc).__name__}",
                    provider=provider.name, observed_at=now,
                )
            )
            unpriced += 1
    db.query(FundConstituentMultiple).filter(FundConstituentMultiple.holding_id == fund.id).delete(
        synchronize_session=False
    )
    db.add_all(rows)
    db.commit()
    return ConstituentRefreshResult(
        lines=len(exposures), priced=priced, unpriced=unpriced, no_isin=no_isin, refreshed_at=now
    )
