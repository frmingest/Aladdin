"""Share-split restating, the price-jump flag and the holding-currency check
(2026-10-14, claude/price-split-data-fixes-2026-10-14.md). In-memory SQLite,
fake providers, no network. Invented numbers."""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import Base, Document, FinancialLineItem, Holding, MarketObservation
from app.models.market import StockSplit
from app.providers.base import MarketDataUnavailableError, PricePoint, SplitEvent
from app.services.market_data.currency_check import check_holding_currencies
from app.services.market_data.price import get_or_refresh_price, previous_observation
from app.services.market_data.sanity import price_jump_note
from app.services.market_data.splits import (
    describe_ratio,
    refresh_splits,
    restate_shares,
    split_factor,
    splits_for,
)
from app.services.valuation.multiples import multiples_over_time

D = Decimal
UTC = timezone.utc


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _split(ex: datetime, ratio: str) -> StockSplit:
    return StockSplit(ex_date=ex, ratio=D(ratio), provider="yfinance")


# --- pure helpers ---------------------------------------------------------


def test_describe_ratio():
    assert describe_ratio(D("5")) == "5-for-1"
    assert describe_ratio(D("0.1")) == "1-for-10 reverse split"


def test_split_factor_counts_only_splits_inside_the_window():
    splits = [_split(datetime(2024, 5, 1, tzinfo=UTC), "5"), _split(datetime(2026, 1, 1, tzinfo=UTC), "2")]
    assert split_factor(splits, after=datetime(2023, 12, 31, tzinfo=UTC)) == D("10")
    assert split_factor(splits, after=datetime(2023, 12, 31, tzinfo=UTC), up_to=datetime(2025, 1, 1, tzinfo=UTC)) == D("5")
    assert split_factor(splits, after=datetime(2024, 12, 31, tzinfo=UTC), up_to=datetime(2025, 1, 1, tzinfo=UTC)) == D(1)
    # naive datetimes (SQLite) are read as UTC
    assert split_factor(splits, after=datetime(2023, 12, 31)) == D("10")  # noqa: DTZ001


def test_restate_shares_moves_to_the_reference_basis_only_when_it_helps():
    # old basis 176m, new basis 880m: restating gets closer to the reference
    assert restate_shares(D("176"), D("5"), reference=D("880")) == (D("880"), True)
    # a filing that already restated its own comparative is left alone
    assert restate_shares(D("880"), D("5"), reference=D("880")) == (D("880"), False)
    # no split, no change
    assert restate_shares(D("176"), D(1), reference=D("880")) == (D("176"), False)
    # without a reference the split is applied
    assert restate_shares(D("176"), D("5")) == (D("880"), True)


# --- price jump flag ------------------------------------------------------


def test_small_move_is_not_flagged():
    assert price_jump_note(D("100"), D("110")) is None
    assert price_jump_note(D("100"), D("80")) is None


def test_big_move_is_flagged_with_a_check_note():
    note = price_jump_note(D("100"), D("160"))
    assert note is not None and "+60%" in note and "data error" in note


def test_a_drop_to_a_fifth_reads_as_a_missing_five_for_one_split():
    note = price_jump_note(D("1000"), D("200"))
    assert note is not None and "5-for-1" in note and "none is on file" in note


def test_a_known_split_explains_the_jump():
    splits = [_split(datetime(2024, 5, 1, tzinfo=UTC), "5")]
    assert price_jump_note(D("1000"), D("200"), known_splits=splits) is None


def test_bad_inputs_never_raise():
    assert price_jump_note(D("0"), D("10")) is None
    assert price_jump_note(D("10"), D("0")) is None


# --- storing splits and flagging on refresh --------------------------------


class _Provider:
    name = "yfinance"

    def __init__(self, price: str, events=None, error=None):
        self._price, self._events, self._error = D(price), events or [], error

    def get_current_price(self, ticker, *, currency_hint=None):
        return PricePoint(price=self._price, currency="NOK", observed_at=datetime.now(UTC), provider=self.name)

    def get_split_history(self, ticker):
        if self._error is not None:
            raise self._error
        return self._events


