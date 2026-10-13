import { Link } from "react-router-dom";
import { VerdictBadge } from "../ui";
import type { FortressLayout, PlacedTower } from "../../lib/fortress";
import {
  plainAttentionWord,
  plainBarPct,
  plainFacts,
  plainHeading,
  plainRows,
  plainSharedWall,
} from "../../lib/plainFortress";
import { REALM_LEVEL_LABEL } from "../../lib/realmVerdict";
import type { RealmLevel } from "../../lib/realmVerdict";
import { formatNok } from "../../lib/format";

/** D1 Plain lens: the Fortress as labelled blocks in the scene's arrangement. No art, no motion,
 * no canvas; every fact is a word and a number, so it is also the print form and the light
 * fallback. Selecting a block opens the same survey beneath it as the painted scene does. */
export default function PlainFortress({
  layout,
  totalValueNok,
  realmLevel,
  realmSelected,
  onRealmSelect,
  selectedId,
  onSelect,
}: {
  layout: FortressLayout;
  totalValueNok: string | null;
  realmLevel: RealmLevel;
  realmSelected: boolean;
  onRealmSelect: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = plainRows(layout);
  const keep = (
    <KeepBlock
      count={layout.items.length}
      totalValueNok={totalValueNok}
      level={realmLevel}
      selected={realmSelected}
      onSelect={onRealmSelect}
    />
  );
  return (
    <section aria-label="The fortress as plain blocks" className="space-y-3">
      {rows.map((r) => {
        const before = r.keepAfter === null ? r.items : r.items.slice(0, r.keepAfter);
        const after = r.keepAfter === null ? [] : r.items.slice(r.keepAfter);
        return (
          <ul
            key={r.row}
            aria-label={r.row === 0 ? "Great Keep and the largest holdings" : `Terrace ${r.row}`}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-3"
          >
            {before.map((i) => (
              <TowerBlock key={i.tower.holding_id} item={i} selected={selectedId === i.tower.holding_id} onSelect={onSelect} />
            ))}
            {r.keepAfter !== null && <li className="contents">{keep}</li>}
            {after.map((i) => (
              <TowerBlock key={i.tower.holding_id} item={i} selected={selectedId === i.tower.holding_id} onSelect={onSelect} />
            ))}
          </ul>
        );
      })}
    </section>
  );
}

function KeepBlock({
  count,
  totalValueNok,
  level,
  selected,
  onSelect,
}: {
  count: number;
  totalValueNok: string | null;
  level: RealmLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-md border-2 bg-raised p-3 text-sm print:break-inside-avoid ${
        selected ? "border-accent" : "border-border"
      }`}
    >
      <h3 className="text-base font-semibold text-ink">Great Keep</h3>
      <p className="text-xs text-ink-faint">The whole portfolio</p>
      <p className="tabular mt-2 text-ink">
        {count} {count === 1 ? "holding" : "holdings"} · {formatNok(totalValueNok)}
      </p>
      <p className="mt-1 text-ink-muted">{REALM_LEVEL_LABEL[level]}</p>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="mt-2 rounded border border-border px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink print:hidden"
      >
        {selected ? "Selected: verdict below" : "Show the verdict on the whole fortress"}
      </button>
    </div>
  );
}

function TowerBlock({
  item,
  selected,
  onSelect,
}: {
  item: PlacedTower;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = item.tower;
  const head = plainHeading(t);
  const bar = plainBarPct(t);
  const attention = plainAttentionWord(t);
  const shared = plainSharedWall(t);
  return (
    <li
      className={`rounded-md border-2 bg-surface p-3 text-sm print:break-inside-avoid ${
        selected ? "border-accent" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink" title={head.title}>
            {head.title}
          </h3>
          <p className="text-xs text-ink-faint">{head.sub}</p>
        </div>
        <VerdictBadge rating={t.verdict_rating} />
      </div>
      <p className="tabular mt-2 text-ink">
        {head.weight} <span className="text-ink-faint">· {head.value}</span>
      </p>
      {bar !== null && (
        <div aria-hidden className="mt-1 h-1.5 w-full rounded bg-border-subtle print:border print:border-border">
          <div className="h-full rounded bg-ink-muted" style={{ width: `${bar}%` }} />
        </div>
      )}
      {attention && <p className="mt-2 text-xs font-semibold text-ink">{attention}</p>}
      <dl className="mt-2 space-y-1">
        {plainFacts(t).map((f) => (
          <div key={f.label} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">{f.label}</dt>
            <dd className="text-ink-muted">
              {f.value}
              {f.note && <span className="block text-xs text-ink-faint">{f.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {shared && <p className="mt-1 text-xs text-ink-faint">{shared}</p>}
      <div className="mt-2 flex items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => onSelect(t.holding_id)}
          aria-pressed={selected}
          className="rounded border border-border px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
        >
          {selected ? "Selected: survey below" : "Open the survey"}
        </button>
        <Link to={`/holdings/${t.holding_id}`} className="text-xs text-accent underline underline-offset-2">
          Holding page
        </Link>
      </div>
    </li>
  );
}
