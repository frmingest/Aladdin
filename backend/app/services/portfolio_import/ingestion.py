"""Portfolio CSV import — DB side.

Stores the raw file as a traceable Document (no page/text extraction here
— see csv_parser.py's docstring for why this structured format doesn't go
through the PDF/PPTX/XLSX extraction pipeline in
app/services/documents/ingestion.py), then find-or-creates the Account and
Holdings the parsed rows point at, and creates one PortfolioSnapshot + its
PortfolioPositions in a single transaction.

Every PortfolioSnapshot still points at a real uploaded Document
(source_file_id, NOT NULL) — Faiz's explicit traceability choice
(2026-09-21, see app/api/portfolio.py's module docstring) applies here
exactly as it does to the manual snapshot-create path.

Faiz also explicitly asked (same session) that every row in these mixed
brokerage exports be imported — stocks, equity ETFs, bond funds,
money-market funds, a physical gold ETC — tagged with its real instrument
type via app/domain/instrument_types.py, rather than silently dropping the
non-equity rows. CLAUDE.md Rule 1 (deterministic arithmetic) applies: every
figure below is either a raw broker-reported value or a simple
weight/cost-basis computation from those raw values, never LLM output.

Holding-matching bug fixed 2026-09-21 (Faiz's report: garbage tickers,
duplicate holdings — see claude/csv-import-ticker-sector-fixes-and-db-wipe-
2026-09-21.md): the dedup key used to be an exact match on
`_slugify_ticker(name) == Holding.ticker`, so a holding that already
existed under any other ticker (a real market ticker Faiz assigned by hand,
or — before the 2026-09-21 full data wipe — a legacy row whose "ticker"
was literally its raw display name) was never found, and every re-import
quietly spawned a fresh duplicate Holding instead of matching the real
one. Matching is now by normalized security *name* (see `_normalize_name`)
against every existing holding, independent of whatever's in `ticker` —
the slug is only ever a same-import fallback ticker for a holding that's
genuinely new, meant to be overwritten with the real market ticker via
`PATCH /holdings/{id}` (see app/api/holdings.py).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.document_types import DOCUMENT_STATUS_PROCESSED
from app.domain.errors import FileTooLargeError, UnsupportedFileTypeError
from app.domain.instrument_types import classify_instrument
from app.models.account import Account
from app.models.document import Document
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.hashing import sha256_hex
from app.services.portfolio_import.csv_parser import (
    CsvParseError,
    extract_account_number_from_filename,
    parse_broker_csv,
)

CSV_EXTENSION = ".csv"
CSV_DOCUMENT_TYPE = "portfolio_export"
SNAPSHOT_STATUS_PROCESSED = "processed"

_WEIGHT_QUANTIZE = Decimal("0.0001")  # matches portfolio_positions.weight_pct Numeric(9, 4)
_COST_QUANTIZE = Decimal("0.000001")  # matches portfolio_positions.cost_basis Numeric(20, 6)
# Same Numeric(20, 6) precision as cost_basis — matches
# portfolio_positions.last_price / .market_value_nok.
_PRICE_QUANTIZE = Decimal("0.000001")

# Norwegian letters that show up in these real exports ("Vår Energi",
# "Høyrente") and would otherwise just get silently dropped by the
# alnum-only slug/normalize regexes below (neither is NFKD-decomposable
# the way "å" -> "a" + combining ring is — æ/ø are their own letters, not
# accented forms). Spelled out rather than guessed at.
_TRANSLITERATE = str.maketrans({"æ": "ae", "Æ": "AE", "ø": "o", "Ø": "O", "å": "a", "Å": "A"})


@dataclass
class PortfolioImportResult:
    document: Document
    account: Account
    snapshot: PortfolioSnapshot
    holdings_created: int
    holdings_matched: int
    was_duplicate_file: bool


def _slugify_ticker(name: str, *, taken: set[str]) -> str:
    """Best-effort *placeholder* ticker for a brand-new holding — never a
    real market symbol (see this module's docstring). Transliterated first
    so "Vår Energi" produces the readable "VAR-ENERGI" instead of the
    broken "V-R-ENERGI" a plain alnum-strip gives (å isn't ASCII, so it
    used to just vanish, splitting the word). Disambiguated against
    `taken` (existing tickers plus any already assigned earlier in this
    same import) with a numeric suffix, since two differently-named
    securities can collide once non-alnum characters are stripped (e.g.
    "L&G Gold Mining ETF" and a hypothetical "L G Gold Mining ETF" both
    slug to "L-G-GOLD-MINING-ETF") — the unique-ticker constraint would
    otherwise turn that into a 500 instead of two distinct holdings.
    """
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name.translate(_TRANSLITERATE)).strip("-").upper()
    slug = slug[:250] or "HOLDING"
    candidate = slug
    suffix = 2
    while candidate in taken:
        candidate = f"{slug[:245]}-{suffix}"
        suffix += 1
    return candidate


def looks_like_placeholder_ticker(ticker: str, name: str) -> bool:
    """True when `ticker` is (very likely) the auto-generated placeholder
    `_slugify_ticker` produced for `name`, rather than a real market symbol.

    Used by the analysis readiness check (app/services/analysis/readiness.py)
    to warn before an LLM run is spent on a holding whose ticker can't be
    priced. Short single-word slugs are *not* treated as placeholders, because
    a company called "Meta" legitimately slugs to its real ticker "META" —
    real symbols are short, while placeholders are either multi-word
    ("VAR-ENERGI") or long ("EQUINOR").
    """
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name.translate(_TRANSLITERATE)).strip("-").upper()[:250]
    if not slug:
        return False
    upper = ticker.upper()
    matches = upper == slug or re.fullmatch(re.escape(slug[:245]) + r"-\d+", upper) is not None
    return matches and ("-" in slug or len(slug) > 6)


def _normalize_name(name: str) -> str:
    """Case/diacritic/punctuation-insensitive dedup key for a security
    name — matches "Vår Energi" against "VAR ENERGI", "vår-energi", etc.
    so re-importing the same broker export (or a second account holding
    the same security) finds the existing Holding instead of creating a
    duplicate. See this module's docstring for the bug this replaced.
    """
    return re.sub(r"[^a-z0-9]+", "", name.translate(_TRANSLITERATE).lower())


def _find_or_create_account(db: Session, *, account_number: str, name_hint: str | None) -> Account:
    account = db.query(Account).filter(Account.account_number == account_number).one_or_none()
    if account is not None:
        return account
    account = Account(name=name_hint or f"Account {account_number}", account_number=account_number)
    db.add(account)
    db.flush()
    return account


def _find_or_create_holding(
    db: Session,
    *,
    name: str,
    currency: str,
    holdings_by_name: dict[str, Holding],
    tickers_taken: set[str],
) -> tuple[Holding, bool]:
    """Returns (holding, was_created).

    `holdings_by_name`/`tickers_taken` are built once per import (see
    `import_portfolio_csv`) and mutated as new holdings are created within
    the same file, so two rows in the same CSV that normalize to the same
    name (shouldn't happen, but a broker export is untrusted input) still
    resolve to one Holding rather than two.
    """
    normalized = _normalize_name(name)
    holding = holdings_by_name.get(normalized)
    if holding is not None:
        return holding, False

    ticker = _slugify_ticker(name, taken=tickers_taken)
    holding = Holding(
        ticker=ticker,
        name=name,
        trading_currency=currency,
        asset_class_raw=classify_instrument(name),
    )
    db.add(holding)
    db.flush()
    holdings_by_name[normalized] = holding
    tickers_taken.add(ticker)
    return holding, True


def import_portfolio_csv(
    db: Session,
    storage: ObjectStorageProvider,
    *,
    filename: str,
    content: bytes,
    account_number: str | None = None,
    account_name: str | None = None,
) -> PortfolioImportResult:
    if not filename.lower().endswith(CSV_EXTENSION):
        raise UnsupportedFileTypeError(filename, (CSV_EXTENSION,))

    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise FileTooLargeError(filename, len(content), max_bytes)

    resolved_account_number = account_number or extract_account_number_from_filename(filename)
    if not resolved_account_number:
        raise CsvParseError(
            filename,
            "no account_number given and none found in the filename "
            "(expected a pattern like '...kontono._12345678_...')",
        )

    # Parse before touching storage/DB — an unparseable file should fail
    # with nothing written, not leave an orphaned Document behind.
    positions = parse_broker_csv(content, filename)

    digest = sha256_hex(content)
    document = db.query(Document).filter(Document.sha256 == digest).one_or_none()
    was_duplicate = document is not None
    if document is None:
        storage_key = f"{digest}/{filename}"
        storage_path = storage.store(storage_key, content)
        document = Document(
            holding_id=None,
            type=CSV_DOCUMENT_TYPE,
            original_filename=filename,
            mime_type="text/csv",
            size_bytes=len(content),
            storage_path=storage_path,
            reporting_period=None,
            sha256=digest,
            status=DOCUMENT_STATUS_PROCESSED,
            quality_flags={},
        )
        db.add(document)
        db.flush()

    account = _find_or_create_account(
        db, account_number=resolved_account_number, name_hint=account_name
    )

    total_value_nok = sum((p.value_nok for p in positions), Decimal(0))

    snapshot = PortfolioSnapshot(
        source_file_id=document.id,
        reporting_currency="NOK",
        status=SNAPSHOT_STATUS_PROCESSED,
        account_id=account.id,
    )
    db.add(snapshot)
    db.flush()

    # Built once per import, not re-queried per row (see
    # _find_or_create_holding) — both the matching bug fix and a
    # page-load-speed-style batching win over the old per-row query.
    existing_holdings = db.query(Holding).all()
    holdings_by_name = {_normalize_name(h.name): h for h in existing_holdings}
    tickers_taken = {h.ticker for h in existing_holdings}

    holdings_created = 0
    holdings_matched = 0
    for p in positions:
        holding, created = _find_or_create_holding(
            db,
            name=p.name,
            currency=p.currency,
            holdings_by_name=holdings_by_name,
            tickers_taken=tickers_taken,
        )
        holdings_created += 1 if created else 0
        holdings_matched += 0 if created else 1

        weight_pct = (
            (p.value_nok / total_value_nok * 100).quantize(_WEIGHT_QUANTIZE)
            if total_value_nok
            else None
        )
        cost_basis = (p.avg_cost * p.quantity).quantize(_COST_QUANTIZE)
        # Both raw broker-reported figures (CLAUDE.md Rule 1 — not derived
        # here), previously parsed and then discarded — see migration
        # a2b4c6d8e0f1's docstring. "siste kurs" is genuinely absent from
        # some real exports (see csv_parser.py's REQUIRED_FIELDS, which
        # doesn't include it), so last_price can legitimately be None.
        last_price = p.last_price.quantize(_PRICE_QUANTIZE) if p.last_price is not None else None
        market_value_nok = p.value_nok.quantize(_PRICE_QUANTIZE)

        db.add(
            PortfolioPosition(
                snapshot_id=snapshot.id,
                holding_id=holding.id,
                weight_pct=weight_pct,
                quantity=p.quantity,
                cost_basis=cost_basis,
                cost_basis_currency=p.currency,
                last_price=last_price,
                market_value_nok=market_value_nok,
                account_id=account.id,
            )
        )

    db.commit()
    db.refresh(snapshot)
    return PortfolioImportResult(
        document=document,
        account=account,
        snapshot=snapshot,
        holdings_created=holdings_created,
        holdings_matched=holdings_matched,
        was_duplicate_file=was_duplicate,
    )
