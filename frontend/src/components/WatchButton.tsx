import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDecimal } from "../lib/format";
import type { WatchlistRow } from "../lib/types";
import { Button } from "./ui";

/** Watch / Watching toggle for the holding page header (feature F7). */
export default function WatchButton({ holdingId }: { holdingId: string }) {
  const [entry, setEntry] = useState<WatchlistRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWatchlistEntry(holdingId)
      .then(setEntry)
      .catch(() => setEntry(null));
  }, [holdingId]);

  async function watch() {
    try {
      setEntry(await api.addToWatchlist({ holding_id: holdingId }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add");
    }
  }

  if (entry === undefined) return null;
  if (entry === null) {
    return (
      <span className="inline-flex flex-col items-end">
        <Button variant="secondary" onClick={watch} title="Add to watchlist">
          ☆ Watch
        </Button>
        {error && <span className="mt-1 text-xs text-negative">{error}</span>}
      </span>
    );
  }
  return (
    <Link
      to="/watchlist"
      className="rounded-md border border-accent/40 bg-accent-subtle px-3 py-2 text-sm font-medium text-accent hover:bg-accent-subtle/70"
      title="On your watchlist"
    >
      ★ Watching
      {entry.buy_below_price && (
        <span className="ml-1.5 font-normal">
          · buy below {formatDecimal(entry.buy_below_price)} {entry.buy_below_currency}
        </span>
      )}
    </Link>
  );
}