def _holding(db: Session, ticker="KOG.OL", currency="NOK") -> Holding:
    holding = Holding(ticker=ticker, name=ticker, trading_currency=currency)
    db.add(holding)
    db.flush()
    return holding


def test_refresh_stores_new_splits_once():
    event = SplitEvent(ex_date=datetime(2024, 5, 1, tzinfo=UTC), ratio=D("5"))
    with _session() as db:
        holding = _holding(db)
        provider = _Provider("200", [event])
        assert refresh_splits(db, provider, holding) == 1
        assert refresh_splits(db, provider, holding) == 0
        db.commit()
        assert [s.ratio for s in splits_for(db, holding.id)] == [D("5")]


def test_split_lookup_failure_never_blocks_the_price():
    with _session() as db:
        holding = _holding(db)
        provider = _Provider("200", error=MarketDataUnavailableError("yahoo down"))
        snapshot = get_or_refresh_price(db, provider, holding=holding, force=True)
        assert snapshot.available and snapshot.value.price == D("200")
        assert splits_for(db, holding.id) == []


def test_a_provider_without_split_data_adds_nothing():
    class _Bare:
        name = "bare"

    with _session() as db:
        assert refresh_splits(db, _Bare(), _holding(db)) == 0


def test_previous_observation_is_the_one_just_before():
    with _session() as db:
        holding = _holding(db)
        old = MarketObservation(
            holding=holding, observed_at=datetime(2026, 9, 1, tzinfo=UTC), price=D("100"), currency="NOK", provider="y"
        )
        mid = MarketObservation(
            holding=holding, observed_at=datetime(2026, 10, 1, tzinfo=UTC), price=D("110"), currency="NOK", provider="y"
        )
        new = MarketObservation(
            holding=holding, observed_at=datetime(2026, 10, 10, tzinfo=UTC), price=D("120"), currency="NOK", provider="y"
        )
        db.add_all([old, mid, new])
        db.commit()
        assert previous_observation(db, new).price == D("110")
        assert previous_observation(db, old) is None


# --- restating in the multiples history (the Kongsberg case) ---------------


def _document(holding: Holding) -> Document:
    return Document(
        holding=holding, type="filing", original_filename="ar.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="documents/ar.pdf", sha256="b" * 64, status="processed", quality_flags={},
    )


def _kog(db: Session, *, fy2023_shares: str) -> Holding:
    """FY2023 shares on the old basis (176m) unless told otherwise; FY2024
    on the new basis (880m, after the 5-for-1 split on 2024-05-01)."""
    holding = _holding(db)
    document = _document(holding)
    db.add(document)
    db.flush()
    rows = {
        "FY2023": {"net_income": "8800000000", "shares_outstanding": fy2023_shares},
        "FY2024": {"net_income": "10000000000", "shares_outstanding": "880000000"},
    }
    for period, facts in rows.items():
        for metric, value in facts.items():
            db.add(FinancialLineItem(
                document=document, holding=holding, metric=metric, value=D(value),
                unit="NOK", currency="NOK", period=period, confidence=0.95,
            ))
    # price observed after the split, nearest to both year ends
    db.add(MarketObservation(
        holding=holding, observed_at=datetime(2025, 1, 15, tzinfo=UTC), price=D("100"), currency="NOK", provider="y"
    ))
    db.add(StockSplit(holding_id=holding.id, ex_date=datetime(2024, 5, 1, tzinfo=UTC), ratio=D("5"), provider="y"))
    db.commit()
    return holding


def _pe(db: Session, holding: Holding, period: str):
    return next(r for r in multiples_over_time(db, holding) if r.period == period)


def test_pre_split_year_is_restated_to_todays_price_basis():
    with _session() as db:
        holding = _kog(db, fy2023_shares="176000000")
        result = _pe(db, holding, "FY2023")
    # market cap = 100 x 880m; P/E = 88,000m / 8,800m = 10 (not 2 on the old count)
    assert result.computed["price_to_earnings"] == D("10")
    assert any("restated x5" in n and "5-for-1" in n for n in result.notes)


