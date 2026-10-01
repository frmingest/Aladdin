import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { parseCashNok } from "../../lib/format";
import type { GameVaultAccount } from "../../lib/types";
import { Button } from "../ui";

/** Hand-entered cash per account (game mode G5). The Nordnet export has
 * positions only, so the Vault is whatever Faiz types here. Saving is a plain
 * PATCH /accounts/{id}; nothing else is touched and nothing is traded. An
 * empty box clears the figure back to "never entered"; 0 means "entered and
 * empty". */
export default function VaultEditor({
  accounts,
  onSaved,
  onClose,
}: {
  accounts: GameVaultAccount[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      accounts.map((a) => [a.account_id ?? a.name, a.cash_nok === null ? "" : String(Math.round(Number(a.cash_nok)))]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const changes: { id: string; value: string | null }[] = [];
    for (const a of accounts) {
      if (a.account_id === null) continue;
      const parsed = parseCashNok(values[a.account_id] ?? "");
      if (!parsed.ok) {
        setError(`Could not read the amount for ${a.name}. Use a plain number such as 250000 or 250 000.`);
        return;
      }
      const before = a.cash_nok === null ? null : Number(a.cash_nok);
      const after = parsed.value === null ? null : Number(parsed.value);
      if (before !== after) changes.push({ id: a.account_id, value: parsed.value });
    }
    if (changes.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const c of changes) await api.updateAccount(c.id, { cash_nok: c.value });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the cash.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-border-subtle p-3">
      <p className="text-xs text-ink-muted">
        Cash held in each account, in kroner. Typed by you; Nordnet&apos;s export does not include it. Leave a box
        empty if you have not checked it, enter 0 if the account is fully invested.
      </p>
      <ul className="mt-3 space-y-2">
        {accounts.map((a) => {
          const key = a.account_id ?? a.name;
          return (
            <li key={key} className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`cash-${key}`} className="min-w-0 flex-1 text-ink">
                {a.name}
                {a.cash_as_of && (
                  <span className={`ml-2 text-xs ${a.stale ? "text-caution" : "text-ink-faint"}`}>
                    entered {formatDate(a.cash_as_of)}
                    {a.stale ? " (old)" : ""}
                  </span>
                )}
              </label>
              <input
                id={`cash-${key}`}
                inputMode="decimal"
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") onClose();
                }}
                disabled={saving || a.account_id === null}
                placeholder="not entered"
                className="tabular w-36 rounded-md border border-border px-2 py-1 text-right text-sm focus:border-accent focus:outline-none"
              />
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs text-negative">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save cash"}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
