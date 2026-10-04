import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatPercent } from "../lib/format";
import type { HoldingValuation } from "../lib/types";
import { Button, Card, EmptyState } from "./ui";

const INPUT =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none";

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed.";
}

type Provider = "xtrackers" | "lgim";
const PROVIDERS: Record<Provider, { label: string; placeholder: string }> = {
  xtrackers: { label: "Xtrackers", placeholder: "LU3061478973" },
  lgim: { label: "L&G", placeholder: "IE00B3CNHG25" },
};

/** Fund look-through valuation (2026-09-29): fetch an Xtrackers or L&G ETF's
 * full holdings from the issuer's free public feed/file, fetch each holding's trailing P/E, and
 * show the earnings-yield screen that puts the fund on the margin-of-safety
 * board. Fetching P/Es is one provider call per holding, so it only runs
 * when the button is pressed — never on page load. */
export function FundLookThroughCard({
  holdingId,
  onChanged,
}: {
  holdingId: string;
  onChanged: () => void;
}) {
  const [valuation, setValuation] = useState<HoldingValuation | null>(null);
  const [provider, setProvider] = useState<Provider>("xtrackers");
  const [isin, setIsin] = useState("");
  const [busy, setBusy] = useState<"fetch" | "refresh" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getHoldingValuation(holdingId)
      .then(setValuation)
      .catch((e) => setError(errorText(e)));
  }, [holdingId]);

  useEffect(load, [load]);

  async function fetchHoldings() {
    setBusy("fetch");
    setError(null);
    setNote(null);
    try {
      const r =
        provider === "lgim"
          ? await api.fetchLgimHoldings(holdingId, isin.trim())
          : await api.fetchXtrackersHoldings(holdingId, isin.trim());
      setNote(`Fetched ${r.rows_imported} holdings as of ${r.as_of_date}; ${r.linked} linked to companies in the app. Now refresh the look-through.`);
      onChanged();
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    setError(null);
    setNote(null);
    try {
      const r = await api.refreshFundLookThrough(holdingId);
      setNote(
        `Fetched P/E for ${r.priced} of ${r.lines} holdings` +
          (r.unpriced ? ` (${r.unpriced} without a usable P/E)` : "") +
          (r.no_isin ? ` (${r.no_isin} with no ISIN and no linked company)` : "") +
          (r.newly_linked ? `; linked ${r.newly_linked} to companies in the app` : "") +
          (r.via_link ? `; ${r.via_link} priced through the linked company` : "") +
          ".",
      );
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const look = valuation?.fund_look_through ?? null;
  const currency = valuation?.valuation_currency ?? "";

  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink">Look-through valuation</h3>
      <p className="mt-0.5 text-xs text-ink-muted">
        Values the basket this fund holds: its holdings&apos; earnings yield against the fair P/E at the DCF&apos;s cost
        of equity. This is what ranks the fund on the Margin of safety board.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3 border-b border-border-subtle pb-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Issuer</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className={INPUT}
            aria-label="Holdings provider"
          >
            {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDERS[p].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">{PROVIDERS[provider].label} fund ISIN</span>
          <input
            value={isin}
            onChange={(e) => setIsin(e.target.value)}
            placeholder={PROVIDERS[provider].placeholder}
            className={`${INPUT} w-44 uppercase`}
          />
        </label>
        <Button variant="secondary" onClick={() => void fetchHoldings()} disabled={busy !== null || isin.trim().length < 12}>
          {busy === "fetch" ? "Fetching…" : `Fetch holdings from ${PROVIDERS[provider].label}`}
        </Button>
        <Button onClick={() => void refresh()} disabled={busy !== null}>
          {busy === "refresh" ? "Fetching P/Es… (can take a minute)" : "Refresh look-through"}
        </Button>
      </div>
      {note && <p className="mt-2 text-xs text-ink-muted">{note}</p>}
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}

      <div className="mt-4">
        {valuation === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {valuation !== null && valuation.valuation_status === "implausible" && (
          <div className="rounded-md border border-negative/30 bg-negative-subtle px-3 py-3 text-sm text-negative">
            <p className="font-semibold">Look-through withheld — not reliable</p>
            <p className="mt-1 text-xs">{valuation.valuation_status_reason}</p>
          </div>
        )}
        {valuation !== null && valuation.valuation_status !== "implausible" && !look && (
          <EmptyState>
            {valuation.unavailable_reasons.find((r) => r.includes("Look-through")) ?? "Look-through valuation unavailable."}
          </EmptyState>
        )}
        {look && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {look.scenarios.map((s) => (
                <div key={s.label} className="rounded-md border border-border-subtle p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{s.label}</p>
                  <p className="tabular mt-1 font-display text-xl font-semibold text-ink">
                    {formatDecimal(s.value_per_unit)} {currency}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    fair P/E {formatDecimal(s.fair_pe, 1)}x
                    {s.margin_of_safety !== null ? ` · MoS ${formatPercent(s.margin_of_safety)}` : ""}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              Fund P/E {formatDecimal(look.fund_pe, 1)}x (earnings yield {formatPercent(look.fund_earnings_yield)}) ·
              covers {formatDecimal(look.coverage_pct, 0)}% of the fund ({look.constituents_used} of{" "}
              {look.constituents_total} holdings) · cost of equity {formatPercent(look.cost_of_equity)} · terminal growth{" "}
              {formatPercent(look.terminal_growth_rate)}
              {look.oldest_observation ? ` · P/Es from ${formatDate(look.oldest_observation)}` : ""}
            </p>
            {look.notes.length > 0 && <p className="mt-1 text-xs text-caution">{look.notes.join(" ")}</p>}
            <p className="mt-1 text-xs text-ink-faint">{look.method_note}</p>
          </>
        )}
      </div>
    </Card>
  );
}
