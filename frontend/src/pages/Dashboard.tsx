import { useEffect, useState } from "react";
import { listAccounts, listSnapshots } from "../services/api";
import type { Account, PortfolioSnapshotSummary } from "../types/portfolio";
import AccountFilter from "../components/AccountFilter";
import CollectionFilter from "../components/CollectionFilter";
import ExecutiveSummarySection from "./dashboard/ExecutiveSummarySection";
import CompositionSection from "./dashboard/CompositionSection";
import AllocationDriftSection from "./dashboard/AllocationDriftSection";
import RiskSection from "./dashboard/RiskSection";
import FactorProfileSection from "./dashboard/FactorProfileSection";
import MacroSection from "./dashboard/MacroSection";
import HoldingDetailSection from "./dashboard/HoldingDetailSection";
import UsageSection from "./dashboard/UsageSection";

/**
 * Phase 6 — Visualization (architecture §19, §26). Composes every
 * visualization §19 lists: portfolio composition, allocation drift, factor
 * profile, portfolio risk heatmap, scenario impact, macro dashboard, and
 * (per selected holding) analysis comparison, evidence panel, thesis
 * timeline, and valuation scenarios. Sections that need live provider data
 * (valuation, risk snapshot, macro/sector refresh) are manual triggers,
 * matching the convention Analysis.tsx established for Phase 3; everything
 * else reads whatever's already on record.
 *
 * ExecutiveSummarySection leads the snapshot-scoped sections below — a
 * portfolio-wide rollup of what every section after it computes (total
 * value/P&L, risk band, factor-profile coverage, collection/currency mix,
 * macro regime) plus a consolidated "needs attention" list, entirely from
 * `GET .../executive-summary` (free, §2.7 — no live provider call of its
 * own). Faiz asked whether the Dashboard had a portfolio-wide summary view;
 * this is that view.
 *
 * UsageSection (§28 observability follow-up, ADR 0013) sits above the
 * snapshot-scoped sections deliberately — Gemini usage/quota is a portfolio-
 * wide, always-current concern, not something that depends on which
 * snapshot or account filter is selected below.
 *
 * The dashboard always looks at the *current* portfolio (the latest
 * snapshot — uploads merge forward onto it, so it's every account's present
 * holdings, not one point-in-time file) and lets the single account filter
 * below narrow which accounts' positions each section counts. Browsing an
 * older upload is a "Snapshot history" side-trip, not the main control —
 * see the collapsible panel below.
 */
export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  // Which of Securities / Coin collection / Whisky collection to include —
  // [] means all three (§26 Composition collections filter). Only
  // Composition currently honors this; see CollectionFilter's docstring.
  const [includedCollections, setIncludedCollections] = useState<string[]>([]);

  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[]>([]);
  const [snapshotId, setSnapshotId] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch(() => undefined);
    listSnapshots()
      .then((list) => {
        setSnapshots(list);
        if (list.length > 0) setSnapshotId(list[0].id); // list is newest-first (§ backend order_by desc)
      })
      .catch(() => undefined);
  }, []);

  const latestSnapshotId = snapshots[0]?.id ?? "";
  const viewingHistorical = snapshotId !== "" && snapshotId !== latestSnapshotId;

  return (
    <div className="space-y-8">
      <UsageSection />

      <div className="terminal-card space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-end gap-3 flex-wrap">
            <AccountFilter accounts={accounts} selected={accountIds} onChange={setAccountIds} />
            <CollectionFilter selected={includedCollections} onChange={setIncludedCollections} />
          </div>
          {snapshots.length > 1 && (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-xs text-tertiary hover:text-accent underline"
            >
              {historyOpen ? "Hide snapshot history" : "Snapshot history"}
            </button>
          )}
        </div>

        {viewingHistorical && (
          <p className="text-xs text-warning">
            Viewing an older upload from {new Date(snapshots.find((s) => s.id === snapshotId)?.uploaded_at ?? "").toLocaleString()} —{" "}
            <button type="button" onClick={() => setSnapshotId(latestSnapshotId)} className="underline hover:text-accent">
              back to current portfolio
            </button>
            .
          </p>
        )}

        {historyOpen && (
          <div className="terminal-table-wrapper">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Uploaded</th>
                  <th>Upload account</th>
                  <th className="numeric">Positions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="primary font-mono">{new Date(s.uploaded_at).toLocaleString()}</td>
                    <td>{s.account_name ?? "—"}</td>
                    <td className="numeric font-mono">{s.position_count}</td>
                    <td>
                      {s.id === snapshotId ? (
                        <span className="text-xs text-tertiary">Viewing</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSnapshotId(s.id);
                            setHistoryOpen(false);
                          }}
                          className="text-xs text-accent hover:underline"
                        >
                          View this upload
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {snapshotId ? (
        <>
          <ExecutiveSummarySection snapshotId={snapshotId} accountIds={accountIds} />
          <CompositionSection
            snapshotId={snapshotId}
            accountIds={accountIds}
            includedCollections={includedCollections}
          />
          <AllocationDriftSection accountIds={accountIds} />
          <RiskSection snapshotId={snapshotId} accountIds={accountIds} />
          <FactorProfileSection accountIds={accountIds} />
          <MacroSection />
          <HoldingDetailSection accountIds={accountIds} />
        </>
      ) : (
        <p className="text-sm text-tertiary">Upload a portfolio to see the dashboard.</p>
      )}
    </div>
  );
}
