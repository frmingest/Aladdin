import { useState } from "react";
import { api, ApiError } from "../lib/api";
import type { DocumentSummary, FinancialsProposal, ProposedFact, StatementFact } from "../lib/types";
import { METRIC_LABELS } from "../lib/types";
import { Button } from "./ui";

/**
 * Review-and-approve UI for LLM-assisted figure extraction from a PDF
 * filing (backend/app/services/documents/financial_extraction.py).
 * The LLM only proposes; every number shown as "verified" was found
 * verbatim on the page it cites, and nothing is saved until Save.
 */

const STATUS_STYLE: Record<ProposedFact["status"], string> = {
  verified: "bg-positive-subtle text-positive",
  rejected: "bg-negative-subtle text-negative",
  conflict: "bg-caution-subtle text-caution",
  duplicate: "bg-border-subtle text-ink-muted",
};

function parsePages(input: string): number[] {
  const pages = new Set<number>();
  for (const part of input.split(/[,\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      for (let p = Math.min(a, b); p <= Math.max(a, b) && pages.size < 20; p++) pages.add(p);
    } else if (/^\d+$/.test(part)) {
      pages.add(Number(part));
    }
  }
  return [...pages].sort((a, b) => a - b);
}

function formatStored(value: string | null, unit: string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  const abs = Math.abs(n);
  const [div, suffix] =
    abs >= 1e9 ? [1e9, "bn"] : abs >= 1e6 ? [1e6, "m"] : abs >= 1e3 ? [1e3, "k"] : [1, ""];
  const shown = (n / div).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${shown}${suffix} ${unit ?? ""}`.trim();
}

function toStatementFact(f: ProposedFact): StatementFact {
  return {
    metric: f.metric,
    fiscal_year: f.fiscal_year,
    value_as_printed: f.value_as_printed,
    scale: f.scale,
    currency: f.currency,
    source_page: f.source_page,
    label_as_printed: f.label_as_printed,
  };
}

export function FinancialsExtractPanel({
  document,
  onClose,
  onSaved,
}: {
  document: DocumentSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [proposal, setProposal] = useState<FinancialsProposal | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pagesInput, setPagesInput] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function run(pages?: number[]) {
    setError(null);
    setSavedMessage(null);
    setRunning(true);
    try {
      const result = await api.proposeFinancials(document.id, pages);
      setProposal(result);
      setSelected(
        new Set(result.facts.map((f, i) => (f.status === "verified" ? i : -1)).filter((i) => i >= 0)),
      );
      if (!pagesInput) setPagesInput(result.pages_sent.join(", "));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Extraction failed.");
    } finally {
      setRunning(false);
    }
  }

  async function save() {
    if (!proposal) return;
    setError(null);
    setSaving(true);
    try {
      const facts = proposal.facts.filter((_, i) => selected.has(i)).map(toStatementFact);
      const result = await api.approveFinancials(document.id, facts, {
        provider: proposal.provider,
        model: proposal.model,
      });
      const years = [...new Set(result.saved.map((f) => f.period))].sort().join(", ");
      setSavedMessage(
        `Saved ${result.saved.length} figure(s)${years ? ` for ${years}` : ""}` +
          (result.refused.length ? ` · ${result.refused.length} refused on re-check` : "") +
          ".",
      );
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const verifiedCount = proposal?.facts.filter((f) => f.status === "verified").length ?? 0;

  return (
    <div className="mt-4 rounded-md border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-ink">
            Extract figures — {document.original_filename}
          </h4>
          <p className="mt-1 text-xs text-ink-muted">
            The LLM copies statement lines as printed; the app checks every number really is on the
            page it cites, scales it, and saves only what you approve.
          </p>
        </div>
        <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
          Close
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Pages (optional, e.g. 45-48, 52)</span>
          <input
            value={pagesInput}
            onChange={(e) => setPagesInput(e.target.value)}
            placeholder="auto-detect"
            className="w-56 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <Button disabled={running || saving} onClick={() => void run(parsePages(pagesInput))}>
          {running ? "Reading…" : proposal ? "Read again" : "Read statements"}
        </Button>
        {running && (
          <span className="text-xs text-ink-muted">
            The local LLM is reading the pages — this can take a few minutes.
          </span>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {savedMessage && <p className="mb-3 text-sm text-positive">{savedMessage}</p>}

      {proposal && (
        <>
          <p className="mb-2 text-xs text-ink-muted">
            Read page(s) {proposal.pages_sent.join(", ")}
            {proposal.auto_selected ? " (auto-detected)" : ""} · {proposal.model} ·{" "}
            {verifiedCount} of {proposal.facts.length} verified on the page
          </p>
          {proposal.facts.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No statement lines found on these pages. Enter the page numbers of the consolidated
              income statement, balance sheet and cash-flow statement and read again.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-muted whitespace-nowrap">
                    <th className="py-2 pr-2 font-medium" />
                    <th className="py-2 pr-3 font-medium">Metric</th>
                    <th className="py-2 pr-3 font-medium">Year</th>
                    <th className="py-2 pr-3 text-right font-medium">As printed</th>
                    <th className="py-2 pr-3 font-medium">Scale</th>
                    <th className="py-2 pr-3 text-right font-medium">Saved as</th>
                    <th className="py-2 pr-3 text-right font-medium">Page</th>
                    <th className="py-2 font-medium">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.facts.map((f, i) => (
                    <tr key={i} className="border-t border-border-subtle align-top">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          disabled={f.status !== "verified"}
                          onChange={() => toggle(i)}
                        />
                      </td>
                      <td className="py-2 pr-3 text-ink">
                        {METRIC_LABELS[f.metric] ?? f.metric.replace(/_/g, " ")}
                        <div className="text-xs text-ink-faint">“{f.label_as_printed}”</div>
                      </td>
                      <td className="py-2 pr-3 tabular text-ink-muted">{f.fiscal_year}</td>
                      <td className="py-2 pr-3 text-right tabular text-ink">{f.value_as_printed}</td>
                      <td className="py-2 pr-3 text-ink-muted">
                        {f.scale}
                        {f.currency ? ` ${f.currency}` : ""}
                      </td>
                      <td className="py-2 pr-3 text-right tabular text-ink-muted">
                        {formatStored(f.stored_value, f.stored_unit)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular text-ink-muted">{f.source_page}</td>
                      <td className="py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status]}`}
                        >
                          {f.status}
                        </span>
                        {[...f.reasons, ...f.warnings].map((r) => (
                          <div key={r} className="mt-0.5 text-xs text-ink-muted">
                            {r}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Button disabled={saving || running || selected.size === 0} onClick={() => void save()}>
              {saving ? "Saving…" : `Save ${selected.size} figure(s)`}
            </Button>
            <span className="text-xs text-ink-muted">
              Saving replaces figures previously extracted from this document.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
