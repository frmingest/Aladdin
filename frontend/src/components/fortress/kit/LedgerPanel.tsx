import { bandLine, bandSeals, callsLine, oracleLine } from "../../../lib/calibration";
import type { Calibration } from "../../../lib/types";
import ObjectArtImage from "../../ObjectArtImage";

/** The calibration ledger (game mode C2 "hit rate"), a quiet panel under the records. Counts only:
 * the server withholds every ratio until there are enough outcomes, and a ratio is always printed
 * with its count. The pictures are decoration (art on only, empty alt): the book stays closed, the
 * scale stays level and the lantern stays unlit whatever the numbers say, so no picture carries a
 * result. Seals beside a confidence row are shape-coded (filled / ring / dashed) and the same
 * counts are printed as text. Nothing here grades a decision or changes a verdict or a tower. */

function Seal({ kind }: { kind: "filled" | "ring" | "dashed" }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden focusable="false">
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill={kind === "filled" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={kind === "dashed" ? "2 2" : undefined}
      />
    </svg>
  );
}

export default function LedgerPanel({ data }: { data: Calibration }) {
  const { calls, oracle } = data;
  return (
    <section aria-labelledby="ledger-title" className="ui-card rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start gap-4">
        <ObjectArtImage id="ledger-book" width={72} fallback={null} className="shrink-0" />
        <div className="min-w-0">
          <h2 id="ledger-title" className="text-lg font-semibold text-ink">
            Ledger of calls
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{data.caption}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-faint">
            <ObjectArtImage id="ledger-staff" width={20} fallback={null} />
            Your calls
          </h3>
          <p className="mt-1 flex items-start gap-2 text-sm text-ink">
            {!calls.is_open && <ObjectArtImage id="ledger-lantern" width={22} fallback={null} className="mt-0.5 shrink-0" />}
            <span>{callsLine(calls, data.min_n)}</span>
          </p>
          {calls.is_open && (
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {calls.bands
                .filter((b) => b.n > 0)
                .map((b) => (
                  <li key={b.confidence} className="flex items-center gap-2">
                    <span className="flex gap-0.5 text-ink-muted">
                      {bandSeals(b).map((k, i) => (
                        <Seal key={i} kind={k} />
                      ))}
                    </span>
                    <span>{bandLine(b)}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-faint">
            <ObjectArtImage id="ledger-scale" width={28} fallback={null} />
            The analyst&apos;s range
          </h3>
          <p className="mt-1 text-sm text-ink">{oracleLine(oracle, data.min_n)}</p>
        </div>
      </div>
    </section>
  );
}
