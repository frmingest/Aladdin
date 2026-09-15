import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  addManualHolding,
  createAccount,
  deleteAccount,
  listAccounts,
  listHoldings,
  listManualHoldings,
  listSnapshots,
  resetPortfolio,
  updateHoldingMarketTicker,
  updateManualHolding,
  uploadPortfolio,
} from "../services/api";
import type {
  Account,
  Holding,
  ManualPositionResponse,
  PortfolioSnapshotDetail,
  PortfolioSnapshotSummary,
  PortfolioUploadResponse,
  RowError,
} from "../types/portfolio";
import { num } from "../lib/num";

/**
 * Preset "shapes" for the manual-entry form below — covers the coin types
 * Faiz actually buys (1 oz Maple Leaf, Krugerrand, Kangaroo, in gold and
 * silver) plus two open-ended fallbacks. Picking a preset sets the asset
 * class and, for gold/silver, the market_ticker ("XAU"/"XAG") that routes
 * pricing through the gold-api.com provider (backend/app/services/
 * market_data/gold_api.py) so "Refresh valuation" on the Dashboard shows
 * today's spot price. "Other collectible" has no live feed — see ADR 0011 —
 * so it's carried at cost basis instead (app/services/market_data/
 * valuation.py's "at_cost" path).
 */
const COIN_PRESETS = [
  { key: "gold-maple", label: "1 oz Gold Maple Leaf", name: "1 oz Gold Maple Leaf", assetClass: "COMMODITY", marketTicker: "XAU" },
  { key: "gold-krugerrand", label: "1 oz Gold Krugerrand", name: "1 oz Gold Krugerrand", assetClass: "COMMODITY", marketTicker: "XAU" },
  { key: "gold-kangaroo", label: "1 oz Gold Kangaroo", name: "1 oz Gold Kangaroo", assetClass: "COMMODITY", marketTicker: "XAU" },
  { key: "silver-maple", label: "1 oz Silver Maple Leaf", name: "1 oz Silver Maple Leaf", assetClass: "COMMODITY", marketTicker: "XAG" },
  { key: "silver-krugerrand", label: "1 oz Silver Krugerrand", name: "1 oz Silver Krugerrand", assetClass: "COMMODITY", marketTicker: "XAG" },
  { key: "silver-kangaroo", label: "1 oz Silver Kangaroo", name: "1 oz Silver Kangaroo", assetClass: "COMMODITY", marketTicker: "XAG" },
  { key: "other-gold", label: "Other gold item", name: "", assetClass: "COMMODITY", marketTicker: "XAU" },
  { key: "other-silver", label: "Other silver item", name: "", assetClass: "COMMODITY", marketTicker: "XAG" },
  { key: "other-collectible", label: "Other collectible (e.g. a whisky bottle)", name: "", assetClass: "COLLECTIBLE", marketTicker: "" },
] as const;

type CoinPreset = (typeof COIN_PRESETS)[number];

/**
 * One-off entry for a purchase that doesn't come from a broker export — the
 * gold/silver coins and other collectibles Faiz asked to add by hand. Wired
 * to POST /portfolio/holdings/manual (backend/app/api/portfolio.py).
 */
