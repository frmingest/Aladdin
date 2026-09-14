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
    <section>
      <h2 className="text-lg font-semibold mb-3">Accounts</h2>
      <p className="text-xs text-slate-500 mb-3">
        The accounts your holdings are split across. Tag an upload with one below, then filter
        snapshots, positions, and the dashboard by account.
      </p>

      {accounts.length > 0 && (
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="py-1 pr-4">Name</th>
              <th className="py-1 pr-4">Account number</th>
              <th className="py-1 pr-4">Institution</th>
              <th className="py-1 pr-4" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-900">
                <td className="py-1 pr-4">{a.name}</td>
                <td className="py-1 pr-4 text-slate-400">{a.account_number}</td>
                <td className="py-1 pr-4 text-slate-400">{a.institution ?? "—"}</td>
                <td className="py-1 pr-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    disabled={deletingId === a.id}
                    className="text-red-400 hover:text-red-300 disabled:opacity-40 text-xs"
                  >
                    {deletingId === a.id ? "Removing…" : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aksje & fonds konto"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-56"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Account number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 70541644"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Institution (optional)</label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. Nordnet"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-40"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || !accountNumber.trim() || adding}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium"
        >
          {adding ? "Adding…" : "Add account"}
        </button>
      </form>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
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

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Upload portfolio (CSV/XLSX)</h2>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={resetting || submitting}
            className="text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed border border-red-900 hover:border-red-700 rounded px-3 py-1 text-xs font-medium"
          >
            {resetting ? "Deleting…" : "Delete all data"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Each upload adds to your current portfolio — a ticker in the new file replaces its old row
          within the same account, and any position not in the new file is kept as-is. Use
          "Delete all data" to start over from scratch.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Portfolio file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm min-w-[200px]"
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
            <label className="block text-sm text-slate-400 mb-1">Reporting currency</label>
            <input
              type="text"
              value={reportingCurrency}
              onChange={(e) => setReportingCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!file || submitting}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium"
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </form>

        {resetMessage && <p className="text-emerald-400 text-sm mt-3">{resetMessage}</p>}
        {errorMessage && <p className="text-red-400 text-sm mt-3">{errorMessage}</p>}
        {rowErrors && (
          <ul className="text-red-400 text-sm mt-2 list-disc list-inside">
            {rowErrors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="text-amber-400 text-sm mt-2 list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {result && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-sm text-slate-400 mb-2">
              Snapshot {result.id.slice(0, 8)} — {result.status} — {result.positions.length} position(s)
              {uploadStats && (
                <>
                  {" "}
                  ({uploadStats.new_position_count} new, {uploadStats.updated_position_count} updated,{" "}
                  {uploadStats.carried_forward_position_count} carried forward)
                </>
              )}
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-1 pr-4">Ticker</th>
                  <th className="py-1 pr-4">Name</th>
                  <th className="py-1 pr-4">Account</th>
                  <th className="py-1 pr-4">Asset class</th>
                  <th className="py-1 pr-4">Weight %</th>
                  <th className="py-1 pr-4">Quantity</th>
                  <th className="py-1 pr-4">GAV</th>
                  <th className="py-1 pr-4">Sector</th>
                </tr>
              </thead>
              <tbody>
                {result.positions.map((p) => (
                  <tr key={`${p.account_id ?? "none"}-${p.holding_id}`} className="border-b border-slate-900">
                    <td className="py-1 pr-4">{p.ticker}</td>
                    <td className="py-1 pr-4">{p.name}</td>
                    <td className="py-1 pr-4 text-slate-400">{p.account_name ?? "Unassigned"}</td>
                    <td className="py-1 pr-4">{p.asset_class}</td>
                    <td className="py-1 pr-4">{p.weight_pct ?? "—"}</td>
                    <td className="py-1 pr-4">{p.quantity ?? "—"}</td>
                    <td className="py-1 pr-4">
                      {p.cost_basis ?? "—"} {p.cost_basis_currency ?? ""}
                    </td>
                    <td className="py-1 pr-4">{p.sector ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Past snapshots</h2>
          <select
            value={snapshotFilterAccountId}
            onChange={(e) => handleSnapshotFilterChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
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
          <p className="text-slate-500 text-sm">No snapshots uploaded yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-1 pr-4">Uploaded</th>
                <th className="py-1 pr-4">Account</th>
                <th className="py-1 pr-4">Currency</th>
                <th className="py-1 pr-4">Status</th>
                <th className="py-1 pr-4">Positions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-b border-slate-900">
                  <td className="py-1 pr-4">{new Date(s.uploaded_at).toLocaleString()}</td>
                  <td className="py-1 pr-4 text-slate-400">{s.account_name ?? "Unassigned"}</td>
                  <td className="py-1 pr-4">{s.reporting_currency}</td>
                  <td className="py-1 pr-4">{s.status}</td>
                  <td className="py-1 pr-4">{s.position_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
