"""Regression tests for the 2026-09-29 valuation guardrails
(docs/sb1no-implausible-dcf-investigation-2026-09-29.md).

SB1NO.OL — a Norwegian bank — showed a DCF base value of 3,953 NOK against
a 229.50 NOK price ("Strong Buy", price target 3,170-4,899 NOK). These tests
pin the four things that produced it: an uncapped 31.5% historical CAGR
compounded for ten years, an owner-earnings DCF applied to a bank, no
plausibility check, and industrial metrics shown as bank "risks"."""
from decimal import Decimal
from types import SimpleNamespace

import pytest

import app.services.valuation.holding_valuation as hv
from app.config.settings import Settings
from app.domain.sectors import is_financial_sector
from app.domain.valuation_assumptions import get_valuation_assumptions
from app.models import Document, FinancialLineItem, Holding
from app.providers.base import RiskFreeRate
from app.services.analysis.pipeline import _attach_price_target
from app.services.metrics import (
    compute_holding_metrics,
    mark_not_meaningful_for_financials,
)
from app.services.valuation import dcf, financials
from tests.unit.test_holding_valuation import (
    _FakeMarketDataProvider,
    _FakeRiskFreeRateProvider,
    _price_point,
    _session,
)

D = Decimal


# ---------------------------------------------------------------- dcf fade


def test_growth_path_is_constant_without_a_fade():
    assert dcf.growth_path(D("0.10"), 4) == [D("0.10")] * 4


def test_growth_path_fades_linearly_to_the_terminal_rate():
    path = dcf.growth_path(D("0.10"), 4, fade_to_growth=D("0.04"))
    assert path == [D("0.10"), D("0.08"), D("0.06"), D("0.04")]


def test_growth_path_single_year_uses_the_starting_rate():
    assert dcf.growth_path(D("0.10"), 1, fade_to_growth=D("0.02")) == [D("0.10")]


def test_growth_path_raises_on_zero_years():
    with pytest.raises(ValueError, match="years must be >= 1"):
        dcf.growth_path(D("0.10"), 0)


def test_a_fading_projection_is_worth_less_than_a_constant_one():
    kwargs = {
        "base_owner_earnings": D("100"), "growth_rate": D("0.20"), "discount_rate": D("0.08"),
        "terminal_growth_rate": D("0.025"), "years": 10,
    }
    constant = dcf.intrinsic_equity_value(**kwargs)
    fading = dcf.intrinsic_equity_value(**kwargs, fade_to_growth=D("0.025"))
    assert fading < constant


def test_reverse_dcf_recovers_growth_when_fading():
    kwargs = {
        "base_owner_earnings": D("100"), "discount_rate": D("0.09"), "terminal_growth_rate": D("0.025"),
        "years": 10, "shares_outstanding": D("10"),
    }
    price = dcf.intrinsic_value_per_share(growth_rate=D("0.06"), fade_to_growth=D("0.025"), **kwargs)
    solved = dcf.reverse_dcf_implied_growth(current_price_per_share=price, fade_to_terminal=True, **kwargs)
    assert abs(solved - D("0.06")) < D("0.001")


# ------------------------------------------------- justified price-to-book


def test_justified_pb_known_answer():
    # (0.15 - 0.025) / (0.10 - 0.025) = 5/3
    assert financials.justified_price_to_book(D("0.15"), D("0.10"), D("0.025")) == D("0.125") / D("0.075")


def test_a_bank_earning_exactly_its_cost_of_equity_is_worth_book_value():
    assert financials.justified_price_to_book(D("0.09"), D("0.09"), D("0.025")) == D(1)


def test_justified_pb_never_goes_negative():
    assert financials.justified_price_to_book(D("0.01"), D("0.09"), D("0.025")) == D(0)


def test_justified_pb_raises_when_cost_of_equity_does_not_exceed_growth():
    with pytest.raises(ValueError, match="must exceed"):
        financials.justified_price_to_book(D("0.12"), D("0.025"), D("0.025"))


def _fin(**overrides):
    args = {
        "roes": [D("0.12"), D("0.13"), D("0.14")], "book_value_per_share": D("100"),
        "cost_of_equity": D("0.08"), "growth_rate": D("0.025"), "max_roe": D("0.20"),
        "roe_spread": D("0.02"), "current_price_per_share": D("150"),
    }
    args.update(overrides)
    return financials.financials_valuation(**args)


def test_financials_valuation_orders_bear_base_bull():
    result = _fin()
    bear, base, bull = (result.scenario(x).value_per_share for x in ("bear", "base", "bull"))
    assert bear < base < bull
    assert result.scenario("base").roe == D("0.13")
    assert result.roe_periods_used == 3
    assert not result.roe_was_capped


