"""The Printer engine (game mode, Royal Mint, 2026-10-20). Numbers below are worked by hand
from printer_v1.py; if a table cell changes, a new printer_v2.py is the right move, not an edit."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest

from app.domain.game_mapping import printer_v1 as T
from app.services.game import printer as P

D = Decimal


def _h(ticker="A", sector="Utilities", value="1000", beta="1.0", method="price_history"):
    return P.SimHolding(
        uuid.uuid4(), ticker, ticker, sector,
        None if value is None else D(value), None if beta is None else D(beta), method,
    )


def test_table_is_well_formed():
    for lever in T.LEVERS.values():
        assert lever.variants
        for table in lever.variants.values():
            assert set(table) == {(ch, h) for ch in T.CHANNELS for h in T.HORIZONS}
            for eff in table.values():
                assert eff.low <= eff.base <= eff.high
                assert eff.source in T.SOURCES
    # a Medium or High cell must rest on a real source, never on judgement alone
    for lever in T.LEVERS.values():
        for table in lever.variants.values():
            for eff in table.values():
                if eff.confidence == T.MEDIUM:
                    assert eff.source != "judgement"


def test_no_pull_changes_nothing():
    r = P.run([_h()], [])
    assert all(c.range.is_zero for c in r.channels.values())
    h = r.holdings[0]
    assert h.status == P.MODELLED and h.terms == [] and h.direction == "unclear"
    assert h.show_amount is False
    assert r.warnings == []


def test_toll_gate_plus_one_matches_the_table():
    r = P.run([_h()], [P.Pull("toll_gate", D("1"))])
    eq = r.channels[T.EQUITY]
    assert (eq.range.low, eq.range.base, eq.range.high) == (D("-6"), D("-4"), D("-2"))
    assert eq.confidence == T.MEDIUM
    assert r.channels[T.SHORT_RATE].confidence == T.HIGH


def test_a_cut_flips_the_ranges_and_keeps_low_below_high():
    r = P.run([], [P.Pull("toll_gate", D("-1"))])
    eq = r.channels[T.EQUITY].range
    assert (eq.low, eq.base, eq.high) == (D("2"), D("4"), D("6"))


def test_utilities_holding_worked_by_hand():
    # equity: beta 1.0 x (-6,-4,-2); long rate: -8 x (0.2,0.5,0.8) = (-6.4,-4,-1.6);
    # spread: -4 x (0,0.1,0.3) = (-1.2,-0.4,0); usd share 0, inflation sens 0 => no terms.
    # total = (-13.6, -8.4, -3.6); whole percent, widest-safe: (-14, -8, -3).
    h = P.run([_h()], [P.Pull("toll_gate", D("1"))]).holdings[0]
    assert (h.pct.low, h.pct.base, h.pct.high) == (D("-14"), D("-8"), D("-3"))
    assert h.direction == "down"
    # the long-rate term is a sector guess (Low) and carries a big share of the range => Low
    assert h.confidence == T.LOW
    assert h.show_amount is False and h.nok is None  # Low means direction only


def test_real_terms_subtract_cumulative_inflation_change():
    # Toll Gate +1 at 1 year: inflation channel (-0.3,-0.1,0) pp. Utilities has inflation sens 0,
    # so nominal == real for it. Energy has +3 % per pp: term = 3 x (-0.3,-0.1,0) = (-0.9,-0.3,0).
    r = P.run([_h(sector="Energy")], [P.Pull("toll_gate", D("1"))], horizon=1)
    h = r.holdings[0]
    # real = nominal - cumulative price-level change; cumulative = (-0.3,-0.1,0) x 1 year
    # real.low = nominal.low - 0 ; real.high = nominal.high + 0.3 ; (before rounding)
    assert h.real_pct.high >= h.pct.high
    assert h.real_pct.low == h.pct.low


def test_three_year_horizon_uses_its_own_column_and_is_wider_or_lower_confidence():
    one = P.run([], [P.Pull("toll_gate", D("1"))], 1).channels[T.EQUITY]
    three = P.run([], [P.Pull("toll_gate", D("1"))], 3).channels[T.EQUITY]
    assert three.confidence == T.LOW and one.confidence == T.MEDIUM
    assert (three.range.high - three.range.low) > (one.range.high - one.range.low)


def test_opposite_pulls_on_one_channel_are_flagged_as_cancelling():
    r = P.run([], [P.Pull("great_press", D("2")), P.Pull("great_melt", D("2"))])
    assert r.channels[T.LONG_RATE].cancelling is True
    assert any("cancel" in w for w in r.warnings)
    # QE long rate base -0.05 x 2 = -0.10 ; QT +0.05 x 2 = +0.10 => base nets to zero
    assert r.channels[T.LONG_RATE].range.base == D("0")


def test_stacked_pulls_are_capped():
    r = P.run([], [P.Pull("coin_rain", D("10")), P.Pull("great_press", D("10"))])
    for ch, res in r.channels.items():
        cap = T.CHANNEL_CAPS[ch]
        assert -cap <= res.range.low <= res.range.base <= res.range.high <= cap
    assert r.channels[T.USDNOK].capped is True  # coin rain -5% x 10 would be -50%


def test_wild_pull_warns_by_count_and_by_size():
    many = P.run([], [P.Pull("toll_gate", D("0.5")), P.Pull("great_press", D("1")), P.Pull("great_melt", D("1"))])
    assert many.wild and any("wild" in w for w in many.warnings)
    big = P.run([], [P.Pull("toll_gate", D("3"))])
    assert big.wild
    calm = P.run([], [P.Pull("toll_gate", D("0.5"))])
    assert not calm.wild


def test_unknown_stays_unknown():
    r = P.run([_h(beta=None), _h("B", value=None)], [P.Pull("toll_gate", D("1"))])
    assert [h.status for h in r.holdings] == [P.NOT_MODELLED, P.NOT_MODELLED]
    assert r.portfolio_pct is None and r.coverage == D("0.0000")


def test_validation_rejects_bad_pulls():
    with pytest.raises(ValueError, match="unknown lever"):
        P.run([], [P.Pull("nope", D("1"))])
    with pytest.raises(ValueError, match="twice"):
        P.run([], [P.Pull("toll_gate", D("1")), P.Pull("toll_gate", D("2"))])
    with pytest.raises(ValueError, match="between"):
        P.run([], [P.Pull("toll_gate", D("9"))])
    with pytest.raises(ValueError, match="variant"):
        P.run([], [P.Pull("harbour_guard", D("1"), "default")])
    with pytest.raises(ValueError, match="horizon"):
        P.run([], [], horizon=2)


def test_harbour_guard_variants_differ():
    ster = P.run([], [P.Pull("harbour_guard", D("2"), "sterilised")]).channels
    unster = P.run([], [P.Pull("harbour_guard", D("2"), "unsterilised")]).channels
    assert ster[T.SHORT_RATE].range.is_zero and not unster[T.SHORT_RATE].range.is_zero
    assert ster[T.USDNOK].confidence == T.LOW


def test_amounts_appear_only_when_confidence_is_not_low(monkeypatch):
    # A synthetic lever whose only effect is on the market, backed by a Medium source, on a
    # holding whose sector profile has no exposure to anything else.
    medium = T.E("-6", "-4", "-2", T.MEDIUM, "bk2004", "test")
    zero = T.E("0", "0", "0", T.HIGH, "judgement", "test")
    table = {(ch, h): (medium if ch == T.EQUITY else zero) for ch in T.CHANNELS for h in T.HORIZONS}
    lever = T.Lever("test", "Test", "x", "up", "u", D("-3"), D("3"), D("0"), {"default": table})
    monkeypatch.setitem(T.LEVERS, "test", lever)
    monkeypatch.setitem(T.SECTOR_PROFILES, "Flat", T.SectorProfile(D(0), D(0), D(0), D(0)))
    r = P.run([_h(sector="Flat", beta="0.5", value="2000")], [P.Pull("test", D("1"))])
    h = r.holdings[0]
    # 0.5 x (-6,-4,-2) = (-3,-2,-1) percent of 2000 NOK = (-60,-40,-20)
    assert h.confidence == T.MEDIUM and h.show_amount
    assert (h.nok.low, h.nok.base, h.nok.high) == (D("-60"), D("-40"), D("-20"))
    assert r.show_portfolio_amount and r.portfolio_nok.base == D("-40")
    # a vendor beta is itself only Low, so the same holding drops back to direction only
    low = P.run([_h(sector="Flat", beta="0.5", value="2000", method="vendor_beta")], [P.Pull("test", D("1"))]).holdings[0]
    assert low.confidence == T.LOW and not low.show_amount and low.nok is None and low.direction == "down"


def test_range_never_narrows_when_rounded():
    r = P.Range(D("-3.2"), D("-2.5"), D("-1.1"))
    w = P._whole(r)
    assert w.low <= r.low and w.high >= r.high


@pytest.mark.parametrize(
    ("low", "base", "high", "expected"),
    [("1", "2", "3", "up"), ("-3", "-2", "-1", "down"), ("-2", "2", "3", "leans_up"),
     ("-3", "-2", "2", "leans_down"), ("-5", "0", "5", "unclear"), ("0", "0", "0", "unclear")],
)
def test_direction_wording(low, base, high, expected):
    assert P._direction(P.Range(D(low), D(base), D(high))) == expected
