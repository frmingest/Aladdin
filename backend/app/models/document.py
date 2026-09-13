"""
Document ingestion tables (architecture §6, §20).

`documents` covers both holding-level source reports (annual/quarterly
reports, presentations) and the portfolio CSV/XLSX upload itself — the latter
has holding_id = NULL. Treating the portfolio file as a Document too means it
gets the same hash/dedup/provenance/storage treatment as everything else
rather than a parallel, weaker code path.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.types import GUID, new_uuid


class DocumentType(str, enum.Enum):
    PORTFOLIO_SNAPSHOT = "PORTFOLIO_SNAPSHOT"
    ANNUAL_REPORT = "ANNUAL_REPORT"
    QUARTERLY_REPORT = "QUARTERLY_REPORT"
    PRESENTATION = "PRESENTATION"
    OTHER = "OTHER"


class DocumentStatus(str, enum.Enum):
    """§6.1 document state machine."""

    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    VALIDATED = "VALIDATED"
    FAILED = "FAILED"
    STALE = "STALE"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    holding_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=True, index=True
    )

    type: Mapped[str] = mapped_column(String(32), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    reporting_period: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # SHA-256 of the raw bytes — global unique constraint gives us dedup for
    # free (§6: "SHA-256 hash / deduplication").
    sha256: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DocumentStatus.UPLOADED.value
    )
    # §6.4 extraction quality flags — e.g. ["low_text_extraction", "missing_pages"].
    quality_flags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    pages: Mapped[list["DocumentPage"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Document {self.original_filename} ({self.status})>"


class DocumentPage(Base):
    """One page (PDF), slide (PPT), or sheet (XLSX) of extracted text."""

    __tablename__ = "document_pages"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    document_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("documents.id"), nullable=False, index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # §6.4 — e.g. "ok" | "low_text" | "malformed_table".
    extraction_quality: Mapped[str] = mapped_column(String(32), nullable=False, default="ok")

    document: Mapped["Document"] = relationship(back_populates="pages")


class DocumentChunk(Base):
    """Section/page-range chunk used to keep reasoning calls off raw
    documents later (§6.3) — populated in Phase 1, consumed starting Phase 3."""

    __tablename__ = "document_chunks"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    document_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("documents.id"), nullable=False, index=True
    )
    page_start: Mapped[int] = mapped_column(Integer, nullable=False)
    page_end: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    document: Mapped["Document"] = relationship(back_populates="chunks")