def test_financials_valuation_caps_an_unsustainable_roe():
    result = _fin(roes=[D("0.35")])
    assert result.roe_was_capped
    assert result.scenario("base").roe == D("0.20")


def test_financials_margin_of_safety_sign_follows_price():
    result = _fin(current_price_per_share=D("100"))
    assert result.margin_of_safety("base") > 0
    assert _fin(current_price_per_share=D("1000")).margin_of_safety("base") < 0
    assert _fin(current_price_per_share=None).margin_of_safety("base") is None


@pytest.mark.parametrize(
    "overrides,message",
    [
        ({"roes": []}, "no ROE"),
        ({"book_value_per_share": D("0")}, "book value"),
        ({"roes": [D("0.02")]}, "does not exceed growth"),
    ],
)
def test_financials_valuation_fails_visibly(overrides, message):
    with pytest.raises(ValueError, match=message):
        _fin(**overrides)


# ------------------------------------------------------------ v2 assumptions


def test_v1_is_untouched_and_has_no_guardrails():
    v1 = get_valuation_assumptions("v1")
    assert v1.max_base_growth is None and v1.plausibility_max_ratio is None
    assert not v1.fade_growth_to_terminal and v1.min_cost_of_equity is None
    assert v1.financials_sector_keywords == ()


def test_v2_turns_the_guardrails_on_and_keeps_v1_market_inputs():
    v1, v2 = get_valuation_assumptions("v1"), get_valuation_assumptions("v2")
    assert v2.max_base_growth == D("0.10") and v2.fade_growth_to_terminal
    assert v2.min_cost_of_equity == D("0.08") and v2.plausibility_max_ratio == D("3")
    assert v2.equity_risk_premium == v1.equity_risk_premium
    assert v2.terminal_growth_rate == v1.terminal_growth_rate
    assert v2.min_cost_of_equity > v2.terminal_growth_rate


def test_default_settings_use_v3():
    assert Settings(_env_file=None).active_valuation_assumptions_version == "v3"


def test_v3_changes_only_the_growth_base_method():
    import dataclasses

    v2, v3 = get_valuation_assumptions("v2"), get_valuation_assumptions("v3")
    assert v2.growth_base_method == "earliest_period"
    assert v3.growth_base_method == "profitable_run"
    differing = {
        f.name for f in dataclasses.fields(v2) if getattr(v2, f.name) != getattr(v3, f.name)
    }
    assert differing == {"version", "growth_base_method"}


@pytest.mark.parametrize("sector", ["Financials", "financial services", "Regional Banks", "Insurance"])
def test_financial_sectors_are_recognised(sector):
    assert is_financial_sector(sector)


@pytest.mark.parametrize("sector", [None, "", "Energy", "Information Technology", "Real Estate"])
def test_other_sectors_are_not_financial(sector):
    assert not is_financial_sector(sector)


# --------------------------------------------- SB1NO.OL regression (the bug)

# Owner earnings in NOK millions, FY2019-FY2025: the shape that gave a 31.5%
# CAGR for SB1NO.OL (1,213 -> 6,273 across a bank merger).
_SB1NO_OWNER_EARNINGS = ["1213", "1600", "3030", "3900", "4700", "5500", "6273"]


def _rate() -> RiskFreeRate:
    from datetime import datetime, timezone

    return RiskFreeRate(
        currency="NOK", rate=D("4.286"), observed_at=datetime.now(timezone.utc),
        provider="fake", source_series_id="FAKE10Y",
    )


def _add(db, document, holding, period, facts, currency="NOK"):
    for metric, value in facts.items():
        db.add(
            FinancialLineItem(
                document=document, holding=holding, metric=metric, value=D(value), unit=currency,
                currency=currency, period=period, confidence=0.95,
            )
        )


def _document(holding):
    return Document(
        holding=holding, type="filing", original_filename="ar.xhtml", mime_type="application/xhtml+xml",
        size_bytes=100, storage_path="documents/ar.xhtml", sha256="b" * 64, status="processed",
        quality_flags={},
    )


def _industrial(db, *, sector=None):
    holding = Holding(ticker="GROW.OL", name="Fast Grower", trading_currency="NOK", sector=sector)
    document = _document(holding)
    db.add_all([holding, document])
    db.flush()
    for offset, owner_earnings in enumerate(_SB1NO_OWNER_EARNINGS):
        _add(
            db, document, holding, f"FY{2019 + offset}",
            {"net_income": owner_earnings, "depreciation_and_amortization": "0",
             "capital_expenditures": "0", "shares_outstanding": "370.6"},
        )
    db.commit()
    return holding


