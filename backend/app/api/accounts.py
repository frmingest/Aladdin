"""Account CRUD endpoints — the accounts a portfolio upload can be tagged
with (see app.models.account, app.services.portfolio.ingestion)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.account import Account
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)) -> list[AccountOut]:
    accounts = db.query(Account).order_by(Account.name).all()
    return [AccountOut.model_validate(a) for a in accounts]


@router.post("", response_model=AccountOut, status_code=201)
def create_account(body: AccountCreate, db: Session = Depends(get_db)) -> AccountOut:
    existing = db.query(Account).filter(Account.account_number == body.account_number).one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"an account with account_number '{body.account_number}' already exists",
        )
    account = Account(
        name=body.name.strip(),
        account_number=body.account_number.strip(),
        institution=(body.institution or "").strip() or None,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountOut.model_validate(account)


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(account_id: UUID, body: AccountUpdate, db: Session = Depends(get_db)) -> AccountOut:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    if body.account_number is not None:
        conflict = (
            db.query(Account)
            .filter(Account.account_number == body.account_number, Account.id != account_id)
            .one_or_none()
        )
        if conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=f"an account with account_number '{body.account_number}' already exists",
            )
        account.account_number = body.account_number.strip()
    if body.name is not None:
        account.name = body.name.strip()
    if body.institution is not None:
        account.institution = body.institution.strip() or None

    db.commit()
    db.refresh(account)
    return AccountOut.model_validate(account)


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: UUID, db: Session = Depends(get_db)) -> None:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    in_use = (
        db.query(PortfolioSnapshot).filter(PortfolioSnapshot.account_id == account_id).first()
        is not None
        or db.query(PortfolioPosition).filter(PortfolioPosition.account_id == account_id).first()
        is not None
    )
    if in_use:
        raise HTTPException(
            status_code=409,
            detail=(
                "this account has uploads/positions tagged against it — reassign or delete "
                "those first (or use a full portfolio reset) before deleting the account"
            ),
        )

    db.delete(account)
    try:
        db.commit()
    except IntegrityError as exc:  # defensive — the in_use check above should already catch this
        db.rollback()
        raise HTTPException(status_code=409, detail="account is still referenced elsewhere") from exc
