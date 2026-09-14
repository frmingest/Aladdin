// Mirrors backend/app/schemas/usage.py (§28 observability follow-up, ADR 0013).

export type UsageWindowOut = {
  requests: number;
  input_tokens: number;
  output_tokens: number;
};

export type UsageSummaryOut = {
  as_of: string;
  today: UsageWindowOut;
  last_minute: UsageWindowOut;
  rpm_limit: number;
  tpm_limit: number;
  rpd_limit: number;
  avg_calls_per_analysis: number;
  avg_tokens_per_analysis: number;
  baseline_is_calibrated: boolean;
  estimated_analyses_remaining_today: number;
};