def _value(db, holding, *, price, settings=None, monkeypatch=None):
    monkeypatch.setattr(hv, "get_settings", lambda: settings or Settings(_env_file=None))
    return hv.compute_holding_valuation(
        db, holding,
        _FakeMarketDataProvider(price=_price_point(price, "NOK"), beta=D("0.54")),
        _FakeRiskFreeRateProvider(rate=_rate()),
    )


def test_v1_reproduces_the_bug_an_absurd_dcf_value(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        result = _value(
            db, holding, price="229.5", monkeypatch=monkeypatch,
            settings=Settings(_env_file=None, active_valuation_assumptions_version="v1"),
        )
    base = result.dcf.scenario("base").intrinsic_value_per_share
    assert result.dcf is not None and base > D("2000")  # ~17x a 229.50 price
    assert result.valuation_status == "ok"  # v1 has no guard — this is the old behaviour


def test_v2_caps_the_growth_and_reports_it(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        result = _value(db, holding, price="229.5", monkeypatch=monkeypatch)
    assert result.raw_base_growth_rate > D("0.30")
    assert result.base_growth_rate == D("0.10")
    assert result.growth_capped
    assert result.dcf is not None and result.dcf.fades_to_terminal
    assert result.valuation_status == "ok"
    assert any("capped at 10.0%" in reason for reason in result.unavailable_reasons)
    # a capped, fading DCF lands in a believable range for a 229.50 price
    assert D("100") < result.dcf.scenario("base").intrinsic_value_per_share < D("700")


def test_v2_floors_a_low_beta_cost_of_equity(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        result = _value(db, holding, price="229.5", monkeypatch=monkeypatch)
    assert result.capm_cost_of_equity < D("0.08")  # 4.286% + 0.54 x 4.5%
    assert result.discount_rate == D("0.08")
    assert any("floored at 8.0%" in reason for reason in result.unavailable_reasons)


def test_an_implausible_dcf_is_withheld_not_shown(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        # A 20 NOK price makes even the capped DCF worth many times the price.
        result = _value(db, holding, price="20", monkeypatch=monkeypatch)
    assert result.valuation_status == "implausible"
    assert result.dcf is None and result.rejected_dcf is not None
    assert result.headline_values() is None
    assert result.headline_margin_of_safety("base") is None
    assert "x the share price" in result.valuation_status_reason
    assert any("withheld as not credible" in reason for reason in result.unavailable_reasons)


def test_a_withheld_valuation_never_becomes_a_price_target(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        result = _value(db, holding, price="20", monkeypatch=monkeypatch)
    run = SimpleNamespace(price_target_low=None, price_target_high=None, price_target_currency=None)
    _attach_price_target(run, SimpleNamespace(valuation=result))
    assert run.price_target_low is None and run.price_target_high is None


def test_a_credible_valuation_still_becomes_a_price_target(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        result = _value(db, holding, price="229.5", monkeypatch=monkeypatch)
    run = SimpleNamespace(price_target_low=None, price_target_high=None, price_target_currency=None)
    _attach_price_target(run, SimpleNamespace(valuation=result))
    assert run.price_target_low < run.price_target_high
    assert run.price_target_currency == "NOK"


def test_a_value_far_below_the_price_is_also_withheld(monkeypatch):
    with _session() as db:
        holding = _industrial(db)
        result = _value(db, holding, price="5000", monkeypatch=monkeypatch)
    assert result.valuation_status == "implausible"
    assert "of the share price" in result.valuation_status_reason


# ------------------------------------------------------- banks (financials)

# NOK millions; 10m shares so book value per share = equity / 10.
_BANK_EQUITY = {"2020": "900", "2021": "950", "2022": "1000", "2023": "1060", "2024": "1120", "2025": "1200"}
_BANK_NET_INCOME = {"2020": "110", "2021": "125", "2022": "130", "2023": "140", "2024": "150", "2025": "160"}


def _bank(db, *, sector="Financials"):
    holding = Holding(ticker="BANK.OL", name="Test Bank", trading_currency="NOK", sector=sector)
    document = _document(holding)
    db.add_all([holding, document])
    db.flush()
    for year, equity in _BANK_EQUITY.items():
        _add(
            db, document, holding, f"FY{year}",
            {"net_income": _BANK_NET_INCOME[year], "total_equity": equity, "shares_outstanding": "10"},
        )
    db.commit()
    return holding


def test_a_bank_is_valued_on_price_to_book_not_the_dcf(monkeypatch):
    with _session() as db:
        holding = _bank(db)
        result = _value(db, holding, price="150", monkeypatch=monkeypatch)
    assert result.valuation_method == "financials_price_to_book"
    assert result.dcf is None and result.financials is not None
    assert result.valuation_status == "ok"
    assert "does not apply to banks" in result.valuation_status_reason
    assert result.financials.book_value_per_share == D("120")  # 1,200 / 10
    assert result.financials.roe_periods_used >= 4
    values = result.headline_values()
    assert values["bear"] < values["base"] < values["bull"]
    assert result.headline_margin_of_safety("base") is not None


def test_a_bank_with_an_absurd_price_gap_is_withheld(monkeypatch):
    with _session() as db:
        holding = _bank(db)
        result = _value(db, holding, price="20", monkeypatch=monkeypatch)
    assert result.valuation_status == "implausible"
    assert result.financials is None and result.rejected_financials is not None
    assert result.headline_values() is None


def test_a_bank_without_financials_is_unavailable_not_invented(monkeypatch):
    with _session() as db:
        holding = Holding(ticker="NEW.OL", name="New Bank", trading_currency="NOK", sector="Financials")
        db.add(holding)
        db.commit()
        result = _value(db, holding, price="100", monkeypatch=monkeypatch)
    assert result.valuation_status == "unavailable"
    assert result.headline_values() is None
    assert any("Price-to-book valuation unavailable" in reason for reason in result.unavailable_reasons)


def test_the_same_facts_in_a_non_financial_sector_use_the_dcf(monkeypatch):
    with _session() as db:
        holding = _industrial(db, sector="Industrials")
        result = _value(db, holding, price="229.5", monkeypatch=monkeypatch)
    assert result.valuation_method == "owner_earnings_dcf"
    assert result.dcf is not None and result.financials is None


# --------------------------------------------------- industrial-only metrics


def test_interest_coverage_is_not_meaningful_for_a_bank():
    facts = {
        "net_income": D("100"), "ebit": D("140"), "interest_expense": D("380"), "total_equity": D("1000"),
        "revenue": D("300"),
    }
    plain = compute_holding_metrics(facts)
    assert "interest_coverage" in plain.computed  # 0.37x-style number, a "risk" for an industrial
    marked = mark_not_meaningful_for_financials(compute_holding_metrics(facts))
    assert "interest_coverage" not in marked.computed
    assert "not meaningful for a bank" in marked.skipped["interest_coverage"]
    assert "net_margin" in marked.computed  # measures that still apply survive


# ------------------------------- v3: a loss-making early year (Sprint 19)


def _ramp_up(db, earnings):
    """A company whose filed owner earnings (NOK millions) are `earnings`."""
    holding = Holding(ticker="RAMP.OL", name="Ramp Up", trading_currency="NOK", sector="Consumer Staples")
    document = _document(holding)
    db.add_all([holding, document])
    db.flush()
    for offset, owner_earnings in enumerate(earnings):
        _add(
            db, document, holding, f"FY{2021 + offset}",
            {"net_income": owner_earnings, "depreciation_and_amortization": "0",
             "capital_expenditures": "0", "shares_outstanding": "100"},
        )
    db.commit()
    return holding


def _v(version):
    return Settings(_env_file=None, active_valuation_assumptions_version=version)


def test_v2_still_refuses_a_company_whose_earliest_year_is_a_loss(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-80", "120", "150", "180"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v2"))
    assert result.dcf is None
    assert any("earliest period's value is not positive" in r for r in result.unavailable_reasons)


def test_v3_values_it_on_the_profitable_run_and_says_what_it_left_out(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-80", "120", "150", "180"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    assert result.dcf is not None and result.valuation_status == "ok"
    assert result.assumptions_version == "v3"
    # 120 -> 180 over two years
    assert round(result.raw_base_growth_rate, 4) == round(D("1.5") ** D("0.5") - 1, 4)
    assert any("FY2022-FY2024" in r and "FY2021" in r for r in result.unavailable_reasons)


def test_v3_gives_the_same_answer_as_v2_when_every_year_is_profitable(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["100", "110", "121", "133"])
        r2 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v2"))
        r3 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    assert r2.dcf.scenario("base").intrinsic_value_per_share == r3.dcf.scenario("base").intrinsic_value_per_share
    assert r2.base_growth_rate == r3.base_growth_rate


def test_v3_does_not_guess_when_the_latest_year_is_a_loss(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["100", "120", "-30"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    assert result.dcf is None
    assert any("FY2023" in r and "not profitable" in r for r in result.unavailable_reasons)


def test_v3_does_not_guess_from_a_single_profitable_year(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-80", "-40", "60"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
    assert result.dcf is None
    assert any("only one profitable year" in r for r in result.unavailable_reasons)
