import { useState } from "react";

/**
 * Small "why does this exist" explainer, used next to a dashboard section's
 * title to answer — in plain language — what the graph/section shows and why
 * it's part of the overall risk/analysis picture (as opposed to axis-label
 * tooltips, which explain a single data point; see charts/tooltip.ts for
 * those). Opens on hover/focus for a mouse/keyboard user and toggles on
 * click/tap so it also works on a touch device with no hover state.
 */
export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Why this matters"
        aria-expanded={open}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-primary text-[10px] leading-none text-tertiary hover:text-accent hover:border-accent transition-colors"
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-primary bg-secondary p-3 text-xs leading-relaxed text-secondary shadow-lg sm:w-72"
        >
          {text}
        </div>
      )}
    </span>
  );
}
