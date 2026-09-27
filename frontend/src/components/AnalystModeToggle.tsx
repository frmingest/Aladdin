import { useAnalystMode } from "../lib/analystMode";
import { MODE_OPTIONS } from "../lib/analystTypes";

/**
 * Epic F22, story 22.1: one-click, whole-app switch between the
 * Buffett/Munger, Ray Dalio and side-by-side analyst modes. Lives in the
 * top bar on every page, so the active mode is always visible.
 */
export function AnalystModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, error } = useAnalystMode();
  const active = MODE_OPTIONS.find((o) => o.value === mode) ?? MODE_OPTIONS[0];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {!compact && (
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint md:inline">
          Analyst
        </span>
      )}
      <div
        role="radiogroup"
        aria-label="Analyst mode"
        className="inline-flex rounded-lg border border-border bg-raised p-0.5"
      >
        {MODE_OPTIONS.map((option) => {
          const selected = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.hint}
              onClick={() => {
                if (!selected) void setMode(option.value);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selected ? "bg-accent text-onfill shadow-sm" : "text-ink-muted hover:bg-border-subtle hover:text-ink"
              }`}
            >
              {compact ? option.short : option.label}
            </button>
          );
        })}
      </div>
      {!compact && <span className="hidden max-w-[42ch] truncate text-xs text-ink-faint xl:inline">{active.hint}</span>}
      {error && <span className="text-xs text-negative">{error}</span>}
    </div>
  );
}

/** Small label for page headers: which lens the page is showing. */
export function AnalystModeChip() {
  const { mode } = useAnalystMode();
  const active = MODE_OPTIONS.find((o) => o.value === mode) ?? MODE_OPTIONS[0];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] font-medium text-accent">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      {active.label} view
    </span>
  );
}
