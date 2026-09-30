import { useEffect, useState } from "react";
import { formatRelative } from "../lib/format";
import { InfoTooltip } from "./InfoTooltip";

/** Small shared building blocks used by both holding pages — kept here
 * rather than duplicated once a second page needed the same card/badge
 * shapes. */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A section with the same uppercase heading style as the holding page's
 * other sections, but whose body can be collapsed. The body is only
 * mounted while open, so a collapsed panel makes no API calls. */
export function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  id,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  /** Anchor for `SectionJumpBar`; jumping to a collapsed section opens it. */
  id?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (!id) return;
    const onJump = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) setOpen(true);
    };
    window.addEventListener("section-jump", onJump);
    return () => window.removeEventListener("section-jump", onJump);
  }, [id]);
  return (
    <div id={id} className="scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group mb-3 flex w-full items-center gap-2.5 text-left font-display text-base font-semibold tracking-tight text-ink"
      >
        <span
          aria-hidden
          className={`inline-flex h-5 w-5 items-center justify-center rounded-md bg-raised text-[10px] text-ink-muted transition-transform group-hover:text-accent ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        {title}
        {!open && hint && (
          <span className="ml-1 text-xs font-normal normal-case tracking-normal text-ink-faint">
            {hint}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  processed: "bg-positive-subtle text-positive",
  failed: "bg-negative-subtle text-negative",
  processing: "bg-caution-subtle text-caution",
  uploaded: "bg-border-subtle text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-border-subtle text-ink-muted";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const base = "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-accent text-onfill hover:bg-accent-hover",
    secondary: "border border-border bg-surface text-ink hover:bg-border-subtle",
    danger: "bg-negative text-onfill hover:bg-negative/90",
  } as const;
  return (
    <button className={`${base} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  "Strong Buy": "bg-positive text-onfill",
  Buy: "bg-positive-subtle text-positive",
  Hold: "bg-border-subtle text-ink",
  Sell: "bg-negative-subtle text-negative",
  Avoid: "bg-negative text-onfill",
};

/** The analysis verdict as a pill. Colour follows the verdict's meaning
 * and the text always names it, so it's never colour-alone. */
export function VerdictBadge({ rating, title }: { rating: string | null; title?: string }) {
  if (!rating) return <span className="text-xs text-ink-faint">Not analyzed</span>;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        VERDICT_STYLES[rating] ?? "bg-border-subtle text-ink-muted"
      }`}
      title={title}
    >
      {rating}
    </span>
  );
}

/** Small uppercase label, used for card headings on the dashboard pages.
 * `info` (optional) adds an <InfoTooltip> next to the heading — a
 * plain-language explanation of the section, separate from `hint`, which
 * states this instance's specific parameters (lookback window, threshold, …). */
export function SectionTitle({
  children,
  hint,
  info,
}: {
  children: React.ReactNode;
  hint?: string;
  info?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="inline-flex items-center gap-1.5 font-display text-[15px] font-semibold tracking-tight text-ink">
        {children}
        {info && <InfoTooltip text={info} align="left" />}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** One headline number. `info` (optional) adds an <InfoTooltip> next to
 * the label, explaining the metric in plain language. */
export function StatTile({
  label,
  value,
  hint,
  tone = "text-ink",
  info,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: string;
  info?: string;
}) {
  return (
    <Card>
      <p className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-ink-faint">
        {label}
        {info && <InfoTooltip text={info} />}
      </p>
      <p className={`tabular mt-1.5 font-display text-[1.7rem] font-semibold leading-tight tracking-tight ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}

/** Centered modal dialog with a click-outside/Escape-to-close backdrop,
 * in the same overlay style as the mobile nav drawer (Layout.tsx). Body
 * is only mounted while `open`, so it never runs effects or holds state
 * in the background. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-card"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-md p-1 text-ink-faint hover:bg-border-subtle hover:text-ink"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


/** Sticky "On this page" row for long pages (the holding page is ~8
 * sections tall). Clicking a chip scrolls to that section and opens it if
 * it's a collapsed `CollapsibleSection` with the same id. */
export function SectionJumpBar({ items }: { items: { id: string; label: string }[] }) {
  const jump = (id: string) => {
    window.dispatchEvent(new CustomEvent("section-jump", { detail: id }));
    // Wait a frame so a just-opened section has mounted before scrolling.
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  return (
    <nav
      aria-label="On this page"
      className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1.5 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8 lg:top-[41px]"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => jump(item.id)}
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

/** "Updated 3 h ago" next to a Refresh button — pages now serve a stored
 * snapshot (backend app/services/snapshots.py), so say how old it is. */
export function SnapshotStamp({ at }: { at?: string | null }) {
  if (!at) return null;
  return (
    <span className="text-xs text-ink-faint" title={new Date(at).toLocaleString()}>
      Updated {formatRelative(at)}
    </span>
  );
}
