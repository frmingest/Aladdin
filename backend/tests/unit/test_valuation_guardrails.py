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
from app.services.market_data.common import cold_fetch_allowed
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


@pytest.fixture(autouse=True)
def _analysis_context():
    """These tests exercise the valuation on a fresh in-memory database the way
    an analysis run does, which may make the first-ever price / FX / beta call.
    (A plain page load may not: tests/unit/test_cold_fetch_rule.py.)"""
    with cold_fetch_allowed():
        yield


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


def test_default_settings_use_v5():
    assert Settings(_env_file=None).active_valuation_assumptions_version == "v5"


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


# ---------------- v4 (2026-10-07): normalised earnings for volatile histories


def test_v4_changes_only_the_base_earnings_method():
    import dataclasses

    v3, v4 = get_valuation_assumptions("v3"), get_valuation_assumptions("v4")
    differing = {f.name for f in dataclasses.fields(v3) if getattr(v3, f.name) != getattr(v4, f.name)}
    assert differing == {"version", "base_earnings_method"}
    assert (v4.normalisation_window_years, v4.normalisation_min_years) == (5, 3)
    assert v4.normalisation_dispersion == D(2)
    assert v3.base_earnings_method == "latest_year"
    assert v4.base_earnings_method == "normalised_median"


def test_normalised_base_is_the_median_and_flags_a_windfall():
    from app.services.valuation.growth import normalised_base

    # Equinor-shaped (USD m): a windfall year then a slide to a trough.
    history = [(2021, D("11004")), (2022, D("25013")), (2023, D("10522")), (2024, D("4973")), (2025, D("1908"))]
    result = normalised_base(history, window_years=5, min_years=3, dispersion=D(2))
    assert result.base == D("10522") and result.latest == D("1908")
    assert result.volatile and result.years == (2021, 2022, 2023, 2024, 2025)


def test_normalised_base_uses_the_mean_of_the_middle_pair_for_an_even_window():
    from app.services.valuation.growth import normalised_base

    history = [(2022, D("34657")), (2023, D("10072")), (2024, D("16417")), (2025, D("7284"))]
    result = normalised_base(history, window_years=5, min_years=3, dispersion=D(2))
    assert result.base == (D("10072") + D("16417")) / 2
    assert result.volatile  # 34,657 is more than twice the median


def test_normalised_base_calls_a_steady_history_stable_and_needs_three_years():
    from app.services.valuation.growth import normalised_base

    steady = [(2021, D("100")), (2022, D("110")), (2023, D("121")), (2024, D("133"))]
    assert not normalised_base(steady, window_years=5, min_years=3, dispersion=D(2)).volatile
    assert normalised_base(steady[:2], window_years=5, min_years=3, dispersion=D(2)) is None


def test_normalised_base_treats_a_loss_year_as_volatile():
    from app.services.valuation.growth import normalised_base

    history = [(2021, D("100")), (2022, D("-20")), (2023, D("105")), (2024, D("110"))]
    assert normalised_base(history, window_years=5, min_years=3, dispersion=D(2)).volatile


def test_v3_extrapolates_a_decline_but_v4_values_the_median(monkeypatch):
    earnings = ["110", "250", "105", "50", "19"]  # NOK m, 100m shares: the Equinor shape
    with _session() as db:
        holding = _ramp_up(db, earnings)
        r3 = _value(db, holding, price="20", monkeypatch=monkeypatch, settings=_v("v3"))
        r4 = _value(db, holding, price="20", monkeypatch=monkeypatch, settings=_v("v4"))
    assert r3.raw_base_growth_rate < D("-0.3")  # 110 -> 19: the projected collapse
    assert r3.valuation_status == "implausible"  # which is why the board showed nothing
    assert r4.assumptions_version == "v4"
    assert r4.raw_base_growth_rate == D("0.025") and not r4.growth_capped
    assert r4.valuation_status == "ok" and r4.dcf is not None
    assert any("median (105)" in reason and "FY2021-FY2025" in reason for reason in r4.unavailable_reasons)


