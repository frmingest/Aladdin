import { useEffect, useRef } from "react";
import { factKey, formatFactValue, groupStatements, jumpablePage } from "../lib/statements";
import type { DocumentFact } from "../lib/types";

/** The figures stored from a filing, laid out as statement tables. Each
 * figure that has a source page is a button: pressing it scrolls the filing
 * next to this pane to the page that figure was taken from. */
export function StatementsPane({
  facts,
  activeKey,
  focusMetric,
  canJump,
  onJump,
}: {
  facts: DocumentFact[];
  /** The figure whose page the filing is currently showing. */
  activeKey: string | null;
  /** Emphasised row when the reader was opened from one figure. */
  focusMetric?: string;
  canJump: boolean;
  onJump: (fact: DocumentFact) => void;
}) {
  const groups = groupStatements(facts);
  const rootRef = useRef<HTMLDivElement>(null);

  // Opened from a figure: bring that row into view in the pane.
  useEffect(() => {
    if (!focusMetric) return;
    rootRef.current?.querySelector('[data-focus="true"]')?.scrollIntoView({ block: "center" });
  }, [focusMetric]);

  return (
    <div ref={rootRef} className="h-full overflow-y-auto px-3 py-3">
      <p className="mb-3 text-xs text-ink-muted">
        {canJump
          ? "Press a figure to open the filing at the page it was taken from."
          : "Figures stored from this file."}
      </p>
      {groups.map((group) => (
        <section key={group.key} className="mb-5">
          <h3 className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {group.title}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-1 text-left font-medium" />
                {group.periods.map((p) => (
                  <th key={p} className="py-1 pl-2 font-medium">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => {
                const focused = row.metric === focusMetric;
                return (
                  <tr
                    key={row.metric}
                    data-focus={focused ? "true" : undefined}
                    className={`border-t border-border-subtle ${focused ? "bg-accent-subtle" : ""}`}
                  >
                    <td className="py-1.5 pr-2 text-ink">{row.label}</td>
                    {group.periods.map((period) => {
                      const fact = row.cells[period];
                      if (!fact) {
                        return (
                          <td key={period} className="py-1.5 pl-2 text-right text-ink-faint">
                            —
                          </td>
                        );
                      }
                      const page = jumpablePage(fact);
                      const derived = fact.confidence < 1;
                      const text = (
                        <>
                          <span className="tabular">{formatFactValue(fact)}</span>
                          {derived && (
                            <span className="ml-1 text-[10px] text-ink-muted" title="Derived or proxy figure">
                              ≈
                            </span>
                          )}
                          {page && <span className="block text-[10px] leading-none text-ink-faint">p{page}</span>}
                        </>
                      );
                      if (!page || !canJump) {
                        return (
                          <td key={period} className="py-1.5 pl-2 text-right text-ink">
                            {text}
                          </td>
                        );
                      }
                      const active = activeKey === factKey(fact);
                      return (
                        <td key={period} className="py-0.5 pl-1 text-right">
                          <button
                            type="button"
                            onClick={() => onJump(fact)}
                            aria-pressed={active}
                            title={`Show ${row.label} ${period} in the filing (page ${page})`}
                            className={`w-full rounded-md px-1.5 py-1 text-right text-ink transition-colors hover:bg-accent-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                              active ? "bg-accent-subtle ring-1 ring-accent" : ""
                            }`}
                          >
                            {text}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
