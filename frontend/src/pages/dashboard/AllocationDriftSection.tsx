import { useEffect, useState } from "react";
import { getSnapshot, listSnapshots } from "../../services/api";
import type { PortfolioSnapshotDetail } from "../../types/portfolio";
import AllocationDriftChart, { type DriftPoint } from "../../charts/AllocationDriftChart";

const TOP_N = 7; // leaves the 8th categorical slot free for "Other"

function buildDrift(snapshots: PortfolioSnapshotDetail[]): { points: DriftPoint[]; tickers: string[] } {
  const sorted = [...snapshots].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
  const latest = sorted[sorted.length - 1];
  const topTickers = [...latest.positions]
    .sort((a, b) => Number(b.weight_pct ?? 0) - Number(a.weight_pct ?? 0))
    .slice(0, TOP_N)
    .map((p) => p.ticker);

  const points: DriftPoint[] = sorted.map((snap) => {
    const point: DriftPoint = { label: new Date(snap.uploaded_at).toLocaleDateString() };
    let otherTotal = 0;
    for (const position of snap.positions) {
      const weight = Number(position.weight_pct ?? 0);
      if (topTickers.includes(position.ticker)) {
        point[position.ticker] = weight;
      } else {
        otherTotal += weight;
      }
    }
    if (otherTotal > 0) point["Other"] = otherTotal;
    return point;
  });

  const tickers = otherPresent(points) ? [...topTickers, "Other"] : topTickers;
  return { points, tickers };
}

function otherPresent(points: DriftPoint[]): boolean {
  return points.some((p) => "Other" in p);
}

/**
 * Allocation drift (architecture §19 "Allocation drift — historical weight
 * changes"). Uses every uploaded portfolio snapshot's own `weight_pct`
 * (§20 PortfolioPosition — the figure from the upload itself, e.g. a
 * Nordnet export), not a live re-valuation, so it needs no market-data
 * network access and works even for snapshots that were never valued.
 */
export default function AllocationDriftSection() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSnapshots()
      .then((summaries) => Promise.all(summaries.map((s) => getSnapshot(s.id))))
      .then((details) => {
        if (!cancelled) setSnapshots(details);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load portfolio snapshot history.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const drift = snapshots ? buildDrift(snapshots) : null;

  return (
    <section className="terminal-card">
      <h2 className="terminal-card-title mb-3">Allocation drift</h2>
      {error && <p className="text-negative text-sm">{error}</p>}
      {!error && !snapshots && <p className="text-sm text-tertiary">Loading…</p>}
      {drift && <AllocationDriftChart data={drift.points} tickers={drift.tickers} />}
    </section>
  );
}