def test_v4_leaves_a_steady_grower_exactly_as_v3(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["100", "110", "121", "133", "146"])
        r3 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
        r4 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v4"))
    assert r3.dcf.scenario("base").intrinsic_value_per_share == r4.dcf.scenario("base").intrinsic_value_per_share
    assert r3.base_growth_rate == r4.base_growth_rate


def test_v4_does_not_value_a_volatile_history_with_no_positive_median(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-50", "-20", "10", "-5", "20"])
        result = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v4"))
    assert result.dcf is None
    assert any("median is not positive" in reason for reason in result.unavailable_reasons)


def test_v4_with_two_years_of_history_keeps_the_v3_method(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["100", "130"])
        r3 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v3"))
        r4 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v4"))
    assert r3.base_growth_rate == r4.base_growth_rate
    assert r3.dcf.scenario("base").intrinsic_value_per_share == r4.dcf.scenario("base").intrinsic_value_per_share


# ------------- insurer ROE and equity-certificate banks (2026-10-07)


def test_thin_equity_is_structural_for_an_insurer_not_depletion():
    # Storebrand: ordinary equity 32.5bn is 3.3% of total assets.
    facts = {"net_income": D("5018"), "total_equity": D("33588"), "hybrid_capital": D("353"),
             "total_assets": D("1000000")}
    prior = {"net_income": D("5494"), "total_equity": D("32113"), "hybrid_capital": D("353"),
             "total_assets": D("950000")}
    industrial = compute_holding_metrics(facts, prior_facts=prior)
    assert "roe" not in industrial.computed and "depleted by distributions" in industrial.skipped["roe"]
    insurer = compute_holding_metrics(facts, prior_facts=prior, financial=True)
    assert round(insurer.computed["roe"], 3) == round(D("5018") / ((D("33235") + D("31760")) / 2), 3)


def test_a_financial_with_non_positive_equity_is_still_refused():
    facts = {"net_income": D("100"), "total_equity": D("-5"), "total_assets": D("1000")}
    result = compute_holding_metrics(facts, financial=True)
    assert "roe" not in result.computed and "not meaningful" in result.skipped["roe"]


def test_certificate_share_is_certificates_times_eps_over_net_income():
    from app.services.metrics import certificate_holder_share

    facts = {"net_income": D("494.3"), "eps_basic": D("6.82")}
    # Sparebanken Øst: 20.7m certificates vs 72.5m implied by net income / EPS
    assert round(certificate_holder_share(facts, D("20700000") / D("1000000")), 3) == D("0.286")
    assert certificate_holder_share(facts, D("72.5")) is None  # ordinary shares: ratio ~1
    assert certificate_holder_share({"net_income": D("100")}, D("10")) is None
    assert certificate_holder_share({"net_income": D("100"), "eps_basic": D("-1")}, D("10")) is None
    assert certificate_holder_share({"net_income": D("160"), "eps_basic": D("15.2")}, D("10")) is None  # 0.95


def test_a_certificate_banks_pe_and_pb_use_the_holders_share():
    from app.services.metrics import MarketInputs

    facts = {"net_income": D("160"), "eps_basic": D("6.4"), "total_equity": D("1200"), "total_assets": D("20000")}
    market = MarketInputs(price=D("50"), shares=D("10"))
    naive = compute_holding_metrics(facts, market=market, financial=False)
    assert naive.computed["price_to_earnings"] == D("500") / D("160")  # 3.1x: the bug
    cert = compute_holding_metrics(facts, market=market, financial=True)
    assert cert.computed["price_to_earnings"] == D("50") / D("6.4")  # price / EPS
    assert round(cert.computed["price_to_book"], 4) == round(D("50") / D("48"), 4)  # 1,200 x 0.4 / 10 = 48
    assert "equity-certificate bank" in cert.notes["price_to_earnings"]


def _certificate_bank(db, eps):
    holding = Holding(ticker="CERT.OL", name="Cert Bank", trading_currency="NOK", sector="Financials")
    document = _document(holding)
    db.add_all([holding, document])
    db.flush()
    for year, equity in _BANK_EQUITY.items():
        facts = {"net_income": _BANK_NET_INCOME[year], "total_equity": equity, "shares_outstanding": "10"}
        if year == "2025":
            facts["eps_basic"] = eps
        _add(db, document, holding, f"FY{year}", facts)
    db.commit()
    return holding


def test_a_certificate_bank_gets_book_value_per_certificate_not_per_implied_share(monkeypatch):
    with _session() as db:
        holding = _certificate_bank(db, "6.4")  # 10m certificates x 6.4 / 160 = 40%
        result = _value(db, holding, price="80", monkeypatch=monkeypatch)
    assert result.valuation_method == "financials_price_to_book"
    assert result.financials.book_value_per_share == D("48")  # 1,200 x 0.4 / 10, not 120
    assert any("Equity-certificate bank" in r and "40.0%" in r for r in result.unavailable_reasons)


def test_an_ordinary_bank_keeps_total_equity_over_shares(monkeypatch):
    with _session() as db:
        holding = _certificate_bank(db, "15.2")  # 10m x 15.2 / 160 = 95%: no certificate structure
        result = _value(db, holding, price="150", monkeypatch=monkeypatch)
    assert result.financials.book_value_per_share == D("120")
    assert not any("Equity-certificate bank" in r for r in result.unavailable_reasons)


# ------------------------- v5: cash-based owner earnings for upstream oil and gas


def test_v5_differs_from_v4_only_in_the_upstream_basis():
    import dataclasses

    v4, v5 = get_valuation_assumptions("v4"), get_valuation_assumptions("v5")
    differing = {
        f.name for f in dataclasses.fields(v4) if getattr(v4, f.name) != getattr(v5, f.name)
    }
    assert differing == {"version", "upstream_owner_earnings_basis"}
    assert v4.upstream_owner_earnings_basis == "net_income"
    assert v5.upstream_owner_earnings_basis == "cash"


# Vår Energi, USD millions FY2021-FY2025 (from the 2026-10-07 queries).
_VAR = {
    "FY2021": {"ni": "654.4", "da": "1704.6", "capex": "2584.9", "ocf": "4579.9", "lease": "43.8", "decom": "70.4"},
    "FY2022": {"ni": "936.4", "da": "1448.0", "capex": "2593.1", "ocf": "5681.9", "lease": "110.4", "decom": "70.3"},
    "FY2023": {"ni": "610.2", "da": "1422.6", "capex": "2641.0", "ocf": "3420.3", "lease": "94.3", "decom": "40.7"},
    "FY2024": {"ni": "311.5", "da": "1915.9", "capex": "2874.5", "ocf": "3407.9", "lease": "82.7", "decom": "66.8"},
    "FY2025": {"ni": "785.2", "da": "2710.1", "capex": "2819.7", "ocf": "4607.1", "lease": "125.6", "decom": "116.4"},
}


def _producer(db, *, sector="Energy", with_decommissioning=True, ticker="PROD.OL"):
    holding = Holding(ticker=ticker, name="Producer", trading_currency="NOK", sector=sector)
    document = _document(holding)
    db.add_all([holding, document])
    db.flush()
    for period, v in _VAR.items():
        facts = {
            "net_income": v["ni"], "depreciation_and_amortization": v["da"],
            "capital_expenditures": v["capex"], "operating_cash_flow": v["ocf"],
            "lease_payments_financing": v["lease"], "shares_outstanding": "2500",
        }
        if with_decommissioning:
            facts["decommissioning_payments"] = v["decom"]
        _add(db, document, holding, period, facts)
    db.commit()
    return holding


def test_an_energy_holding_with_decommissioning_payments_is_upstream():
    from app.services.upstream_detection import holding_is_upstream

    with _session() as db:
        assert holding_is_upstream(db, _producer(db))


def test_energy_without_decommissioning_payments_is_not_upstream():
    from app.services.upstream_detection import holding_is_upstream

    with _session() as db:
        assert not holding_is_upstream(db, _producer(db, with_decommissioning=False))


def test_decommissioning_payments_outside_energy_do_not_make_a_holding_upstream():
    from app.services.upstream_detection import holding_is_upstream

    for sector in ("Utilities", None):
        with _session() as db:
            assert not holding_is_upstream(db, _producer(db, sector=sector))


def test_cash_basis_owner_earnings_and_the_note_show_both_bases():
    from app.services.metrics import owner_earnings_from_facts

    v = _VAR["FY2025"]
    facts = {
        "net_income": D(v["ni"]), "depreciation_and_amortization": D(v["da"]),
        "capital_expenditures": D(v["capex"]), "operating_cash_flow": D(v["ocf"]),
        "lease_payments_financing": D(v["lease"]), "decommissioning_payments": D(v["decom"]),
    }
    cash, note = owner_earnings_from_facts(facts, cash_basis=True)
    assert cash == D("4607.1") - D("2819.7") - D("125.6") - D("116.4")
    classic = owner_earnings_from_facts(facts)[0]
    assert classic == D("785.2") + D("2710.1") - D("2819.7") - D("116.4") - D("125.6")
    assert "cash basis" in note and "net income basis" in note and "deferred" in note


def test_cash_basis_without_operating_cash_flow_returns_none_so_callers_fall_back():
    from app.services.metrics import owner_earnings_from_facts

    assert owner_earnings_from_facts(
        {"net_income": D("1"), "depreciation_and_amortization": D("1"), "capital_expenditures": D("1")},
        cash_basis=True,
    ) is None


def test_v4_leaves_the_producer_unranked_and_v5_values_it(monkeypatch):
    with _session() as db:
        holding = _producer(db)
        v4 = _value(db, holding, price="10", monkeypatch=monkeypatch, settings=_v("v4"))
        v5 = _value(db, holding, price="10", monkeypatch=monkeypatch, settings=_v("v5"))
    assert v4.dcf is None
    assert any("median is not positive" in r for r in v4.unavailable_reasons)
    assert v5.dcf is not None, (v5.valuation_status, v5.unavailable_reasons)
    assert any("operating cash flow - capex" in r and "v5" in r for r in v5.unavailable_reasons)
    # Median of cash-basis FY2021-25 (about 1.7bn after leases and decommissioning).
    assert any("median" in r for r in v5.unavailable_reasons)


def test_v5_does_not_touch_a_non_upstream_holding(monkeypatch):
    with _session() as db:
        holding = _ramp_up(db, ["-80", "120", "150", "180"])
        v4 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v4"))
        v5 = _value(db, holding, price="40", monkeypatch=monkeypatch, settings=_v("v5"))
    assert v5.dcf == v4.dcf
    assert not any("Upstream" in r for r in v5.unavailable_reasons)


def test_compute_holding_metrics_uses_cash_basis_only_when_told_upstream():
    v = _VAR["FY2025"]
    facts = {
        "net_income": D(v["ni"]), "depreciation_and_amortization": D(v["da"]),
        "capital_expenditures": D(v["capex"]), "operating_cash_flow": D(v["ocf"]),
    }
    plain = compute_holding_metrics(facts)
    upstream = compute_holding_metrics(facts, upstream=True)
    assert plain.computed["owner_earnings"] == D("785.2") + D("2710.1") - D("2819.7")
    assert upstream.computed["owner_earnings"] == D("4607.1") - D("2819.7")
    assert "cash basis" in upstream.notes["owner_earnings"]
