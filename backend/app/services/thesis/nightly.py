"""Sprint 15 #5 — the nightly tripwire check.

Until now a tripwire's `fired_at` was only set when somebody opened a
thesis page (evaluation happens on read, from stored data). A price that
crossed a threshold on Tuesday stayed "not firing" until Faiz happened to
look. This runs the same deterministic evaluation once a day without
anyone looking:

1. for every holding with at least one active tripwire, refresh the stored
   share price (best effort — a failed refresh is reported, never fatal;
   the evaluation then uses whatever is stored, exactly as the pages do);
2. evaluate the holding's tripwires with `evaluate_holding_tripwires`
   (the one firing rule — CLAUDE.md Rule 1, no LLM anywhere in here);
3. report which tripwires *newly* fired or cleared during this pass, and
   remember when the check last ran (plus a one-line summary) in the
   generic `app_settings` table — no migration.

The worker (Faiz's PC, home IP) calls `run_check_if_due` on its poll loop;
`POST /thesis/check` calls `run_tripwire_check` on demand. Both share this
module, so "fired" means the same thing everywhere.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.models.holding import Holding
from app.models.thesis import ThesisTripwire
from app.providers.base import MarketDataProvider
from app.services.thesis.tripwires import evaluate_holding_tripwires

log = logging.getLogger("aladdin.tripwire_check")

LAST_RUN_KEY = "tripwire_check_last_run"
LAST_SUMMARY_KEY = "tripwire_check_last_summary"
_MAX_VALUE = 255  # app_settings.value is String(255)


@dataclass
class TripwireChange:
    holding_id: uuid.UUID
    ticker: str
    tripwire_id: uuid.UUID
    metric: str
    label: str | None
    current_value: str | None


@dataclass
class TripwireCheckResult:
    ran_at: datetime
    holdings_checked: int = 0
    tripwires_checked: int = 0
    newly_fired: list[TripwireChange] = field(default_factory=list)
    cleared: list[TripwireChange] = field(default_factory=list)
    no_data: int = 0
    price_refresh_failed: list[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [
            f"{self.tripwires_checked} tripwire(s) on {self.holdings_checked} holding(s)",
            f"{len(self.newly_fired)} newly fired",
            f"{len(self.cleared)} cleared",
        ]
        if self.no_data:
            parts.append(f"{self.no_data} without data")
        if self.price_refresh_failed:
            parts.append(f"price refresh failed for {len(self.price_refresh_failed)}")
        text = ", ".join(parts)
        if self.newly_fired:
            tickers = ", ".join(sorted({c.ticker for c in self.newly_fired}))
            text += f" ({tickers})"
        return text[:_MAX_VALUE]


def _ensure_aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _write_setting(db: Session, key: str, value: str) -> None:
    setting = db.get(AppSetting, key)
    if setting is None:
        db.add(AppSetting(key=key, value=value[:_MAX_VALUE]))
    else:
        setting.value = value[:_MAX_VALUE]
        setting.updated_at = datetime.now(timezone.utc)


def _read_setting(db: Session, key: str) -> str | None:
    try:
        setting = db.get(AppSetting, key)
    except Exception:  # noqa: BLE001 - a missing table must not break callers
        return None
    return setting.value if setting is not None else None


def last_check(db: Session) -> tuple[datetime | None, str | None]:
    """(when the nightly check last ran, its one-line summary) — either can
    be None (never ran / unreadable)."""
    raw = _read_setting(db, LAST_RUN_KEY)
    when: datetime | None = None
    if raw:
        try:
            when = _ensure_aware(datetime.fromisoformat(raw))
        except ValueError:
            when = None
    return when, _read_setting(db, LAST_SUMMARY_KEY)


def _holdings_with_active_tripwires(db: Session) -> list[Holding]:
    ids = set(db.scalars(select(ThesisTripwire.holding_id).where(ThesisTripwire.active.is_(True)).distinct()))
    if not ids:
        return []
    return list(db.scalars(select(Holding).where(Holding.id.in_(ids)).order_by(Holding.ticker)))


def run_tripwire_check(
    db: Session,
    *,
    market_data_provider: MarketDataProvider | None = None,
    now: datetime | None = None,
) -> TripwireCheckResult:
    """One full pass. `market_data_provider=None` skips the price refresh
    (evaluation from stored data only). Never raises for a single holding's
    failure — that holding is reported and the pass carries on."""
    now = now or datetime.now(timezone.utc)
    result = TripwireCheckResult(ran_at=now)

    for holding in _holdings_with_active_tripwires(db):
        result.holdings_checked += 1

        if market_data_provider is not None:
            try:
                from app.services.market_data.price import get_or_refresh_price

                snapshot = get_or_refresh_price(db, market_data_provider, holding=holding, force=True)
                db.commit()
                if not snapshot.available:
                    result.price_refresh_failed.append(holding.ticker)
            except Exception:
                db.rollback()
                log.warning("price refresh failed for %s", holding.ticker, exc_info=True)
                result.price_refresh_failed.append(holding.ticker)

        try:
            before = {
                tw.id: tw.fired_at is not None
                for tw in db.scalars(select(ThesisTripwire).where(ThesisTripwire.holding_id == holding.id))
            }
            evaluations = evaluate_holding_tripwires(db, holding, now=now)
        except Exception:
            db.rollback()
            log.exception("tripwire evaluation failed for %s", holding.ticker)
            continue

        for evaluation in evaluations:
            tripwire = evaluation.tripwire
            if not tripwire.active:
                continue
            result.tripwires_checked += 1
            if evaluation.current_value is None:
                result.no_data += 1
            was_firing = before.get(tripwire.id, False)
            change = TripwireChange(
                holding_id=holding.id,
                ticker=holding.ticker,
                tripwire_id=tripwire.id,
                metric=tripwire.metric,
                label=tripwire.label,
                current_value=str(evaluation.current_value) if evaluation.current_value is not None else None,
            )
            if evaluation.firing and not was_firing:
                result.newly_fired.append(change)
            elif was_firing and not evaluation.firing:
                result.cleared.append(change)

    _write_setting(db, LAST_RUN_KEY, now.isoformat())
    _write_setting(db, LAST_SUMMARY_KEY, result.summary())
    db.commit()
    log.info("nightly tripwire check: %s", result.summary())
    return result


def is_due(db: Session, *, now: datetime, hour_utc: int) -> bool:
    """True once per UTC day, after `hour_utc`, when the check hasn't yet
    run today. A never-run check is due as soon as the hour has passed."""
    now = _ensure_aware(now)
    if now.hour < hour_utc:
        return False
    when, _ = last_check(db)
    return when is None or when.astimezone(timezone.utc).date() < now.astimezone(timezone.utc).date()


def run_check_if_due(
    db: Session,
    *,
    market_data_provider: MarketDataProvider | None,
    hour_utc: int,
    now: datetime | None = None,
) -> TripwireCheckResult | None:
    now = now or datetime.now(timezone.utc)
    if not is_due(db, now=now, hour_utc=hour_utc):
        return None
    return run_tripwire_check(db, market_data_provider=market_data_provider, now=now)