def test_a_year_that_already_reports_post_split_shares_is_not_restated_twice():
    with _session() as db:
        holding = _kog(db, fy2023_shares="880000000")
        result = _pe(db, holding, "FY2023")
    assert result.computed["price_to_earnings"] == D("10")
    assert not any("restated" in n for n in result.notes)


def test_without_a_split_on_file_nothing_changes():
    with _session() as db:
        holding = _kog(db, fy2023_shares="176000000")
        db.execute(StockSplit.__table__.delete())
        db.commit()
        result = _pe(db, holding, "FY2023")
    assert result.computed["price_to_earnings"] == D("2")


# --- holding currency check ------------------------------------------------


def _observe(db: Session, holding: Holding, currency: str) -> None:
    db.add(MarketObservation(
        holding=holding, observed_at=datetime(2026, 10, 1, tzinfo=UTC), price=D("10"), currency=currency, provider="y"
    ))


def test_currency_check_lists_only_the_holdings_that_look_wrong():
    with _session() as db:
        ok = _holding(db, "EQNR.OL", "NOK")
        _observe(db, ok, "NOK")
        wrong_price = _holding(db, "AKSO.OL", "USD")  # saved USD, quoted NOK, and .OL trades in NOK
        _observe(db, wrong_price, "NOK")
        wrong_suffix = _holding(db, "NAS.OL", "EUR")  # no price yet
        no_price = _holding(db, "AAPL", "USD")
        db.commit()
        check = check_holding_currencies(db)

    assert check.checked == 4
    by_ticker = {f.ticker: f for f in check.findings}
    assert set(by_ticker) == {"AKSO.OL", "NAS.OL"}
    assert len(by_ticker["AKSO.OL"].issues) == 2
    assert "trade in NOK" in by_ticker["NAS.OL"].issues[0]
    assert no_price.ticker not in by_ticker and wrong_suffix.ticker in by_ticker


def test_pence_quote_matches_a_pound_holding():
    with _session() as db:
        holding = _holding(db, "SHEL.L", "GBP")
        _observe(db, holding, "GBp")
        db.commit()
        assert check_holding_currencies(db).findings == []


def test_stock_split_rows_query_back():
    with _session() as db:
        holding = _holding(db)
        db.add(StockSplit(holding_id=holding.id, ex_date=datetime(2024, 5, 1, tzinfo=UTC), ratio=D("5"), provider="y"))
        db.commit()
        assert db.scalars(select(StockSplit)).one().ratio == D("5")


# --- the flag reaches the valuation ----------------------------------------


def test_valuation_notes_a_price_jump_and_stays_quiet_otherwise():
    from app.services.valuation.holding_valuation import (
        HoldingValuationResult,
        _flag_price_jump,
    )

    with _session() as db:
        holding = _holding(db)
        db.add(MarketObservation(
            holding=holding, observed_at=datetime(2026, 10, 1, tzinfo=UTC), price=D("402.8"), currency="NOK", provider="y"
        ))
        calm = MarketObservation(
            holding=holding, observed_at=datetime(2026, 10, 5, tzinfo=UTC), price=D("410"), currency="NOK", provider="y"
        )
        jump = MarketObservation(
            holding=holding, observed_at=datetime(2026, 10, 9, tzinfo=UTC), price=D("80.5"), currency="NOK", provider="y"
        )
        other_currency = MarketObservation(
            holding=holding, observed_at=datetime(2026, 10, 12, tzinfo=UTC), price=D("80.5"), currency="USD", provider="y"
        )
        db.add_all([calm, jump, other_currency])
        db.commit()

        for obs, expected in ((calm, None), (jump, "5-for-1"), (other_currency, "currency changed")):
            result = HoldingValuationResult(holding_id=holding.id, ticker=holding.ticker)
            _flag_price_jump(db, obs, result)
            if expected is None:
                assert result.unavailable_reasons == []
            else:
                assert any(expected in r for r in result.unavailable_reasons)