function ManualEntrySection({
  accounts,
  onAdded,
}: {
  accounts: Account[];
  onAdded: () => void;
}) {
  const [presetKey, setPresetKey] = useState<CoinPreset["key"]>(COIN_PRESETS[0].key);
  const preset = COIN_PRESETS.find((p) => p.key === presetKey) ?? COIN_PRESETS[0];
  const [name, setName] = useState<string>(preset.name);
  const [quantity, setQuantity] = useState("1");
  const [costBasis, setCostBasis] = useState("");
  // Default to NOK — matching the reporting currency the rest of this app
  // defaults to (see settings.default_reporting_currency and the upload
  // form's own reportingCurrency default below) — not USD. Previously both
  // currency fields independently defaulted to USD; changing "Holding
  // currency" to NOK for a coin without also remembering to change "Buy
  // price currency" silently stored (and FX-converted) the NOK amount paid
  // as if it were USD, producing a cost basis many times too large. The
  // sync effect below is the other half of that fix: as long as "Buy price
  // currency" hasn't been hand-edited, it tracks "Holding currency"
  // automatically instead of drifting from it.
  const [costBasisCurrency, setCostBasisCurrency] = useState("NOK");
  const [costBasisCurrencyTouched, setCostBasisCurrencyTouched] = useState(false);
  const [tradingCurrency, setTradingCurrency] = useState("NOK");

  function handleTradingCurrencyChange(value: string) {
    const next = value.toUpperCase();
    setTradingCurrency(next);
    if (!costBasisCurrencyTouched) setCostBasisCurrency(next);
  }

  function handleCostBasisCurrencyChange(value: string) {
    setCostBasisCurrencyTouched(true);
    setCostBasisCurrency(value.toUpperCase());
  }
  const [custodyType, setCustodyType] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handlePresetChange(key: string) {
    const next = COIN_PRESETS.find((p) => p.key === key) ?? COIN_PRESETS[0];
    setPresetKey(next.key);
    setName(next.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !quantity.trim()) return;
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      // Holding.ticker must be globally unique (see ingestion.py's lookup) —
      // the user never has to pick one, so it's generated here from the
      // preset and the current time.
      const ticker = `${preset.key.toUpperCase()}-${Date.now()}`;
      const added = await addManualHolding({
        ticker,
        name: name.trim(),
        asset_class: preset.assetClass,
        trading_currency: tradingCurrency.trim().toUpperCase(),
        quantity,
        cost_basis: costBasis.trim() || null,
        cost_basis_currency: costBasis.trim() ? costBasisCurrency.trim().toUpperCase() : null,
        market_ticker: preset.marketTicker || null,
        custody_type: custodyType.trim() || null,
        acquired_at: acquiredAt || null,
        notes: notes.trim() || null,
        account_id: accountId || null,
      });
      setSuccessMessage(
        preset.marketTicker
          ? `Added "${added.name}" — go to the Dashboard and click "Refresh valuation" to price it ` +
            `at today's ${preset.marketTicker === "XAU" ? "gold" : "silver"} spot price.`
          : `Added "${added.name}" — with no live price feed for it, it's carried at what you paid ` +
            `until you update it.`,
      );
      setName(preset.name);
      setQuantity("1");
      setCostBasis("");
      setCostBasisCurrencyTouched(false);
      setCustodyType("");
      setAcquiredAt("");
      setNotes("");
      onAdded();
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? String(err.detail ?? err.message) : "Could not add holding.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="terminal-card">
      <h2 className="terminal-card-title mb-2">Add a holding manually</h2>
      <p className="text-xs text-tertiary mb-3">
        For a one-off purchase that doesn't come from a broker export — a gold or silver coin, or
        any other collectible (a whisky bottle bought outside your Whiskybase export, say). Gold
        and silver are priced from today's spot price once you refresh valuation; anything else is
        carried at what you paid.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label-terminal">Type</label>
          <select
            value={presetKey}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="input-terminal min-w-[220px]"
          >
            {COIN_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-terminal">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 1 oz Gold Maple Leaf (2024)"
            className="input-terminal w-56"
          />
        </div>
        <div>
          <label className="label-terminal">Quantity</label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input-terminal w-20"
          />
        </div>
        <div>
          <label className="label-terminal">Buy price (optional)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            placeholder="e.g. 2450.00"
            className="input-terminal w-32"
          />
        </div>
        <div>
          <label className="label-terminal">Holding currency</label>
          <input
            type="text"
            value={tradingCurrency}
            onChange={(e) => handleTradingCurrencyChange(e.target.value)}
            maxLength={3}
            className="input-terminal w-20"
          />
        </div>
        <div>
          <label className="label-terminal">Buy price currency</label>
          <input
            type="text"
            value={costBasisCurrency}
            onChange={(e) => handleCostBasisCurrencyChange(e.target.value)}
            maxLength={3}
            className="input-terminal w-20"
            title="Follows Holding currency automatically unless you change it here"
          />
        </div>
        <div>
          <label className="label-terminal">Custody (optional)</label>
          <input
            type="text"
            value={custodyType}
            onChange={(e) => setCustodyType(e.target.value)}
            placeholder="e.g. home safe, vault"
            className="input-terminal w-36"
          />
        </div>
        <div>
          <label className="label-terminal">Acquired on (optional)</label>
          <input
            type="date"
            value={acquiredAt}
            onChange={(e) => setAcquiredAt(e.target.value)}
            className="input-terminal w-36"
          />
        </div>
        <div>
          <label className="label-terminal">Account (optional)</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="input-terminal min-w-[160px]"
          >
            <option value="">Unassigned</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.account_number})
              </option>
            ))}
          </select>
        </div>
        <div className="w-full">
          <label className="label-terminal">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. mint mark, condition, serial number"
            className="input-terminal w-full"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || !quantity.trim() || submitting}
          className="btn-terminal btn-terminal-primary"
        >
          {submitting ? "Adding…" : "Add holding"}
        </button>
      </form>
      {successMessage && <p className="text-positive text-sm mt-2">{successMessage}</p>}
      {errorMessage && <p className="text-negative text-sm mt-2">{errorMessage}</p>}
    </section>
  );
}

