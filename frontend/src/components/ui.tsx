import { useState } from "react";

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
    <div className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions}
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
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 text-left text-sm font-semibold uppercase tracking-wide text-ink-muted hover:text-ink"
      >
        <span
          aria-hidden
          className={`inline-block text-xs transition-transform ${open ? "rotate-90" : ""}`}
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
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "border border-border bg-surface text-ink hover:bg-border-subtle",
    danger: "bg-negative text-white hover:bg-negative/90",
  } as const;
  return (
    <button className={`${base} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  "Strong Buy": "bg-positive text-white",
  Buy: "bg-positive-subtle text-positive",
  Hold: "bg-border-subtle text-ink",
  Sell: "bg-negative-subtle text-negative",
  Avoid: "bg-negative text-white",
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

/** Small uppercase label, used for card headings on the dashboard pages. */
export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-ink">{children}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** One headline number. */
export function StatTile({
  label,
  value,
  hint,
  tone = "text-ink",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: string;
}) {
  return (
    <Card>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}
