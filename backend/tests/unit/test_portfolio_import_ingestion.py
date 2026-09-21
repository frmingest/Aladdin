import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.domain.errors import UnsupportedFileTypeError
from app.domain.instrument_types import BOND_FUND, MONEY_MARKET_FUND, STOCK
from app.models import Account, Base, Holding, PortfolioPosition, PortfolioSnapshot
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
