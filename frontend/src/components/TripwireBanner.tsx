import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { MonitorRow, TripwireCheckResult } from "../lib/types";
import { Button } from "./ui";

/** Sprint 15 #5 — the "check now" control for thesis tripwires, shared by
 * the Thesis page and the dashboard banner. It calls POST /thesis/check
 * (refresh each tripwire-holding's price, then evaluate) and hands the
 * caller the fresh monitor rows via `onChecked`. */
export function CheckTripwiresButton({ onChecked }: { onChecked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TripwireCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setBusy(true);
    setError(null);
    api
      .checkTripwires()
      .then((r) => {
        setResult(r);
        onChecked();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not run the tripwire check."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button variant="secondary" onClick={run} disabled={busy}>
        {busy ? "Checking…" : "Check now"}
      </Button>
      {result && <p className="text-xs text-ink-muted">{result.summary}</p>}
      {error && <p className="text-xs text-negative">{error}</p>}
    </div>
  );
}

/** Red banner at the top of the dashboard while at least one tripwire is
 * firing; renders nothing otherwise (the Thesis page covers the all-clear). */
export function TripwireBanner({ rows, onChecked }: { rows: MonitorRow[]; onChecked: () => void }) {
  const firing = rows.filter((r) => r.status === "tripwire_fired");
  if (firing.length === 0) return null;
  const total = firing.reduce((n, r) => n + r.firing_count, 0);

  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-negative/50 bg-negative-subtle p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="text-sm">
        <p className="font-semibold text-negative">
          {total} tripwire{total === 1 ? "" : "s"} fired on {firing.length} holding{firing.length === 1 ? "" : "s"}
        </p>
        <p className="mt-0.5 text-ink-muted">
          {firing.slice(0, 5).map((r, i) => (
            <span key={r.holding_id}>
              {i > 0 && ", "}
              <Link to={`/holdings/${r.holding_id}`} className="font-medium text-ink hover:text-accent">
                {r.ticker}
              </Link>
            </span>
          ))}
          {firing.length > 5 && ` and ${firing.length - 5} more`}
          {" · "}
          <Link to="/thesis" className="font-medium text-accent hover:text-accent-hover">
            Open Thesis →
          </Link>
        </p>
      </div>
      <CheckTripwiresButton onChecked={onChecked} />
    </div>
  );
}
