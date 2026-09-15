"""Guards the holdings.ticker column width directly against the model
definition — SQLite (the test DB for everything else) doesn't enforce
varchar length, so an integration-test upload alone wouldn't catch a
regression back to the old, too-narrow column; only Postgres does (see
tests/integration/test_portfolio_api.py's
test_upload_accepts_a_ticker_longer_than_the_old_32_char_limit for the
end-to-end behavior)."""

from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition


def test_holding_ticker_column_is_wide_enough_for_a_full_instrument_name():
    column = Holding.__table__.columns["ticker"]
    # A Nordnet export (decision 0003) has no exchange ticker at all — the
    # full instrument name is used as the key instead, and real fund names
    # ("Xtrackers Europe Defence Technologies UCITS ETF 1C") run past the
    # original varchar(32). 255 matches `name`'s width.
    assert column.type.length == 255


def test_portfolio_position_acquired_at_column_is_nullable():
    """Phase 8 (ADR 0011) — every brokerage-sourced position leaves this
    unset; only a manually-entered lot (or a canonical-schema CSV row that
    supplies it) populates it."""
    column = PortfolioPosition.__table__.columns["acquired_at"]
    assert column.nullable is True
