"""Guards the holdings.ticker column width directly against the model
definition — SQLite (the test DB for everything else) doesn't enforce
varchar length, so an integration-test upload alone wouldn't catch a
regression back to the old, too-narrow column; only Postgres does (see
tests/integration/test_portfolio_api.py's
test_upload_accepts_a_ticker_longer_than_the_old_32_char_limit for the
end-to-end behavior)."""

from app.models.holding import Holding


def test_holding_ticker_column_is_wide_enough_for_a_full_instrument_name():
    column = Holding.__table__.columns["ticker"]
    # A Nordnet export (decision 0003) has no exchange ticker at all — the
    # full instrument name is used as the key instead, and real fund names
    # ("Xtrackers Europe Defence Technologies UCITS ETF 1C") run past the
    # original varchar(32). 255 matches `name`'s width.
    assert column.type.length == 255
