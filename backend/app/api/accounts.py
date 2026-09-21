"""Account CRUD endpoints — Sprint 1's "Minimal API" deliverable, alongside
holdings. Accounts are the real-world custody/brokerage accounts a
portfolio snapshot's positions get attributed to (see
app/models/portfolio.py); until now they had no API either.

Deletion follows the same destructive-operation guardrail as holdings
(CLAUDE.md): requires `confirm=true`, refused while positions or snapshots
still reference the account.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.account import Account
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _to_out(db: Session, account: Account) -> AccountOut:
    position_count = db.scalar(
        select(func.count())
        .select_from(PortfolioPosition)
        .where(PortfolioPosition.account_id == account.id)
    )
    snapshot_count = db.scalar(
        select(func.count())
        .select_from(PortfolioSnapshot)
        .where(PortfolioSnapshot.account_id == account.id)
    )
    return AccountOut(
        id=account.id,
        name=account.name,
        account_number=account.account_number,
        institution=account.institution,
        created_at=account.created_at,
        updated_at=account.updated_at,
        position_count=position_count or 0,
        snapshot_count=snapshot_count or 0,
    )


@router.post("", response_model=AccountOut, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)) -> AccountOut:
    existing = db.scalar(select(Account).where(Account.account_number == payload.account_number))
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"an account with number '{payload.account_number}' already exists",
        )

    account = Account(
        name=payload.name,
        account_number=payload.account_number,
        institution=payload.institution,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _to_out(db, account)


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)) -> list[AccountOut]:
    accounts = db.scalars(select(Account).order_by(Account.name)).all()
    return [_to_out(db, a) for a in accounts]


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: UUID, db: Session = Depends(get_db)) -> AccountOut:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    return _to_out(db, account)


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: UUID, payload: AccountUpdate, db: Session = Depends(get_db)
) -> AccountOut:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)
    return _to_out(db, account)


@router.delete("/{account_id}", status_code=204, response_model=None)
def delete_account(account_id: UUID, confirm: bool = False, db: Session = Depends(get_db)) -> None:
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting an account is destructive — pass confirm=true to proceed",
        )

    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    blockers = []
    position_count = db.scalar(
        select(func.count())
        .select_from(PortfolioPosition)
        .where(PortfolioPosition.account_id == account_id)
    )
    if position_count:
        blockers.append(f"{position_count} portfolio position(s)")
    snapshot_count = db.scalar(
        select(func.count())
        .select_from(PortfolioSnapshot)
        .where(PortfolioSnapshot.account_id == account_id)
    )
    if snapshot_count:
        blockers.append(f"{snapshot_count} portfolio snapshot(s)")

    if blockers:
        raise HTTPException(
            status_code=409,
            detail=(
                f"cannot delete account '{account.name}': still referenced by "
                f"{', '.join(blockers)}. Delete or reassign those first."
            ),
        )

    try:
        db.delete(account)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="cannot delete account: still referenced elsewhere"
        ) from exc
