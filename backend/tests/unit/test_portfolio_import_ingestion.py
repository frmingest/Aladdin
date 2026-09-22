from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.domain.errors import UnsupportedFileTypeError
from app.domain.instrument_types import BOND_FUND, MONEY_MARKET_FUND, STOCK
from app.models import Account, Base, Holding, PortfolioPosition, PortfolioSnapshot
from app.models.holding import EQUITY_ASSET_CLASS
from app.providers.object_storage import LocalObjectStorageProvider
from app.services.portfolio_import.csv_parser import CsvParseError
from app.services.portfolio_import.ingestion import import_portfolio_csv

HEADER = "Handel\tValuta\tAntall\tGAV\t% i dag\tsiste kurs\tBelåningsverdi\tVerdi NOK\tAvkast.\tAvkast. NOK"


def _utf16(text: str) -> bytes:
    return text.encode("utf-16")


def _account_74_bytes() -> bytes:
    rows = [
        HEADER,
        "Alfred Berg Nordic High Yield II R (NOK)\tNOK\t617,445\t108,5408\t0\t108,4539\t33482,159\t66964,318\t-0,08\t-53,65",
        "Salmon Evolution\tNOK\t209\t3,9588\t-3,90625\t3,075\t77,121\t642,675\t-22,32\t-184,705",
    ]
    return _utf16("\n".join(rows))


def _account_66_bytes() -> bytes:
    rows = [
        HEADER,
        # Same fund name as account 74's file — must dedup to one Holding.
        "Alfred Berg Nordic High Yield II R (NOK)\tNOK\t45,2779\t108,4856\t0\t108,4539\t2455,28\t4910,56\t-0,03\t-1,44",
        "Heimdal Høyrente Pluss B (NOK)\tNOK\t222,5916\t108,8541\t-0,06\t108,8676\t7269,90\t24233,01\t0,01\t3,01",
    ]
    return _utf16("\n".join(rows))


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture()
def storage(tmp_path):
    return LocalObjectStorageProvider(str(tmp_path))


def test_import_creates_account_holdings_snapshot_and_tags_instrument_types(db, storage):
    result = import_portfolio_csv(
        db,
        storage,
        filename="Beholdningstabell_eksport_kontono._73898074_15.9.2026.csv",
        content=_account_74_bytes(),
    )

    assert result.holdings_created == 2
    assert result.holdings_matched == 0
    assert result.was_duplicate_file is False

    account = db.query(Account).one()
    assert account.account_number == "73898074"

    snapshot = db.query(PortfolioSnapshot).one()
    assert snapshot.account_id == account.id
    assert snapshot.reporting_currency == "NOK"
    assert snapshot.source_file_id == result.document.id

    positions = db.query(PortfolioPosition).all()
    assert len(positions) == 2
    weights = sorted(p.weight_pct for p in positions)
    # Both positions' weights sum to ~100% of this snapshot's total value.
    assert sum(weights) == pytest.approx(100, abs=0.01)

    bond_fund = db.query(Holding).filter(Holding.name.contains("Alfred Berg")).one()
    assert bond_fund.asset_class_raw == BOND_FUND
    assert bond_fund.asset_class == "equity"  # legacy NOT NULL column, never branched on

    stock = db.query(Holding).filter(Holding.name == "Salmon Evolution").one()
    assert stock.asset_class_raw == STOCK


def test_last_price_and_market_value_are_persisted(db, storage):
    """Regression test for 2026-09-22: both were parsed out of the CSV
    ("siste kurs" / "Verdi NOK") but silently discarded — last_price was
    never read after parsing, and value_nok was only used transiently to
    compute weight_pct. See migration a2b4c6d8e0f1's docstring."""
    import_portfolio_csv(
        db,
        storage,
        filename="Beholdningstabell_eksport_kontono._73898074_15.9.2026.csv",
        content=_account_74_bytes(),
    )

    salmon = (
        db.query(PortfolioPosition)
        .join(Holding)
        .filter(Holding.name == "Salmon Evolution")
        .one()
    )
    assert salmon.last_price == Decimal("3.075000")
    assert salmon.market_value_nok == Decimal("642.675000")
    # quantity/cost_basis were already being saved correctly before this
    # fix — only last_price/market_value_nok were the actual data gap.
    assert salmon.quantity == Decimal(209)
    assert salmon.cost_basis == Decimal("827.389200")


def test_second_account_reuses_matching_holding_by_name(db, storage):
    import_portfolio_csv(
        db,
        storage,
        filename="Beholdningstabell_eksport_kontono._73898074_15.9.2026.csv",
        content=_account_74_bytes(),
    )
    result = import_portfolio_csv(
        db,
        storage,
        filename="Beholdningstabell_eksport_kontono._73898066_15.9.2026.csv",
        content=_account_66_bytes(),
    )

    # "Alfred Berg..." already exists from the first import; only
    # "Heimdal..." is new in this second file.
    assert result.holdings_created == 1
    assert result.holdings_matched == 1

    assert db.query(Account).count() == 2
    assert db.query(PortfolioSnapshot).count() == 2

    heimdal = db.query(Holding).filter(Holding.name.contains("Heimdal")).one()
    assert heimdal.asset_class_raw == MONEY_MARKET_FUND

    alfred_berg_holdings = db.query(Holding).filter(Holding.name.contains("Alfred Berg")).all()
    assert len(alfred_berg_holdings) == 1  # deduped, not duplicated


