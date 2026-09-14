"""API response schema for the /usage endpoint (§28 observability follow-up,
docs/decisions/0013-llm-usage-ledger-and-rate-limit-estimation.md)."""

from datetime import datetime

from pydantic import BaseModel


class UsageWindowOut(BaseModel):
    requests: int
    input_tokens: int
    output_tokens: int


class UsageSummaryOut(BaseModel):
    as_of: datetime
    today: UsageWindowOut
    last_minute: UsageWindowOut
    rpm_limit: int
    tpm_limit: int
    rpd_limit: int
    avg_calls_per_analysis: float
    avg_tokens_per_analysis: int
    baseline_is_calibrated: bool
    estimated_analyses_remaining_today: int
