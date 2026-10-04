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

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.fund import FundConstituentMultiple
from app.models.holding import Holding
from app.providers.constituent_multiples import (
    ConstituentMultiplesProvider,
    ConstituentUnavailableError,
)
from app.services.funds.facts import latest_exposures, relink_latest_holdings

log = logging.getLogger("aladdin.fund_look_through")


@dataclass
class ConstituentRefreshResult:
    lines: int
    priced: int
    unpriced: int
    no_isin: int  # lines with neither an ISIN nor a linked holding to look up
    refreshed_at: datetime
    newly_linked: int = 0
    via_link: int = 0  # lines priced through their linked holding's ticker


def refresh_constituent_multiples(
    db: Session, fund: Holding, provider: ConstituentMultiplesProvider, *, now: datetime | None = None
) -> ConstituentRefreshResult:
    now = now or datetime.now(timezone.utc)
    newly_linked = relink_latest_holdings(db, fund)
    _as_of, exposures = latest_exposures(db, fund.id, "holding")
    linked_tickers = {
        h.id: h.ticker
        for h in db.scalars(
            select(Holding).where(Holding.id.in_({e.linked_holding_id for e in exposures if e.linked_holding_id}))
        )
    }
    rows: list[FundConstituentMultiple] = []
    priced = unpriced = no_isin = via_link = 0
    for exposure in exposures:
        # A real ISIN first; a list without ISINs is looked up through the
        # ticker of the holding the line is linked to. Never a guessed ISIN.
        key = exposure.isin or linked_tickers.get(exposure.linked_holding_id)
        if not key:
            no_isin += 1
            continue
        lookup_key = None if exposure.isin else key
        try:
            multiple = provider.get_trailing_pe(key)
            rows.append(
                FundConstituentMultiple(
                    holding_id=fund.id, isin=exposure.isin, lookup_key=lookup_key, label=exposure.label,
                    weight_pct=exposure.weight_pct, resolved_ticker=multiple.resolved_ticker,
                    trailing_pe=multiple.trailing_pe, reason=None,
                    provider=multiple.provider, observed_at=multiple.observed_at,
                )
            )
            priced += 1
            via_link += 1 if lookup_key else 0
        except ConstituentUnavailableError as exc:
            rows.append(
                FundConstituentMultiple(
                    holding_id=fund.id, isin=exposure.isin, lookup_key=lookup_key, label=exposure.label,
                    weight_pct=exposure.weight_pct, resolved_ticker=None, trailing_pe=None,
                    reason=str(exc)[:255], provider=provider.name, observed_at=now,
                )
            )
            unpriced += 1
        except Exception as exc:
            log.warning("constituent %s failed", key, exc_info=True)
            rows.append(
                FundConstituentMultiple(
                    holding_id=fund.id, isin=exposure.isin, lookup_key=lookup_key, label=exposure.label,
                    weight_pct=exposure.weight_pct, resolved_ticker=None, trailing_pe=None,
                    reason=f"unexpected error: {type(exc).__name__}", provider=provider.name, observed_at=now,
                )
            )
            unpriced += 1
    db.query(FundConstituentMultiple).filter(FundConstituentMultiple.holding_id == fund.id).delete(
        synchronize_session=False
    )
    db.add_all(rows)
    db.commit()
    return ConstituentRefreshResult(
        lines=len(exposures), priced=priced, unpriced=unpriced, no_isin=no_isin, refreshed_at=now,
        newly_linked=newly_linked, via_link=via_link,
    )