def test_reuploading_identical_file_is_a_no_op_duplicate(db, storage):
    content = _account_74_bytes()
    first = import_portfolio_csv(
        db, storage, filename="export.csv", content=content, account_number="73898074"
    )
    second = import_portfolio_csv(
        db, storage, filename="export.csv", content=content, account_number="73898074"
    )

    assert first.was_duplicate_file is False
    assert second.was_duplicate_file is True
    assert second.document.id == first.document.id
    # A re-upload still creates its own snapshot (a new point-in-time
    # record), it just doesn't re-store or re-hash the file.
    assert db.query(PortfolioSnapshot).count() == 2


def test_rejects_non_csv_extension(db, storage):
    with pytest.raises(UnsupportedFileTypeError):
        import_portfolio_csv(
            db, storage, filename="export.xlsx", content=b"whatever", account_number="123"
        )


def test_raises_when_no_account_number_resolvable(db, storage):
    with pytest.raises(CsvParseError):
        import_portfolio_csv(db, storage, filename="random_export.csv", content=_account_74_bytes())


def test_explicit_account_name_used_for_new_account(db, storage):
    result = import_portfolio_csv(
        db,
        storage,
        filename="export.csv",
        content=_account_74_bytes(),
        account_number="99999",
        account_name="My ASK",
    )
    assert result.account.name == "My ASK"


def _var_energi_bytes() -> bytes:
    rows = [
        HEADER,
        "Vår Energi\tNOK\t1456\t35,5\t-1,3153087\t54,02\t55057,184\t78653,12\t52,17\t26965,15",
    ]
    return _utf16("\n".join(rows))


def test_matches_existing_holding_with_different_ticker_by_normalized_name(db, storage):
    """Reproduces Faiz's real bug (2026-09-21): a holding that already
    exists under a real/manually-assigned ticker used to be invisible to
    the CSV importer's old dedup key (an exact match on
    _slugify_ticker(name) == Holding.ticker), so re-importing the same
    security spawned a garbage-tickered duplicate instead of matching it.
    Matching is now by normalized name, independent of what's in `ticker`.
    """
    existing = Holding(
        ticker="VAR.OL",  # a real market ticker Faiz assigned by hand
        name="Vår Energi",
        trading_currency="NOK",
        asset_class_raw=STOCK,
        asset_class=EQUITY_ASSET_CLASS,
    )
    db.add(existing)
    db.commit()

    result = import_portfolio_csv(
        db, storage, filename="export.csv", content=_var_energi_bytes(), account_number="123"
    )

    assert result.holdings_created == 0
    assert result.holdings_matched == 1
    holdings = db.query(Holding).filter(Holding.name == "Vår Energi").all()
    assert len(holdings) == 1
    # The real ticker Faiz assigned is preserved, not clobbered or duplicated.
    assert holdings[0].ticker == "VAR.OL"


def test_new_holding_gets_a_readable_transliterated_ticker(db, storage):
    """Norwegian letters (æøå) used to just vanish from the slug (not
    ASCII, not NFKD-decomposable to an ASCII base letter), turning "Vår
    Energi" into the broken "V-R-ENERGI" instead of a readable
    placeholder. This is still just a placeholder ticker, not a real
    market symbol — Faiz assigns the real one via PATCH /holdings/{id}."""
    result = import_portfolio_csv(
        db, storage, filename="export.csv", content=_var_energi_bytes(), account_number="123"
    )
    assert result.holdings_created == 1
    holding = db.query(Holding).filter(Holding.name == "Vår Energi").one()
    assert holding.ticker == "VAR-ENERGI"


def test_slug_ticker_collision_with_unrelated_existing_ticker_is_disambiguated(db, storage):
    """A brand-new security's auto-generated placeholder ticker can still
    collide with an unrelated holding's ticker (e.g. one Faiz assigned by
    hand via the Add Holding form) even though the two are obviously
    different securities — must get a disambiguating suffix, not a
    UNIQUE-constraint 500."""
    unrelated = Holding(
        ticker="TEST",  # coincidentally what "Test AS" below would also slug to
        name="Some Unrelated Company",
        trading_currency="NOK",
        asset_class_raw=STOCK,
        asset_class=EQUITY_ASSET_CLASS,
    )
    db.add(unrelated)
    db.commit()

    rows = [HEADER, "Test\tNOK\t10\t100\t0\t100\t1000\t1000\t0\t0"]
    content = _utf16("\n".join(rows))
    result = import_portfolio_csv(
        db, storage, filename="export.csv", content=content, account_number="123"
    )
    assert result.holdings_created == 1
    new_holding = db.query(Holding).filter(Holding.name == "Test").one()
    assert new_holding.ticker == "TEST-2"
