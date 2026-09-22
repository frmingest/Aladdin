import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError } from "../lib/api";
import type { Account, Holding, PortfolioSnapshot, PortfolioSnapshotSummary } from "../lib/types";
import { INSTRUMENT_TYPE_LABELS } from "../lib/types";
import { formatDate, formatDecimal } from "../lib/format";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../components/ui";

interface ImportOutcome {
  filename: string;
  ok: boolean;
  message: string;
}

function UploadPanel({ onImported }: { onImported: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  // Only meaningful for a single-file selection — see the hint text below
  // the input. Cleared after each upload so it doesn't silently linger
  // and get applied to the next, unrelated file.
  const [accountName, setAccountName] = useState("");

  async function handleFiles(files: FileList) {
    setUploading(true);
    const results: ImportOutcome[] = [];
    const nameForThisBatch = files.length === 1 ? accountName.trim() || undefined : undefined;
    // Uploaded one at a time (not in parallel) — each account's export is
    // its own snapshot, and sequential calls keep the results list in the
    // same order the person picked the files, which matters when several
    // fail and they need to tell which is which.
    for (const file of Array.from(files)) {
      try {
        const response = await api.importPortfolioCsv({ file, accountName: nameForThisBatch });
        const positionCount = response.snapshot.positions.length;
        results.push({
          filename: file.name,
          ok: true,
          message: `Account ${response.account.account_number}: ${positionCount} position${
            positionCount === 1 ? "" : "s"
          } (${response.holdings_created} new holding${
            response.holdings_created === 1 ? "" : "s"
          }, ${response.holdings_matched} matched)${
            response.was_duplicate_file ? " — file already seen, new snapshot recorded" : ""
          }`,
        });
      } catch (err) {
        results.push({
          filename: file.name,
          ok: false,
          message: err instanceof ApiError ? err.message : "Upload failed.",
        });
      }
    }
    setOutcomes(results);
    setUploading(false);
    setAccountName("");
    onImported();
  }

  return (
    <Card className="mb-8">
      <h2 className="mb-1 text-sm font-semibold text-ink">Upload portfolio export</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Broker-export CSVs (one file per account — e.g. Nordnet's "Beholdningstabell"
        export). The account number is read from the filename automatically. Select
        several files at once to import all your accounts in one go.
      </p>
      <label className="mb-3 flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Account name (optional)</span>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          disabled={uploading}
          placeholder="e.g. Aksjesparekonto"
          className="w-64 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <span className="text-xs text-ink-muted">
          Only used for a brand-new account, and only when uploading a single file — with
          several files selected, each keeps its own auto-generated name (rename it
          afterward on the table below). An account that already exists keeps its current
          name either way.
        </span>
      </label>
      <label>
        <span className="sr-only">Choose CSV files</span>
        <input
          type="file"
          accept=".csv"
          multiple
          disabled={uploading}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) void handleFiles(files);
            e.target.value = "";
          }}
          className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover disabled:opacity-50"
        />
      </label>
      {uploading && <p className="mt-3 text-sm text-ink-muted">Importing…</p>}
      {outcomes.length > 0 && !uploading && (
        <>
          <ul className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
            {outcomes.map((o) => (
              <li key={o.filename} className="flex items-start gap-2 py-2 text-sm">
                <span className={o.ok ? "text-positive" : "text-negative"}>{o.ok ? "✓" : "✕"}</span>
                <div>
                  <div className="font-medium text-ink">{o.filename}</div>
                  <div className={o.ok ? "text-ink-muted" : "text-negative"}>{o.message}</div>
                </div>
              </li>
            ))}
          </ul>
          {outcomes.some((o) => o.ok) && (
            <p className="mt-3 text-sm text-ink-muted">
              New holdings only get a placeholder ticker and no sector/type yet — review and
              assign the real ones on the{" "}
              <Link to="/holdings" className="font-medium text-accent hover:text-accent-hover">
                Holdings page
              </Link>
              .
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/** Portfolio composition by instrument type (app/domain/instrument_types.py)
 * — counts of holdings, not dollar value (no portfolio-wide $ aggregation
 * exists yet across accounts/currencies; that's Sprint 5's dashboard).
 * A single accent-colored horizontal bar chart, direct-labeled, matching
 * ValuationPanel's chart conventions (one quiet accent color, no
 * decorative categorical palette — see the Design & UX direction in the
 * sprint plan doc). Answers "are there any graphs yet?" for this page
 * without pretending to have real position values before Sprint 5 builds
 * that properly. */
function CompositionChart({ holdings }: { holdings: Holding[] | null }) {
  if (holdings === null) return null;
  if (holdings.length === 0) return null;

  const counts = new Map<string, number>();
  for (const h of holdings) {
    counts.set(h.asset_class_raw, (counts.get(h.asset_class_raw) ?? 0) + 1);
  }
  const data = Array.from(counts.entries())
    .map(([type, count]) => ({
      label: INSTRUMENT_TYPE_LABELS[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="mb-8">
      <h2 className="mb-1 text-sm font-semibold text-ink">Composition by instrument type</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Every holding tracked (including legacy non-equity ones), by count — not yet by
        portfolio value.
      </p>
      <div style={{ height: Math.max(120, data.length * 36) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="#F0EFED" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: "#111111" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              formatter={(value: number) => [value, "Holdings"]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            />
            <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={16}>
              <LabelList
                dataKey="count"
                position="right"
                style={{ fontSize: 12, fill: "#6B7280" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** One row in the Accounts table — click "Rename" to edit the account's
 * name in place (PATCH /accounts/{id}). Nothing else on an account is
 * editable here today (account_number is the real-world identifier and
 * deliberately not editable — see AccountUpdate's backend docstring). */
function AccountRow({
  account,
  onSaved,
  onDelete,
  deleting,
}: {
  account: Account;
  onSaved: (updated: Account) => void;
  onDelete: (account: Account) => void;
  deleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setName(account.name);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await api.updateAccount(account.id, { name: trimmed });
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the name.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-border-subtle bg-accent/5 last:border-0">
        <td className="px-5 py-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full rounded-md border border-border px-2 py-1 text-sm focus:border-accent focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-negative">{error}</p>}
        </td>
        <td className="px-5 py-2 tabular text-ink-muted">{account.account_number}</td>
        <td className="px-5 py-2 text-right tabular text-ink-muted">{account.snapshot_count}</td>
        <td className="px-5 py-2 text-right tabular text-ink-muted">{account.position_count}</td>
        <td className="px-5 py-2">
          <div className="flex justify-end gap-1.5">
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group border-b border-border-subtle last:border-0">
      <td className="px-5 py-3 text-ink">{account.name}</td>
      <td className="px-5 py-3 tabular text-ink-muted">{account.account_number}</td>
      <td className="px-5 py-3 text-right tabular text-ink-muted">{account.snapshot_count}</td>
      <td className="px-5 py-3 text-right tabular text-ink-muted">{account.position_count}</td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={startEditing}
            className="rounded px-2 py-1 text-xs font-medium text-ink-muted opacity-0 transition-opacity hover:bg-border-subtle hover:text-ink group-hover:opacity-100"
          >
            Rename
          </button>
          <Button variant="danger" disabled={deleting} onClick={() => onDelete(account)}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AccountsPanel({
  accounts,
  onChanged,
}: {
  accounts: Account[] | null;
  onChanged: (updated?: Account) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(account: Account) {
    if (!window.confirm(`Delete account "${account.name}" (${account.account_number})?`)) return;
    setError(null);
    setDeletingId(account.id);
    try {
      await api.deleteAccount(account.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this account.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="mb-8 overflow-hidden !p-0">
      <h2 className="px-5 pt-5 text-sm font-semibold text-ink">Accounts</h2>
      {error && <p className="px-5 pt-2 text-sm text-negative">{error}</p>}
      {accounts === null && <p className="px-5 py-5 text-sm text-ink-muted">Loading…</p>}
      {accounts !== null && accounts.length === 0 && (
        <div className="px-5 pb-5 pt-3">
          <EmptyState>No accounts yet. Upload a portfolio export above.</EmptyState>
        </div>
      )}
      {accounts !== null && accounts.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-border-subtle text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3 font-medium">Account</th>
              <th className="px-5 py-3 font-medium">Number</th>
              <th className="px-5 py-3 text-right font-medium">Snapshots</th>
              <th className="px-5 py-3 text-right font-medium">Positions</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                onSaved={(updated) => onChanged(updated)}
                onDelete={handleDelete}
                deleting={deletingId === a.id}
              />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** Positions table shown when a snapshot row is expanded — quantity, GAV
 * (average cost), last traded price, and market value, none of which were
 * shown anywhere in the frontend before (Faiz's report, 2026-09-22: "the
 * upload function is avoiding to save a lot of valuable information about
 * amount of stocks, price, GAV" — quantity/cost_basis were actually being
 * saved already, just never displayed; last_price/market_value_nok were
 * genuinely not being saved at all until this same session's backend fix,
 * migration a2b4c6d8e0f1). */
function PositionsTable({ positions }: { positions: PortfolioSnapshot["positions"] }) {
  if (positions.length === 0) {
    return <p className="px-5 pb-4 text-sm text-ink-muted">No positions in this snapshot.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
          <th className="px-5 py-2 font-medium">Holding</th>
          <th className="px-5 py-2 text-right font-medium">Quantity</th>
          <th className="px-5 py-2 text-right font-medium">Avg. cost (GAV)</th>
          <th className="px-5 py-2 text-right font-medium">Cost basis</th>
          <th className="px-5 py-2 text-right font-medium">Last price</th>
          <th className="px-5 py-2 text-right font-medium">Market value (NOK)</th>
          <th className="px-5 py-2 text-right font-medium">Weight</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const avgCost =
            p.cost_basis && p.quantity && Number(p.quantity) !== 0
              ? String(Number(p.cost_basis) / Number(p.quantity))
              : null;
          return (
            <tr key={p.id} className="border-t border-border-subtle">
              <td className="px-5 py-2 text-ink">
                <span className="font-medium">{p.ticker}</span>{" "}
                <span className="text-ink-muted">{p.holding_name}</span>
              </td>
              <td className="px-5 py-2 text-right tabular text-ink-muted">
                {p.quantity ? formatDecimal(p.quantity, 4) : "—"}
              </td>
              <td className="px-5 py-2 text-right tabular text-ink-muted">
                {avgCost ? `${formatDecimal(avgCost)} ${p.cost_basis_currency ?? ""}` : "—"}
              </td>
              <td className="px-5 py-2 text-right tabular text-ink-muted">
                {p.cost_basis ? `${formatDecimal(p.cost_basis)} ${p.cost_basis_currency ?? ""}` : "—"}
              </td>
              <td className="px-5 py-2 text-right tabular text-ink-muted">
                {p.last_price ? `${formatDecimal(p.last_price)} ${p.cost_basis_currency ?? ""}` : "—"}
              </td>
              <td className="px-5 py-2 text-right tabular text-ink-muted">
                {p.market_value_nok ? formatDecimal(p.market_value_nok) : "—"}
              </td>
              <td className="px-5 py-2 text-right tabular text-ink-muted">
                {p.weight_pct ? `${formatDecimal(p.weight_pct)}%` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SnapshotRow({
  snapshot,
  accountsById,
  onDelete,
  deleting,
}: {
  snapshot: PortfolioSnapshotSummary;
  accountsById: Map<string, Account>;
  onDelete: (snapshot: PortfolioSnapshotSummary) => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<PortfolioSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (detail || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      setDetail(await api.getSnapshot(snapshot.id));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load positions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border-subtle last:border-0 hover:bg-border-subtle/40"
        onClick={toggle}
      >
        <td className="px-5 py-3 tabular text-ink-muted">
          {expanded ? "▾" : "▸"} {formatDate(snapshot.uploaded_at)}
        </td>
        <td className="px-5 py-3 text-ink">
          {snapshot.account_id ? (accountsById.get(snapshot.account_id)?.name ?? "—") : "—"}
        </td>
        <td className="px-5 py-3 tabular text-ink-muted">{snapshot.reporting_currency}</td>
        <td className="px-5 py-3">
          <StatusBadge status={snapshot.status} />
        </td>
        <td className="px-5 py-3 text-right tabular text-ink-muted">
          {snapshot.position_count}
        </td>
        <td className="px-5 py-3 text-right">
          <Button
            variant="danger"
            disabled={deleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(snapshot);
            }}
          >
            Delete
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border-subtle bg-border-subtle/20 last:border-0">
          <td colSpan={6} className="p-0">
            {loading && <p className="px-5 py-4 text-sm text-ink-muted">Loading positions…</p>}
            {loadError && <p className="px-5 py-4 text-sm text-negative">{loadError}</p>}
            {detail && <PositionsTable positions={detail.positions} />}
          </td>
        </tr>
      )}
    </>
  );
}

function SnapshotsPanel({
  snapshots,
  accountsById,
  onChanged,
}: {
  snapshots: PortfolioSnapshotSummary[] | null;
  accountsById: Map<string, Account>;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(snapshot: PortfolioSnapshotSummary) {
    if (
      !window.confirm(
        `Delete this snapshot (${snapshot.position_count} position${
          snapshot.position_count === 1 ? "" : "s"
        })? This also removes its positions.`,
      )
    )
      return;
    setError(null);
    setNote(null);
    setDeletingId(snapshot.id);
    try {
      const result = await api.deleteSnapshot(snapshot.id);
      const purged = result.legacy_analysis_purged;
      const purgedCount = purged.analysis_runs + purged.portfolio_risk_snapshots;
      if (purgedCount > 0) {
        setNote(
          `Deleted — this snapshot also had ${purgedCount} old analysis/risk record${
            purgedCount === 1 ? "" : "s"
          } from before the rebuild still pointing at it; those were removed too.`,
        );
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this snapshot.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="overflow-hidden !p-0">
      <h2 className="px-5 pt-5 text-sm font-semibold text-ink">Snapshots</h2>
      <p className="px-5 pb-1 pt-1 text-xs text-ink-muted">
        Click a row to see its positions (quantity, cost basis, last price, market value).
      </p>
      {error && <p className="px-5 pt-2 text-sm text-negative">{error}</p>}
      {note && <p className="px-5 pt-2 text-sm text-ink-muted">{note}</p>}
      {snapshots === null && <p className="px-5 py-5 text-sm text-ink-muted">Loading…</p>}
      {snapshots !== null && snapshots.length === 0 && (
        <div className="px-5 pb-5 pt-3">
          <EmptyState>No portfolio snapshots yet.</EmptyState>
        </div>
      )}
      {snapshots !== null && snapshots.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-border-subtle text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3 font-medium">Uploaded</th>
              <th className="px-5 py-3 font-medium">Account</th>
              <th className="px-5 py-3 font-medium">Currency</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Positions</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <SnapshotRow
                key={s.id}
                snapshot={s}
                accountsById={accountsById}
                onDelete={handleDelete}
                deleting={deletingId === s.id}
              />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function DeleteAllPanel({
  accounts,
  snapshots,
  onChanged,
}: {
  accounts: Account[] | null;
  snapshots: PortfolioSnapshotSummary[] | null;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const accountCount = accounts?.length ?? 0;
  const snapshotCount = snapshots?.length ?? 0;
  const nothingToDelete = accountCount === 0 && snapshotCount === 0;

  async function handleDeleteAll() {
    if (
      !window.confirm(
        `Delete ALL portfolio data — ${accountCount} account${accountCount === 1 ? "" : "s"} and ` +
          `${snapshotCount} snapshot${snapshotCount === 1 ? "" : "s"} (and every position in them)? ` +
          `Holdings (ticker records) and their documents are kept. This cannot be undone.`,
      )
    )
      return;
    setError(null);
    setNote(null);
    setDeleting(true);
    try {
      const result = await api.deleteAllPortfolioData();
      const purged = result.legacy_analysis_purged;
      const purgedCount = purged.analysis_runs + purged.portfolio_risk_snapshots;
      setNote(
        `Wiped ${result.accounts_deleted} account(s), ${result.snapshots_deleted} snapshot(s), ` +
          `${result.positions_deleted} position(s)` +
          (purgedCount > 0 ? `, plus ${purgedCount} old pre-rebuild analysis/risk record(s).` : "."),
      );
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not wipe portfolio data.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-8 border-negative/30">
      <h2 className="mb-1 text-sm font-semibold text-ink">Delete all portfolio data</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Wipes every account, snapshot, and position in one go — faster than deleting them one by
        one. Holdings (your ticker records) and their documents are not touched.
      </p>
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {note && <p className="mb-3 text-sm text-ink-muted">{note}</p>}
      <Button variant="danger" disabled={deleting || nothingToDelete} onClick={handleDeleteAll}>
        {deleting ? "Deleting…" : "Delete all portfolio data"}
      </Button>
    </Card>
  );
}

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[] | null>(null);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setError(null);
    Promise.all([api.listAccounts(), api.listSnapshots(), api.listHoldings()])
      .then(([a, s, h]) => {
        setAccounts(a);
        setSnapshots(s);
        setHoldings(h);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load portfolio data."),
      );
  }

  useEffect(reload, []);

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const totalValue = (snapshots ?? []).reduce((sum, s) => sum + s.position_count, 0);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Portfolio"
        subtitle={
          accounts && snapshots
            ? `${accounts.length} account${accounts.length === 1 ? "" : "s"}, ${totalValue} tracked position${
                totalValue === 1 ? "" : "s"
              } across ${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"}.`
            : "Real brokerage accounts and their imported holdings."
        }
      />

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <UploadPanel onImported={reload} />
      <CompositionChart holdings={holdings} />
      <AccountsPanel accounts={accounts} onChanged={reload} />
      <SnapshotsPanel snapshots={snapshots} accountsById={accountsById} onChanged={reload} />

      <p className="my-4 text-xs text-ink-muted">
        Deleting an account or snapshot is permanent — the backend refuses it while positions
        still reference it, so remove the snapshot before the account.
      </p>

      <DeleteAllPanel accounts={accounts} snapshots={snapshots} onChanged={reload} />
    </div>
  );
}
