"""Country indicators for Dalio mode's country-risk evidence (Epic F22,
story 22.10) — annual World Bank / WGI figures per country, fetched by
app/services/country_risk/refresh.py and scored by
app/services/country_risk/ssi.py.

Append-only like the other observation tables: one row per (country,
indicator, data year, fetch); "the value for a year" is the newest
`fetched_at`. `data_year` is the year the figure describes, not the year
it was fetched — every figure shown carries it (plan §4a #2), because
World Bank annual data typically lags one to two years.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class CountryIndicator(Base):
    __tablename__ = "country_indicators"
    __table_args__ = (
        Index("ix_country_indicators_country_indicator", "country_code", "indicator_code", "data_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO 3166-1 alpha-3
    indicator_code: Mapped[str] = mapped_column(String(32), nullable=False)  # publisher id, e.g. GC.DOD.TOTL.GD.ZS
    data_year: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # "world_bank" | "world_bank_wgi"
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CountryIndicator {self.country_code} {self.indicator_code} {self.data_year}={self.value}>"
