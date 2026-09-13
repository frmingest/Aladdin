"""Portfolio risk snapshot endpoints (architecture §15, §15.1, §18, §26 Phase 5)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.portfolio import PortfolioSnapshot
from app.models.portfolio_risk import PortfolioRiskSnapshot
from app.providers.base import MarketDataProvider
from app.providers.factory import get_market_data_provider
from app.schemas.portfolio_risk import PortfolioRiskSnapshotOut
from app.services.portfolio_risk.builder import build_portfolio_risk_snapshot

router = APIRouter(prefix="/portfolio", tags=["portfolio-risk"])


def _snapshot_to_out(row: PortfolioRiskSnapshot) -> PortfolioRiskSnapshotOut:
    return PortfolioRiskSnapshotOut(
        id=row.id,
        portfolio_snapshot_id=row.portfolio_snapshot_id,
        analysis_run_id=row.analysis_run_id,
        concentration=row.concentration_json,
        correlation=row.correlation_json,
        exposure=row.exposure_json,
        scenario=row.scenario_json,
        systemic_state_risk=row.systemic_state_risk_json,
        risk_band=row.risk_band,
        composite_risk_score=row.composite_risk_score,
        narrative=row.narrative,
        risk_scoring_version=row.risk_scoring_version,
        scenario_version=row.scenario_version,
        created_at=row.created_at,
    )


@router.post("/snapshots/{snapshot_id}/risk-snapshot", response_model=PortfolioRiskSnapshotOut, status_code=201)
def create_portfolio_risk_snapshot(
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioRiskSnapshotOut:
    """Builds and persists a new risk profile (concentration, correlation,
    exposure, systemic/state risk, scenario impact — §15/§15.1/§18) for this
    portfolio snapshot, refreshing market data as a side effect (reuses
    §26 Phase 2's refresh_and_value_snapshot)."""
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")

    row = build_portfolio_risk_snapshot(db, provider, snapshot)
    return _snapshot_to_out(row)


@router.get("/snapshots/{snapshot_id}/risk-snapshots", response_model=list[PortfolioRiskSnapshotOut])
def list_portfolio_risk_snapshots(snapshot_id: UUID, db: Session = Depends(get_db)) -> list[PortfolioRiskSnapshotOut]:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")
    rows = (
        db.query(PortfolioRiskSnapshot)
        .filter(PortfolioRiskSnapshot.portfolio_snapshot_id == snapshot_id)
        .order_by(PortfolioRiskSnapshot.created_at.desc())
        .all()
    )
    return [_snapshot_to_out(r) for r in rows]


@router.get("/risk-snapshots/{risk_snapshot_id}", response_model=PortfolioRiskSnapshotOut)
def get_portfolio_risk_snapshot(risk_snapshot_id: UUID, db: Session = Depends(get_db)) -> PortfolioRiskSnapshotOut:
    row = db.get(PortfolioRiskSnapshot, risk_snapshot_id)
    if row is None:
        raise HTTPException(status_code=404, detail="portfolio risk snapshot not found")
    return _snapshot_to_out(row)
