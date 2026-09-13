"""Phase 1 — portfolio and document ingestion

Adds the tables backing portfolio upload + document ingestion (architecture
§20, §26 Phase 1): holdings, documents (+ pages, chunks), portfolio snapshots
(+ positions), and deterministic financial line items.

Written by hand rather than `alembic revision --autogenerate` — Phase 0 never
got a live Postgres running locally (Docker wasn't installed yet), so there
was nothing to diff against. Once Docker/Postgres is up, `alembic upgrade
head` applies this directly; later phases can go back to autogenerate.

Revision ID: a0f4172c5989
Revises:
Create Date: 2026-09-12

"""

import sqlalchemy as sa
from alembic import op

from app.models.types import GUID

# revision identifiers, used by Alembic.
revision = "a0f4172c5989"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "holdings",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("asset_class", sa.String(16), nullable=False),
        sa.Column("asset_class_raw", sa.String(64), nullable=False),
        sa.Column("sector", sa.String(128), nullable=True),
        sa.Column("trading_currency", sa.String(3), nullable=False),
        sa.Column("institution", sa.String(128), nullable=True),
        sa.Column("custody_type", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("ticker", name="uq_holdings_ticker"),
    )
    op.create_index("ix_holdings_ticker", "holdings", ["ticker"])

    op.create_table(
        "documents",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=True),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("storage_path", sa.String(512), nullable=False),
        sa.Column("reporting_period", sa.String(32), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("quality_flags", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("sha256", name="uq_documents_sha256"),
    )
    op.create_index("ix_documents_holding_id", "documents", ["holding_id"])
    op.create_index("ix_documents_sha256", "documents", ["sha256"])

    op.create_table(
        "document_pages",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("extraction_quality", sa.String(32), nullable=False),
    )
    op.create_index("ix_document_pages_document_id", "document_pages", ["document_id"])

    op.create_table(
        "document_chunks",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=False),
        sa.Column("page_end", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(255), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_document_chunks_content_hash", "document_chunks", ["content_hash"])

    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_file_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("reporting_currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
    )

    op.create_table(
        "portfolio_positions",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column(
            "snapshot_id", GUID(), sa.ForeignKey("portfolio_snapshots.id"), nullable=False
        ),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("weight_pct", sa.Numeric(9, 4), nullable=True),
        sa.Column("quantity", sa.Numeric(20, 6), nullable=True),
        sa.Column("cost_basis", sa.Numeric(20, 6), nullable=True),
        sa.Column("cost_basis_currency", sa.String(3), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_portfolio_positions_snapshot_id", "portfolio_positions", ["snapshot_id"])
    op.create_index("ix_portfolio_positions_holding_id", "portfolio_positions", ["holding_id"])

    op.create_table(
        "financial_line_items",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("document_id", GUID(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("holding_id", GUID(), sa.ForeignKey("holdings.id"), nullable=False),
        sa.Column("metric", sa.String(64), nullable=False),
        sa.Column("value", sa.Numeric(24, 6), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("period", sa.String(32), nullable=False),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_financial_line_items_document_id", "financial_line_items", ["document_id"]
    )
    op.create_index(
        "ix_financial_line_items_holding_id", "financial_line_items", ["holding_id"]
    )


def downgrade() -> None:
    op.drop_table("financial_line_items")
    op.drop_table("portfolio_positions")
    op.drop_table("portfolio_snapshots")
    op.drop_table("document_chunks")
    op.drop_table("document_pages")
    op.drop_table("documents")
    op.drop_table("holdings")
