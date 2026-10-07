import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { buildKeyNumbers, type KeyNumberTile } from "../lib/keyNumbers";
import type { HoldingValuation } from "../lib/types";
import { GLOSSARY } from "../lib/glossary";
import { InfoTooltip } from "./InfoTooltip";

/** Price, base value and margin of safety at the top of the Overview tab. Reads
 * the stored valuation (a GET never calls a data vendor); renders nothing while
 * loading or when the valuation cannot be read, so it never adds an error line
 * to a page that already has the analysis on it. */

const TONE: Record<KeyNumberTile["tone"], string> = {
  good: "text-positive",
  bad: "text-negative",
  neutral: "text-ink",
  unknown: "text-ink-faint",
};

export function KeyNumbersRow({ valuation }: { valuation: HoldingValuation }) {
  const { tiles, note } = buildKeyNumbers(valuation);
  return (
    <div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-surface px-4 py-3">
            <dt className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-ink-muted">
              {t.label}
              {t.id === "margin" && <InfoTooltip text={GLOSSARY.marginOfSafety} />}
            </dt>
            <dd className={`tabular mt-1 text-xl font-semibold ${TONE[t.tone]}`}>{t.value}</dd>
            {t.hint && <p className="mt-0.5 text-xs text-ink-faint">{t.hint}</p>}
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

export default function KeyNumbers({ holdingId }: { holdingId: string }) {
  const [valuation, setValuation] = useState<HoldingValuation | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .getHoldingValuation(holdingId)
      .then((v) => {
        if (!cancelled) setValuation(v);
      })
      .catch(() => {
        if (!cancelled) setValuation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [holdingId]);
  return valuation ? <KeyNumbersRow valuation={valuation} /> : null;
}
