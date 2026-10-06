import { useState } from "react";
import { api, ApiError } from "../lib/api";
import type { TripwireCheckResult } from "../lib/types";
import { Button } from "./ui";

/** Sprint 15 #5 — the "check now" control for thesis tripwires, shared by
 * the Thesis page and the Dashboard's "Needs attention" card. It calls POST /thesis/check
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
