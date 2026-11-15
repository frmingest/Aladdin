"""Printer P1.5: rate and krone sensitivity measured from a holding's own history. The series below are
built from exact returns, so the regression has a known answer to be checked against."""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from app.domain.game_mapping import printer_sensitivity_v1 as R
from app.domain.game_mapping import printer_v1 as T
from app.services.game import printer as P
from app.services.game import printer_sensitivity as S

D = Decimal
START = date(2024, 1, 5)  # a Friday


def _series(n: int, *, b_market="0.8", b_rate="-6", b_krone="0.4", noise="0.2", own_noise_only=False, start=START):
    """Weekly closes for a holding, the benchmark, the 10-year yield and USD/NOK, with the holding's
    return = 0.5 + b_market*m + b_rate*dr + b_krone*k + small deterministic noise."""
    asset, bench, rate, fx = [], [], [], []
    a, b, r, f = D(100), D(100), D("3"), D(10)
    for i in range(n + 1):
        day = start + timedelta(weeks=i)
        asset.append((day, a)); bench.append((day, b)); rate.append((day, r)); fx.append((day, f))
        m = D((i * 7) % 11 - 5) * D("0.4")
        dr = D((i * 5) % 13 - 6) * D("0.03")
        k = D((i * 3) % 17 - 8) * D("0.25")
        e = D((i * 11) % 7 - 3) * D(noise)
        y = e if own_noise_only else D("0.5") + D(b_market) * m + D(b_rate) * dr + D(b_krone) * k + e
        a *= 1 + y / 100
        b *= 1 + m / 100
        r += dr
        f *= 1 - k / 100
    return asset, bench, rate, fx


def test_recovers_the_known_rate_and_krone_sensitivity():
    found, why = S.measure(*_series(100))
    assert why is None and found is not None
    assert found.weeks == 100
    assert abs(found.long_rate - D("-6")) < D("0.6")
    assert abs(found.krone - D("0.4")) < D("0.1")
    assert found.r_squared > D("0.9")


def test_a_short_history_measures_nothing_and_says_why():
    found, why = S.measure(*_series(R.MIN_WEEKS - 5))
    assert found is None and "weeks" in why


def test_noise_alone_gives_no_coefficient_to_use():
    found, why = S.measure(*_series(100, b_market="0", b_rate="0", b_krone="0", own_noise_only=True))
    assert why is None
    assert found.long_rate is None and found.krone is None


def test_collinear_inputs_are_refused_not_guessed():
    asset, bench, _rate, fx = _series(100)
    # a yield that is just the market again: the two cannot be told apart
    r = D("3")
    rate2 = []
    prev = None
    for (day, b) in bench:
        if prev is not None:
            r += (b - prev) / 50
        rate2.append((day, r))
        prev = b
    found, _why = S.measure(asset, bench, rate2, fx)
    assert found is None or (found.long_rate is None)


def test_weekly_last_keeps_the_last_close_of_each_week():
    pts = [(date(2024, 1, 1), D(1)), (date(2024, 1, 3), D(2)), (date(2024, 1, 8), D(3))]
    assert list(S.weekly_last(pts).values()) == [D(2), D(3)]


def test_a_bad_price_is_skipped_not_turned_into_a_return():
    asset, bench, rate, fx = _series(100)
    asset[10] = (asset[10][0], D(0))
    rows = S._weekly_rows(asset, bench, rate, fx)
    assert len(rows) == 98  # the zero close removes the return into it and the return out of it


def _holding(**kw):
    return P.SimHolding(uuid.uuid4(), "A", "A", "Utilities", D("1000"), D("1.0"), "price_history", **kw)


def test_a_measured_coefficient_replaces_the_sector_guess_and_earns_medium():
    pulls = [P.Pull("toll_gate", D("1"))]
    guess = P.run([_holding()], pulls).holdings[0]
    measured = P.run([_holding(long_rate_coef=D("-6"), krone_coef=D("0.4"))], pulls).holdings[0]
    by = {t.channel: t for t in measured.terms}
    assert by[T.LONG_RATE].basis == "measured" and by[T.LONG_RATE].coefficient == D("-6")
    # the Toll Gate's long-rate cell is game judgement (Low), so a measured holding term cannot beat it
    assert by[T.LONG_RATE].confidence == T.LOW
    assert {t.channel: t.basis for t in guess.terms}[T.LONG_RATE] == "sector_guess"
    # the guessed krone term of a Utilities holding is zero; a measured one now appears
    assert T.USDNOK in by and T.USDNOK not in {t.channel for t in guess.terms}


def test_unmeasured_holdings_behave_exactly_as_before():
    pulls = [P.Pull("toll_gate", D("1"))]
    a = P.run([_holding()], pulls).holdings[0]
    assert all(t.basis in ("beta", "sector_guess") for t in a.terms)


def _toll_gate(**kw):
    return P.run([_holding(**kw)], [P.Pull("toll_gate", D("1"))]).holdings[0]


def test_small_measured_sensitivity_lets_the_toll_gate_show_an_amount_but_a_big_one_does_not():
    """The only route to a NOK range in v1: a measured small rate and krone term is no longer a material guess."""
    assert _toll_gate().show_amount is False  # sector guess (Utilities, -8 per pp) is material and Low
    calm = _toll_gate(long_rate_coef=D("-1"), krone_coef=D("0.1"))
    assert calm.confidence == T.MEDIUM and calm.show_amount is True
    sensitive = _toll_gate(long_rate_coef=D("-6"), krone_coef=D("0.4"))
    assert sensitive.confidence == T.LOW and sensitive.show_amount is False


def test_measuring_the_holding_cannot_lift_a_lever_whose_own_cells_are_judgement():
    """Great Press: equity cell is Low, so a measured holding stays direction-only however clear the fit."""
    r = P.run([_holding(long_rate_coef=D("-1"), krone_coef=D("0.1"))], [P.Pull("great_press", D("2"))]).holdings[0]
    assert r.confidence == T.LOW and r.show_amount is False
