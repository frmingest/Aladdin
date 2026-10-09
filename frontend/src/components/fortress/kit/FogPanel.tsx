/** Where the game says "we cannot see this" (page-scene kit): a dashed, misted panel with a "?" per
 * line. Unknown is the game's most important state, so it is never collapsed and never drawn smaller
 * or fainter than a known fact. Pure CSS hatch (no SVG filter). */
export default function FogPanel({
  title,
  lines,
  className = "",
}: {
  title: string;
  lines: string[];
  className?: string;
}) {
  if (lines.length === 0) return null;
  return (
    <section className={`fog-panel rounded-xl border-2 border-dashed border-border p-4 ${className}`} aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <ul className="space-y-1.5 text-sm text-ink-muted">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-faint text-xs font-bold text-ink-faint">
              ?
            </span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
