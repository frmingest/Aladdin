import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createAccount,
  deleteAccount,
  listAccounts,
  listSnapshots,
  resetPortfolio,
  uploadPortfolio,
} from "../services/api";
import type {
  Account,
  PortfolioSnapshotDetail,
  PortfolioSnapshotSummary,
  PortfolioUploadResponse,
  RowError,
} from "../types/portfolio";

/**
 * Which accounts are being watched/filtered — a small management table plus
 * an add-account form. Accounts are what an upload gets tagged with (see the
 * account picker in the upload form below) and what every positions table
 * on this page and the dashboard can be filtered by.
 */
function AccountsSection({
  accounts,
  onChanged,
}: {
  accounts: Account[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [institution, setInstitution] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !accountNumber.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await createAccount({
        name: name.trim(),
        account_number: accountNumber.trim(),
        institution: institution.trim() || null,
      });
      setName("");
      setAccountNumber("");
      setInstitution("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Could not add account.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(account: Account) {
    const confirmed = window.confirm(
      `Remove "${account.name}" (${account.account_number}) from your accounts list?`,
    );
    if (!confirmed) return;
    setDeletingId(account.id);
    setError(null);
    try {
      await deleteAccount(account.id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail ?? err.message)
          : "Could not delete account.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="terminal-card">
      <h2 className="terminal-card-title mb-2">Accounts</h2>
      <p className="text-xs text-tertiary mb-3">
        The accounts your holdings are split across. Tag an upload with one below, then filter
        snapshots, positions, and the dashboard by account.
      </p>

      {accounts.length > 0 && (
        <div className="terminal-table-wrapper mb-4">
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Account number</th>
                <th>Institution</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="primary">{a.name}</td>
                  <td className="numeric" style={{ textAlign: "left" }}>{a.account_number}</td>
                  <td>{a.institution ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      disabled={deletingId === a.id}
                      className="text-negative hover:opacity-80 disabled:opacity-40 text-xs"
                    >
                      {deletingId === a.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label-terminal">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aksje & fonds konto"
            className="input-terminal w-56"
          />
        </div>
        <div>
          <label className="label-terminal">Account number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 70541644"
            className="input-terminal w-40"
          />
        </div>
        <div>
          <label className="label-terminal">Institution (optional)</label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. Nordnet"
            className="input-terminal w-40"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || !accountNumber.trim() || adding}
          className="btn-terminal btn-terminal-primary"
        >
          {adding ? "Adding…" : "Add account"}
        </button>
      </form>
      {error && <p className="text-negative text-sm mt-2">{error}</p>}
    </section>
  );
}

export default function PortfolioUpload() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reportingCurrency, setReportingCurrency] = useState("NOK");
  const [accountId, setAccountId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PortfolioSnapshotDetail | null>(null);
  const [uploadStats, setUploadStats] = useState<Pick<
    PortfolioUploadResponse,
    "new_position_count" | "updated_position_count" | "carried_forward_position_count"
  > | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[]>([]);
  const [snapshotFilterAccountId, setSnapshotFilterAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const refreshAccounts = () => {
    listAccounts()
      .then(setAccounts)
      .catch(() => undefined);
  };

  const refreshSnapshots = (filterAccountId = snapshotFilterAccountId) => {
    listSnapshots(filterAccountId || undefined)
      .then(setSnapshots)
      .catch(() => undefined);
  };

  useEffect(refreshAccounts, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => refreshSnapshots(), []);

  function handleSnapshotFilterChange(nextAccountId: string) {
    setSnapshotFilterAccountId(nextAccountId);
    refreshSnapshots(nextAccountId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setResult(null);
    setUploadStats(null);
    setWarnings([]);
    setRowErrors(null);
    setErrorMessage(null);
    setResetMessage(null);

    try {
      const response = await uploadPortfolio(file, reportingCurrency, accountId || undefined);
      setResult(response.snapshot);
      setUploadStats({
        new_position_count: response.new_position_count,
        updated_position_count: response.updated_position_count,
        carried_forward_position_count: response.carried_forward_position_count,
      });
      setWarnings(response.warnings);
      refreshSnapshots();
      // Clear the picked file so the input is ready for the next upload —
      // uploads are additive (merged onto the current portfolio by
      // account+ticker), so adding another file is the normal next action,
      // not a re-upload. Leave the account picker as-is: the next file is
      // often for the same account.
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      if (err instanceof ApiError && err.detail && typeof err.detail === "object" && "row_errors" in (err.detail as object)) {
        const detail = err.detail as { message: string; row_errors: RowError[] };
        setErrorMessage(detail.message);
        setRowErrors(detail.row_errors);
      } else if (err instanceof ApiError) {
        setErrorMessage(typeof err.detail === "string" ? err.detail : "Upload failed.");
      } else {
        setErrorMessage("Upload failed — could not reach the backend.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetAll() {
    const confirmed = window.confirm(
      "Delete ALL portfolio data? This permanently removes every holding, snapshot, uploaded file, " +
        "and any analysis/thesis/valuation data derived from them. Your accounts list is kept. " +
        "This cannot be undone.",
    );
    if (!confirmed) return;

    setResetting(true);
    setResetMessage(null);
    setErrorMessage(null);
    try {
      const response = await resetPortfolio();
      setResult(null);
      setUploadStats(null);
      setWarnings([]);
      setRowErrors(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setResetMessage(
        `Deleted ${response.holdings_deleted} holding(s), ${response.snapshots_deleted} snapshot(s), ` +
          `and ${response.documents_deleted} uploaded file(s).`,
      );
      refreshSnapshots();
    } catch {
      setErrorMessage("Reset failed — could not reach the backend.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-8">
      <AccountsSection accounts={accounts} onChanged={refreshAccounts} />

      <section className="terminal-card">
        <div className="terminal-card-header">
          <h2 className="terminal-card-title">Upload portfolio (CSV/XLSX)</h2>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={resetting || submitting}
            className="btn-terminal btn-terminal-danger text-xs px-3 py-1"
          >
            {resetting ? "Deleting…" : "Delete all data"}
          </button>
        </div>
        <p className="text-xs text-tertiary mb-3">
          Each upload adds to your current portfolio — a ticker in the new file replaces its old row
          within the same account, and any position not in the new file is kept as-is. Use
          "Delete all data" to start over from scratch.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label-terminal">Portfolio file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-secondary"
            />
          </div>
          <div>
            <label className="label-terminal">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input-terminal min-w-[200px]"
            >
              <option value="">Unassigned</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.account_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-terminal">Reporting currency</label>
            <input
              type="text"
              value={reportingCurrency}
              onChange={(e) => setReportingCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="input-terminal w-20"
            />
          </div>
          <button
            type="submit"
            disabled={!file || submitting}
            className="btn-terminal btn-terminal-primary"
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </form>

        {resetMessage && <p className="text-positive text-sm mt-3">{resetMessage}</p>}
        {errorMessage && <p className="text-negative text-sm mt-3">{errorMessage}</p>}
        {rowErrors && (
          <ul className="text-negative text-sm mt-2 list-disc list-inside">
            {rowErrors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="text-warning text-sm mt-2 list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {result && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-sm text-tertiary mb-2">
              Snapshot {result.id.slice(0, 8)} — {result.status} — {result.positions.length} position(s)
              {uploadStats && (
                <>
                  {" "}
                  ({uploadStats.new_position_count} new, {uploadStats.updated_position_count} updated,{" "}
                  {uploadStats.carried_forward_position_count} carried forward)
                </>
              )}
            </p>
            <div className="terminal-table-wrapper">
              <table className="terminal-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Name</th>
                    <th>Account</th>
                    <th>Asset class</th>
                    <th className="numeric">Weight %</th>
                    <th className="numeric">Quantity</th>
                    <th className="numeric">GAV</th>
                    <th>Sector</th>
                  </tr>
                </thead>
                <tbody>
                  {result.positions.map((p) => (
                    <tr key={`${p.account_id ?? "none"}-${p.holding_id}`}>
                      <td className="primary">{p.ticker}</td>
                      <td>{p.name}</td>
                      <td>{p.account_name ?? "Unassigned"}</td>
                      <td>{p.asset_class}</td>
                      <td className="numeric">{p.weight_pct ?? "—"}</td>
                      <td className="numeric">{p.quantity ?? "—"}</td>
                      <td className="numeric">
                        {p.cost_basis ?? "—"} {p.cost_basis_currency ?? ""}
                      </td>
                      <td>{p.sector ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="terminal-card">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="terminal-card-title">Past snapshots</h2>
          <select
            value={snapshotFilterAccountId}
            onChange={(e) => handleSnapshotFilterChange(e.target.value)}
            className="input-terminal w-auto text-xs py-1"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.account_number})
              </option>
            ))}
          </select>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-tertiary text-sm">No snapshots uploaded yet.</p>
        ) : (
          <div className="terminal-table-wrapper">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Uploaded</th>
                  <th>Account</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th className="numeric">Positions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="primary">{new Date(s.uploaded_at).toLocaleString()}</td>
                    <td>{s.account_name ?? "Unassigned"}</td>
                    <td>{s.reporting_currency}</td>
                    <td>{s.status}</td>
                    <td className="numeric">{s.position_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