type ManualEditDraft = {
  quantity: string;
  costBasis: string;
  costBasisCurrency: string;
  tradingCurrency: string;
  notes: string;
};

function draftFrom(p: ManualPositionResponse): ManualEditDraft {
  return {
    quantity: p.quantity ?? "",
    costBasis: p.cost_basis ?? "",
    costBasisCurrency: p.cost_basis_currency ?? "",
    tradingCurrency: p.trading_currency,
    notes: p.notes ?? "",
  };
}

/**
 * Every manually-entered coin/collectible, with inline editing — the
 * correction path for the mistake ManualEntrySection above is designed to
 * prevent going forward, but can't undo for something already entered
 * wrong: a buy price stored in a currency that didn't match the holding's.
 * Before this section existed, fixing that meant "Delete all data" and
 * starting over. Wired to GET/PATCH /portfolio/holdings/manual.
 */
function ManualHoldingsSection({
  refreshSignal,
  onUpdated,
}: {
  refreshSignal: number;
  onUpdated: () => void;
}) {
  const [positions, setPositions] = useState<ManualPositionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ManualEditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listManualHoldings()
      .then(setPositions)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [refreshSignal]);

  function startEdit(p: ManualPositionResponse) {
    setEditingId(p.holding_id);
    setDraft(draftFrom(p));
    setErrorId(null);
    setSavedId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function handleSave(p: ManualPositionResponse) {
    if (!draft) return;
    setSavingId(p.holding_id);
    setErrorId(null);
    setErrorMessage(null);
    try {
      const updated = await updateManualHolding(p.holding_id, {
        quantity: draft.quantity.trim(),
        cost_basis: draft.costBasis.trim() || null,
        cost_basis_currency: draft.costBasis.trim() ? draft.costBasisCurrency.trim().toUpperCase() : null,
        trading_currency: draft.tradingCurrency.trim().toUpperCase(),
        notes: draft.notes.trim() || null,
      });
      setPositions((prev) => prev.map((x) => (x.holding_id === p.holding_id ? updated : x)));
      setEditingId(null);
      setDraft(null);
      setSavedId(p.holding_id);
      window.setTimeout(() => setSavedId((cur) => (cur === p.holding_id ? null : cur)), 2000);
      onUpdated();
    } catch (err) {
      setErrorId(p.holding_id);
      setErrorMessage(
        err instanceof ApiError ? String(err.detail ?? err.message) : "Could not save changes.",
      );
    } finally {
      setSavingId(null);
    }
  }

  // A different buy-price currency than holding currency is sometimes
  // exactly right (a US-dealer coin held/reported in NOK, say) — so this is
  // a neutral note, not an error. Still worth calling out inline, since it's
  // also exactly the shape of the entry mistake this section exists to fix
  // (both fields defaulted to the same currency, then only one got changed).
  const differsFromHoldingCurrency = new Set(
    positions
      .filter((p) => p.cost_basis_currency && p.cost_basis_currency !== p.trading_currency)
      .map((p) => p.holding_id),
  );

  return (
    <section className="terminal-card">
      <h2 className="terminal-card-title mb-2">Your manual entries</h2>
      <p className="text-xs text-tertiary mb-3">
        Every coin and collectible added above. If a buy price ends up looking wrong on the
        Dashboard (e.g. an implausible Unrealized P&amp;L), check here first — the usual cause is
        "Buy price currency" not matching "Holding currency" by mistake (noted below; sometimes
        intentional, e.g. a US-dealer coin held/reported in NOK). Edit and save to fix.
      </p>
      {loading ? (
        <p className="text-tertiary text-sm">Loading…</p>
      ) : positions.length === 0 ? (
        <p className="text-tertiary text-sm">No manual entries yet — add one above.</p>
      ) : (
        <div className="terminal-table-wrapper">
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Quantity</th>
                <th>Buy price</th>
                <th>Buy price currency</th>
                <th>Holding currency</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const isEditing = editingId === p.holding_id && draft;
                const notesCurrencyDiffers = differsFromHoldingCurrency.has(p.holding_id);
                return (
                  <tr key={p.holding_id}>
                    <td className="primary">
                      {p.name}
                      {notesCurrencyDiffers && !isEditing && (
                        <span
                          className="text-tertiary text-xs ml-2"
                          title="Buy price currency is different from holding currency — worth double-checking this was intentional"
                        >
                          (≠ holding currency)
                        </span>
                      )}
                    </td>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={draft.quantity}
                            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                            className="input-terminal w-20"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={draft.costBasis}
                            onChange={(e) => setDraft({ ...draft, costBasis: e.target.value })}
                            className="input-terminal w-28"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            maxLength={3}
                            value={draft.costBasisCurrency}
                            onChange={(e) =>
                              setDraft({ ...draft, costBasisCurrency: e.target.value.toUpperCase() })
                            }
                            className="input-terminal w-16"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            maxLength={3}
                            value={draft.tradingCurrency}
                            onChange={(e) =>
                              setDraft({ ...draft, tradingCurrency: e.target.value.toUpperCase() })
                            }
                            className="input-terminal w-16"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={draft.notes}
                            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                            className="input-terminal w-40"
                          />
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={() => handleSave(p)}
                            disabled={savingId === p.holding_id}
                            className="btn-terminal btn-terminal-primary text-xs px-3 py-1 mr-1"
                          >
                            {savingId === p.holding_id ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingId === p.holding_id}
                            className="text-tertiary hover:text-primary text-xs px-2"
                          >
                            Cancel
                          </button>
                          {errorId === p.holding_id && errorMessage && (
                            <div className="text-negative text-xs mt-1">{errorMessage}</div>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="numeric font-mono">{p.quantity ?? "—"}</td>
                        <td className="numeric font-mono">{num(p.cost_basis)?.toLocaleString() ?? "—"}</td>
                        <td>{p.cost_basis_currency ?? "—"}</td>
                        <td>{p.trading_currency}</td>
                        <td className="truncate max-w-[10rem]">{p.notes ?? "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="btn-terminal text-xs px-3 py-1"
                          >
                            {savedId === p.holding_id ? "Saved ✓" : "Edit"}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

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

/**
 * Every holding uploaded from a Nordnet export (decision 0003) starts with
 * `market_ticker` unset — Nordnet's export has no exchange ticker column, so
 * `ticker` is the full instrument name instead, which the Phase 2 market-data
 * layer (yfinance) can't price directly (app/services/market_data/valuation.py
 * skips any holding with no market_ticker and excludes it from totals rather
 * than guess — §21). This section is the self-serve fix: it lists every
 * holding and lets you set the real Yahoo-Finance-resolvable symbol, so
 * "Refresh valuation" on the dashboard has something to price.
 */
function MarketTickersSection({ refreshSignal }: { refreshSignal: number }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listHoldings()
      .then((hs) => {
        setHoldings(hs);
        setDrafts(Object.fromEntries(hs.map((h) => [h.id, h.market_ticker ?? ""])));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  // Re-fetches whenever a holding is added via the manual-entry form below,
  // so a newly-added coin shows up here too (relevant for anything without
  // a preset market_ticker, e.g. a manually-entered collectible).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [refreshSignal]);

  async function handleSave(holding: Holding) {
    const value = (drafts[holding.id] ?? "").trim();
    setSavingId(holding.id);
    setSavedId(null);
    setErrorId(null);
    setErrorMessage(null);
    try {
      const updated = await updateHoldingMarketTicker(holding.id, value || null);
      setHoldings((prev) => prev.map((h) => (h.id === holding.id ? updated : h)));
      setDrafts((prev) => ({ ...prev, [holding.id]: updated.market_ticker ?? "" }));
      setSavedId(holding.id);
      window.setTimeout(() => setSavedId((cur) => (cur === holding.id ? null : cur)), 2000);
    } catch (err) {
      setErrorId(holding.id);
      setErrorMessage(
        err instanceof ApiError ? String(err.detail ?? err.message) : "Could not save market ticker.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const unpricedCount = holdings.filter((h) => !h.market_ticker).length;

  return (
    <section className="terminal-card">
      <h2 className="terminal-card-title mb-2">Market data tickers</h2>
      <p className="text-xs text-tertiary mb-3">
        A Nordnet export has no exchange ticker, so the instrument's full name is stored as the
        holding's ticker instead — the dashboard can't price a holding, and it's excluded from
        Composition/Risk totals, until you give it a real market symbol here. Look it up on{" "}
        <a
          href="https://finance.yahoo.com"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          finance.yahoo.com
        </a>{" "}
        — e.g. <code>VAR.OL</code> for Oslo Børs, <code>XDEF.DE</code> for Xetra,{" "}
        <code>AUCO.L</code> for London. Leave it blank and save to clear a symbol.
      </p>
      {!loading && holdings.length > 0 && unpricedCount > 0 && (
        <p className="text-warning text-sm mb-3">
          {unpricedCount} of {holdings.length} holding(s) have no market ticker set yet.
        </p>
      )}
      {loading ? (
        <p className="text-tertiary text-sm">Loading holdings…</p>
      ) : holdings.length === 0 ? (
        <p className="text-tertiary text-sm">No holdings yet — upload a portfolio file below first.</p>
      ) : (
        <div className="terminal-table-wrapper">
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Uploaded ticker</th>
                <th>Currency</th>
                <th>Market ticker</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const draft = drafts[h.id] ?? "";
                const dirty = draft.trim() !== (h.market_ticker ?? "");
                return (
                  <tr key={h.id}>
                    <td className="primary">{h.name}</td>
                    <td>{h.ticker}</td>
                    <td>{h.trading_currency}</td>
                    <td>
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [h.id]: e.target.value }))
                        }
                        placeholder="e.g. VAR.OL"
                        className="input-terminal w-32"
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleSave(h)}
                        disabled={savingId === h.id || !dirty}
                        className="btn-terminal btn-terminal-primary text-xs px-3 py-1"
                      >
                        {savingId === h.id ? "Saving…" : savedId === h.id && !dirty ? "Saved" : "Save"}
                      </button>
                      {errorId === h.id && errorMessage && (
                        <div className="text-negative text-xs mt-1">{errorMessage}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
  const [manualEntryVersion, setManualEntryVersion] = useState(0);

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

      <ManualEntrySection
        accounts={accounts}
        onAdded={() => setManualEntryVersion((v) => v + 1)}
      />

      <ManualHoldingsSection
        refreshSignal={manualEntryVersion}
        onUpdated={() => setManualEntryVersion((v) => v + 1)}
      />

      <MarketTickersSection refreshSignal={manualEntryVersion} />

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
