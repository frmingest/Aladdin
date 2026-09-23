import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatPct100 } from "../lib/format";
import type { Holding, JournalAction, JournalEntry } from "../lib/types";
import { JOURNAL_ACTIONS as ACTIONS } from "../lib/types";
import { Button, Card, VerdictBadge } from "./ui";

/** Decision journal building blocks (feature F6), shared by the Journal
 * page and the holding page. Outcomes are computed on the server from
 * stored prices (backend/app/services/journal.py). */

const ACTION_STYLE: Record<JournalAction, string> = {
  buy: "bg-positive-subtle text-positive",
  add: "bg-positive-subtle text-positive",
  trim: "bg-caution-subtle text-caution",
  sell: "bg-negative-subtle text-negative",
  hold: "bg-border-subtle text-ink",
  pass: "bg-border-subtle text-ink-muted",
};

const input = "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalEntryForm({
  holdings,
  fixedHolding,
  onSaved,
  onCancel,
}: {
  /** Choices for the holding picker; ignored when fixedHolding is set. */
  holdings?: Holding[];
  fixedHolding?: Holding;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [holdingId, setHoldingId] = useState(fixedHolding?.id ?? "");
  const [action, setAction] = useState<JournalAction>("buy");
  const [decidedOn, setDecidedOn] = useState(today());
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [thesis, setThesis] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = fixedHolding ?? holdings?.find((h) => h.id === holdingId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!holdingId || !thesis.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createJournalEntry({
        holding_id: holdingId,
        action,
        decided_on: decidedOn,
        price: price.trim() || null,
        quantity: quantity.trim() || null,
        thesis,
        invalidation: invalidation.trim() || null,
        confidence,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!fixedHolding && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted lg:col-span-2">
            Company
            <select className={input} value={holdingId} onChange={(e) => setHoldingId(e.target.value)} required>
              <option value="">Choose…</option>
              {holdings?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.ticker})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Decision
          <select className={input} value={action} onChange={(e) => setAction(e.target.value as JournalAction)}>
            {ACTIONS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Date
          <input type="date" className={input} value={decidedOn} max={today()} onChange={(e) => setDecidedOn(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Price {selected && <span className="text-ink-faint">({selected.trading_currency})</span>}
          <input className={input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Quantity
          <input className={input} inputMode="decimal" placeholder="optional" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(",", "."))} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Why? The reason for this decision, in your own words
        <textarea className={`${input} min-h-[4.5rem]`} value={thesis} onChange={(e) => setThesis(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        What would prove me wrong?
        <textarea
          className={`${input} min-h-[3rem]`}
          placeholder="e.g. Return on capital falls below 12% two years in a row"
          value={invalidation}
          onChange={(e) => setInvalidation(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          Confidence
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setConfidence(confidence === n ? null : n)}
              aria-pressed={confidence === n}
              className={`h-7 w-7 rounded-full border text-xs font-medium ${
                confidence !== null && n <= confidence
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-ink-muted hover:border-accent"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy || !holdingId || !thesis.trim()}>
            {busy ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
    </form>
  );
}

/** Colour follows whether the move favours the decision, not its sign:
 * a price drop after a sell or pass is shown green. Hold is neutral. */
function ReturnValue({ pct, action }: { pct: string | null; action: JournalAction }) {
  if (pct === null) return <span className="text-ink-faint">—</span>;
  const n = Number(pct);
  const bullish = action === "buy" || action === "add";
  const bearish = action === "sell" || action === "trim" || action === "pass";
  const good = (bullish && n > 0) || (bearish && n < 0);
  const bad = (bullish && n < 0) || (bearish && n > 0);
  return (
    <span className={good ? "text-positive" : bad ? "text-negative" : "text-ink"}>
      {n > 0 ? "+" : ""}
      {formatPct100(pct)}
    </span>
  );
}

function ReviewField({
  entry,
  which,
  onSaved,
}: {
  entry: JournalEntry;
  which: "review_6m" | "review_12m";
  onSaved: () => void;
}) {
  const [text, setText] = useState(entry[which] ?? "");
  const [busy, setBusy] = useState(false);
  const label = which === "review_6m" ? "6-month review" : "12-month review";

  async function save() {
    setBusy(true);
    try {
      await api.updateJournalEntry(entry.id, { [which]: text.trim() || null });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-caution/40 bg-caution-subtle/50 p-3">
      <p className="text-xs font-medium text-caution">{label} due: was the reasoning right, and does the thesis still hold?</p>
      <textarea className={`${input} mt-2 min-h-[3rem]`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 text-right">
        <Button variant="secondary" onClick={save} disabled={busy || !text.trim()}>
          Save review
        </Button>
      </div>
    </div>
  );
}

export function JournalEntryCard({
  entry,
  onChanged,
  showCompany = true,
}: {
  entry: JournalEntry;
  onChanged: () => void;
  showCompany?: boolean;
}) {
  const o = entry.outcome;

  async function remove() {
    if (!window.confirm("Delete this journal entry? This can't be undone.")) return;
    await api.deleteJournalEntry(entry.id);
    onChanged();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${ACTION_STYLE[entry.action]}`}>
              {entry.action}
            </span>
            {showCompany &&
              (entry.holding_id ? (
                <Link to={`/holdings/${entry.holding_id}`} className="font-medium text-ink hover:text-accent">
                  {entry.company_name}
                </Link>
              ) : (
                <span className="font-medium text-ink" title="The holding was deleted; the entry is kept">
                  {entry.company_name}
                </span>
              ))}
            <span className="text-xs text-ink-faint">
              {entry.ticker} · {formatDate(entry.decided_on)}
              {entry.price && ` · at ${formatDecimal(entry.price)} ${entry.currency ?? ""}`}
              {entry.quantity && ` · ${formatDecimal(entry.quantity, 0)} shares`}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {entry.confidence !== null && <span>Confidence {entry.confidence}/5</span>}
            {entry.verdict_at_decision && (
              <span className="inline-flex items-center gap-1">
                Verdict then <VerdictBadge rating={entry.verdict_at_decision} />
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="tabular font-semibold">
            <ReturnValue pct={o.return_pct} action={entry.action} />
          </p>
          <p className="text-xs text-ink-faint">
            {o.return_pct !== null
              ? `since then (${o.days_since} days)${o.in_favour === null ? "" : o.in_favour ? " · in your favour" : " · against you"}`
              : o.note ?? (entry.price ? "no stored price yet" : "no decision price")}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-ink-muted">Why</p>
          <p className="whitespace-pre-line text-ink">{entry.thesis}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-muted">What would prove me wrong</p>
          <p className="whitespace-pre-line text-ink">{entry.invalidation ?? <span className="text-ink-faint">Not written</span>}</p>
        </div>
      </div>

      {(o.return_6m_pct !== null || o.return_12m_pct !== null) && (
        <p className="tabular mt-3 text-xs text-ink-muted">
          After 6 months <ReturnValue pct={o.return_6m_pct} action={entry.action} /> · after 12 months <ReturnValue pct={o.return_12m_pct} action={entry.action} />
        </p>
      )}
      {entry.review_6m && (
        <p className="mt-3 text-sm text-ink">
          <span className="text-xs font-medium text-ink-muted">6-month review: </span>
          {entry.review_6m}
        </p>
      )}
      {entry.review_12m && (
        <p className="mt-1 text-sm text-ink">
          <span className="text-xs font-medium text-ink-muted">12-month review: </span>
          {entry.review_12m}
        </p>
      )}
      {o.review_6m_due && <ReviewField entry={entry} which="review_6m" onSaved={onChanged} />}
      {!o.review_6m_due && o.review_12m_due && <ReviewField entry={entry} which="review_12m" onSaved={onChanged} />}

      <div className="mt-3 text-right">
        <button onClick={remove} className="text-xs text-ink-faint hover:text-negative">
          Delete
        </button>
      </div>
    </Card>
  );
}
