import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Account, PortfolioSnapshotSummary } from "../lib/types";
import { formatDate } from "../lib/format";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../components/ui";

interface ImportOutcome {
  filename: string;
  ok: boolean;
  message: string;
}

function UploadPanel({ onImported }: { onImported: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);

  async function handleFiles(files: FileList) {
    setUploading(true);
    const results: ImportOutcome[] = [];
    // Uploaded one at a time (not in parallel) — each account's export is
    // its own snapshot, and sequential calls keep the results list in the
    // same order the person picked the files, which matters when several
    // fail and they need to tell which is which.
    for (const file of Array.from(files)) {
      try {
        const response = await api.importPortfolioCsv({ file });
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
      )}
    </Card>
  );
}

function AccountsPanel({
  accounts,
  onChanged,
}: {
  accounts: Account[] | null;
  onChanged: () => void;
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
              <tr key={a.id} className="border-b border-border-subtle last:border-0">
                <td className="px-5 py-3 text-ink">{a.name}</td>
                <td className="px-5 py-3 tabular text-ink-muted">{a.account_number}</td>
                <td className="px-5 py-3 text-right tabular text-ink-muted">
                  {a.snapshot_count}
                </td>
                <td className="px-5 py-3 text-right tabular text-ink-muted">
                  {a.position_count}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant="danger"
                    disabled={deletingId === a.id}
                    onClick={() => handleDelete(a)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
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
    setDeletingId(snapshot.id);
    try {
      await api.deleteSnapshot(snapshot.id);
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
      {error && <p className="px-5 pt-2 text-sm text-negative">{error}</p>}
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
              <tr key={s.id} className="border-b border-border-subtle last:border-0">
                <td className="px-5 py-3 tabular text-ink-muted">{formatDate(s.uploaded_at)}</td>
                <td className="px-5 py-3 text-ink">
                  {s.account_id ? (accountsById.get(s.account_id)?.name ?? "—") : "—"}
                </td>
                <td className="px-5 py-3 tabular text-ink-muted">{s.reporting_currency}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-5 py-3 text-right tabular text-ink-muted">
                  {s.position_count}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant="danger"
                    disabled={deletingId === s.id}
                    onClick={() => handleDelete(s)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setError(null);
    Promise.all([api.listAccounts(), api.listSnapshots()])
      .then(([a, s]) => {
        setAccounts(a);
        setSnapshots(s);
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
      <AccountsPanel accounts={accounts} onChanged={reload} />
      <SnapshotsPanel snapshots={snapshots} accountsById={accountsById} onChanged={reload} />

      <p className="mt-4 text-xs text-ink-muted">
        Deleting an account or snapshot is permanent — the backend refuses it while positions
        still reference it, so remove the snapshot before the account.
      </p>
    </div>
  );
}
