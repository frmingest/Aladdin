"""What today's price assumes for a company with no DCF (2026-10-14).

A loss-making company (Vend Marketplaces, Salmon Evolution, Vår Energi) has no
owner-earnings base to project, so it stays "unavailable" and unranked. The
page now also says what yearly owner earnings the price already counts on, as
information only: never a value, a zone or a margin of safety."""
from decimal import Decimal

import pytest

from app.schemas.valuation import BoardRowOut
from app.services.market_data.common import cold_fetch_allowed
from app.services.valuation.price_assumes import price_assumes
from tests.unit.test_holding_valuation import _session
from tests.unit.test_valuation_guardrails import _ramp_up, _v, _value

D = Decimal


@pytest.fixture(autouse=True)
def _analysis_context():
    with cold_fetch_allowed():
        yield


# ------------------------------------------------------------------ the sum


def test_required_owner_earnings_is_the_gordon_value_solved_for_the_cash_flow():
    result = price_assumes(
        price_per_share=D("10"), shares_outstanding=D("100"),
        discount_rate=D("0.09"), terminal_growth_rate=D("0.025"),
    )
    assert result.market_cap == D("1000")
    # market cap = OE x (1 + g) / (r - g)  =>  OE = 1000 x 0.065 / 1.025
    assert result.required_owner_earnings == D("1000") * D("0.065") / D("1.025")
    assert result.required_per_share == result.required_owner_earnings / D("100")
    assert result.required_owner_earnings * D("1.025") / D("0.065") == pytest.approx(D("1000"))


def test_a_higher_price_needs_higher_owner_earnings():
    kwargs = {"shares_outstanding": D("100"), "discount_rate": D("0.09"), "terminal_growth_rate": D("0.025")}
    assert (
        price_assumes(price_per_share=D("20"), **kwargs).required_owner_earnings
        > price_assumes(price_per_share=D("10"), **kwargs).required_owner_earnings
    )


@pytest.mark.parametrize(
    ("price", "shares", "rate", "growth", "message"),
    [
        ("0", "100", "0.09", "0.025", "price per share must be positive"),
        ("-5", "100", "0.09", "0.025", "price per share must be positive"),
        ("10", "0", "0.09", "0.025", "shares outstanding must be positive"),
        ("10", "100", "0.025", "0.025", "must exceed terminal growth rate"),
        ("10", "100", "0.02", "0.025", "must exceed terminal growth rate"),
    ],
)
def test_it_refuses_inputs_that_make_no_sense(price, shares, rate, growth, message):
    with pytest.raises(ValueError, match=message):
        price_assumes(
            price_per_share=D(price), shares_outstanding=D(shares),
            discount_rate=D(rate), terminal_growth_rate=D(growth),
        )


# ------------------------------------------------------------- the valuation


def test_a_loss_making_latest_year_stays_unranked_but_shows_what_the_price_assumes(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["100", "120", "-30"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    # Still not valued: no DCF, no headline values, no ranking input.
    assert result.dcf is None
    assert result.headline_values() is None
    assert result.valuation_status == "unavailable"
    assert any("not profitable" in r for r in result.unavailable_reasons)
    # But the price is read.
    read = result.price_assumes
    assert read is not None
    assert read.price_per_share == D("40")
    assert read.market_cap == read.price_per_share * read.shares_outstanding
    assert read.discount_rate == result.discount_rate
    assert read.required_owner_earnings > 0
    assert read.latest_owner_earnings == D("-30")
    assert read.latest_period == "FY2023"


def test_a_single_profitable_year_also_shows_what_the_price_assumes(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-80", "-40", "60"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    assert result.dcf is None
    assert any("only one profitable year" in r for r in result.unavailable_reasons)
    assert result.price_assumes is not None
    assert result.price_assumes.latest_owner_earnings == D("60")


def test_volatile_earnings_with_a_non_positive_median_show_what_the_price_assumes(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-100", "-50", "-80", "20", "-10"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v4"))
    assert result.dcf is None
    assert any("median is not positive" in r for r in result.unavailable_reasons)
    assert result.price_assumes is not None
    assert result.price_assumes.latest_owner_earnings == D("-10")


def test_a_profitable_company_is_valued_as_before_and_has_no_price_reading(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["100", "110", "121", "133"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    assert result.dcf is not None and result.valuation_status == "ok"
    assert result.price_assumes is None


def test_the_board_payload_accepts_the_service_object():
    read = price_assumes(
        price_per_share=D("10"), shares_outstanding=D("100"),
        discount_rate=D("0.09"), terminal_growth_rate=D("0.025"),
        latest_owner_earnings=D("-5"), latest_period="FY2025",
    )
    out = BoardRowOut(
        holding_id="00000000-0000-0000-0000-000000000001", ticker="X.OL", name="X", sector=None,
        market_value_nok=None, weight_pct=None, valuation_currency="NOK", price=D("10"), price_as_of=None,
        bear=None, base=None, bull=None, margin_of_safety_base=None, margin_of_safety_bear=None,
        zone="unavailable", unavailable_reason="DCF unavailable", verdict_rating=None, moat_rating=None,
        analyzed_at=None, price_assumes=read,
    )
    assert out.price_assumes is not None
    assert out.price_assumes.required_owner_earnings == read.required_owner_earnings
    assert out.price_assumes.latest_period == "FY2025"
