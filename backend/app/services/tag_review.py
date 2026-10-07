"""Tag review inbox (PR 1): the tag-review blocks stored with each ESEF
filing at extraction time, gathered per holding.

Read-only. Looks at each holding's newest tagged annual report only, and
drops a gap when another document already supplies that figure for the same
year (the same rule the metrics page uses for its coverage warning)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.services.documents.extraction import ixbrl as ix
from app.services.documents.extraction.tag_review import EXTRA_INPUTS

_METRICS_OF: dict[str, tuple[str, ...]] = {**dict(ix.CORE_INPUTS), **EXTRA_INPUTS}


def _review_of(document: Document) -> dict[str, Any] | None:
    review = ((document.quality_flags or {}).get("ixbrl") or {}).get("tag_review")
    return review if isinstance(review, dict) and review.get("fiscal_year") else None


def _chat_summary(ticker: str, name: str, filename: str, review: dict[str, Any]) -> str:
    lines = [f"Tag review: {name} ({ticker}), {review['fiscal_year']}, file {filename}"]
    for gap in review["gaps"]:
        top = gap["candidates"][:3]
        if not top:
            lines.append(f"- {gap['metric']}: not extracted, no tagged line looks close")
            continue
        names = "; ".join(f"{c['concept']} = {c['value']} {c['unit']} [{c['check']}]" for c in top)
        lines.append(f"- {gap['metric']}: not extracted. Closest tags: {names}")
    for row in review["unused"][:5]:
        lines.append(f"- tagged but unused: {row['concept']} = {row['value']} {row['unit']} ({row['share_of_base']} of revenue/assets)")
    return "\n".join(lines)


def build_tag_review(db: Session, holding_id: UUID | None = None) -> dict[str, Any]:
    query = select(Document).where(Document.holding_id.is_not(None), Document.status == "processed")
    if holding_id is not None:
        query = query.where(Document.holding_id == holding_id)
    newest: dict[UUID, tuple[Document, dict[str, Any]]] = {}
    for document in db.scalars(query):
        review = _review_of(document)
        if review is None:
            continue
        current = newest.get(document.holding_id)
        key = (review["fiscal_year"], document.uploaded_at)
        if current is None or key > (current[1]["fiscal_year"], current[0].uploaded_at):
            newest[document.holding_id] = (document, review)

    holdings: list[dict[str, Any]] = []
    for hid, (document, review) in newest.items():
        holding = db.get(Holding, hid)
        if holding is None:
            continue
        fy = review["fiscal_year"]
        supplied = {
            row.metric
            for row in db.scalars(
                select(FinancialLineItem).where(
                    FinancialLineItem.holding_id == hid, FinancialLineItem.period == fy
                )
            )
        }
        gaps = [
            g for g in review["gaps"]
            if not any(m in supplied for m in _METRICS_OF.get(g["metric"], ()))
        ]
        if not gaps and not review["unused"]:
            continue
        shown = {**review, "gaps": gaps}
        holdings.append(
            {
                "holding_id": hid,
                "ticker": holding.ticker,
                "name": holding.name,
                "document_id": document.id,
                "filename": document.original_filename,
                "fiscal_year": fy,
                "gaps": gaps,
                "unused": review["unused"],
                "chat_summary": _chat_summary(holding.ticker, holding.name, document.original_filename, shown),
            }
        )
    holdings.sort(key=lambda h: (-len(h["gaps"]), h["name"].lower()))
    return {
        "holdings": holdings,
        "holdings_needing_review": sum(1 for h in holdings if h["gaps"]),
        "total_gaps": sum(len(h["gaps"]) for h in holdings),
    }
