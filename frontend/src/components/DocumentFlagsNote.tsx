import type { DocumentSummary } from "../lib/types";

/**
 * One-line note under an uploaded filing when extraction skipped or
 * questioned figures — so a number that wasn't imported is visible, never
 * silently dropped. The full lines are in the tooltip.
 */
const MESSAGES: { key: string; text: (n: number) => string; tone: "warn" | "info" }[] = [
  {
    key: "fact_conflicts",
    text: (n) => `${n} figure${n === 1 ? "" : "s"} not imported: two lines disagree`,
    tone: "warn",
  },
  {
    key: "facts_differ_from_existing",
    text: (n) => `${n} figure${n === 1 ? "" : "s"} differ from an earlier source (earlier kept)`,
    tone: "warn",
  },
];

function lines(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function DocumentFlagsNote({ document }: { document: DocumentSummary }) {
  const flags = document.quality_flags ?? {};
  const notes: { text: string; tone: "warn" | "info"; detail: string[] }[] = [];

  for (const m of MESSAGES) {
    const detail = lines(flags[m.key]);
    if (detail.length > 0) notes.push({ text: m.text(detail.length), tone: m.tone, detail });
  }
  if (flags.scale_not_stated === true) {
    notes.push({
      text: "No unit line (e.g. “NOK million”) found — figures imported as printed",
      tone: "warn",
      detail: [],
    });
  }
  const ixbrl = flags.ixbrl as { tagged_numbers?: number; fiscal_years?: string[] } | undefined;
  if (ixbrl && typeof ixbrl === "object") {
    notes.push({
      text: `Inline XBRL: ${ixbrl.tagged_numbers ?? 0} tagged numbers, years ${(ixbrl.fiscal_years ?? []).join(", ") || "—"}`,
      tone: "info",
      detail: [],
    });
  }
  if (flags.no_ixbrl_tags === true) {
    notes.push({ text: "No XBRL tags found — text only, no figures", tone: "info", detail: [] });
  }
  if (notes.length === 0) return null;

  return (
    <div className="mt-0.5 flex flex-col gap-0.5">
      {notes.map((n) => (
        <span
          key={n.text}
          title={n.detail.join("\n") || undefined}
          className={`text-xs ${n.tone === "warn" ? "text-caution" : "text-ink-muted"}`}
        >
          {n.text}
        </span>
      ))}
    </div>
  );
}
