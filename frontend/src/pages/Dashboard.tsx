import { useEffect, useState } from "react";
import { listSnapshots } from "../services/api";
import type { PortfolioSnapshotSummary } from "../types/portfolio";
import CompositionSection from "./dashboard/CompositionSection";
import AllocationDriftSection from "./dashboard/AllocationDriftSection";
import RiskSection from "./dashboard/RiskSection";
import FactorProfileSection from "./dashboard/FactorProfileSection";
import MacroSection from "./dashboard/MacroSection";
import HoldingDetailSection from "./dashboard/HoldingDetailSection";

/**
 * Phase 6 — Visualization (architecture §19, §26). Composes every
 * visualization §19 lists: portfolio composition, allocation drift, factor
 * profile, portfolio risk heatmap, scenario impact, macro dashboard, and
 * (per selected holding) analysis comparison, evidence panel, thesis
 * timeline, and valuation scenarios. Sections that need live provider data
 * (valuation, risk snapshot, macro/sector refresh) are manual triggers,
 * matching the convention Analysis.tsx established for Phase 3; everything
 * else reads whatever's already on record.
 */
export default function Dashboard() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[]>([]);
  const [snapshotId, setSnapshotId] = useState<string>("");

  useEffect(() => {
    listSnapshots()
      .then((list) => {
        setSnapshots(list);
        if (list.length > 0) setSnapshotId(list[0].id);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-8">
      <div className="terminal-card flex items-end gap-3">
        <div>
          <label className="label-terminal">Portfolio snapshot</label>
          <select
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            className="input-terminal min-w-[280px]"
          >
            {snapshots.length === 0 && <option value="">No snapshots uploaded yet</option>}
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.uploaded_at).toLocaleString()} — {s.position_count} position(s)
                {s.account_name ? ` — upload: ${s.account_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {snapshotId ? (
        <>
          <CompositionSection snapshotId={snapshotId} />
          <AllocationDriftSection />
          <RiskSection snapshotId={snapshotId} />
          <FactorProfileSection />
          <MacroSection />
          <HoldingDetailSection />
        </>
      ) : (
        <p className="text-sm text-tertiary">Upload a portfolio to see the dashboard.</p>
      )}
    </div>
  );
}
