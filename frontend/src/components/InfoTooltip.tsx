import { useEffect, useId, useRef, useState } from "react";

/** A small "i" hover/tap target that explains one value, metric, or chart
 * in plain language — for the finance/valuation jargon (DCF, beta,
 * margin of safety, regime, correlation, …) sprinkled across the app.
 * Not a native `title` tooltip: those don't work on touch and can't wrap
 * onto multiple lines, so this is its own popover — opens on hover
 * (desktop), tap/click (mobile), and keyboard focus, and closes on
 * Escape, blur, or an outside click/tap. Purely explanatory: it never
 * carries a citation or a live value, only static copy passed in by the
 * caller. */
export function InfoTooltip({
  text,
  label = "What does this mean?",
  align = "center",
}: {
  text: string;
  label?: string;
  /** Which edge the popover hangs from, so it doesn't run off-screen when
   * the icon sits near the left/right edge of a card or table column. */
  align?: "left" | "center" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const alignClass =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  const arrowAlignClass =
    align === "left" ? "left-3" : align === "right" ? "right-3" : "left-1/2 -translate-x-1/2";

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-subtle text-[9px] font-semibold leading-none text-ink-faint transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:border-accent focus-visible:text-accent"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className={`pointer-events-none absolute bottom-full z-30 mb-2 w-64 max-w-[85vw] rounded-lg border border-border bg-raised p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink-muted shadow-card sm:w-72 ${alignClass}`}
        >
          {text}
          <span
            aria-hidden
            className={`absolute top-full h-2 w-2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-raised ${arrowAlignClass}`}
          />
        </span>
      )}
    </span>
  );
}
