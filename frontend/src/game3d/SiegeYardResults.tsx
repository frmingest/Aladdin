import { Link } from "react-router-dom";
import type { YardView } from "./siegeYard";
import type { YardState } from "./useSiegeYard";
import {
  YARD_BETA,
  YARD_BOOK,
  YARD_COVERAGE,
  YARD_EMPTY,
  YARD_FAILED,
  YARD_FLAT,
  YARD_GAP,
  YARD_LOSS,
  YARD_READING,
  YARD_REFRESHING,
  YARD_ROUGH,
  YARD_TITLE,
  YARD_UNKNOWN,
  yardFogTitle,
  yardMoreLine,
} from "./siegeYardWordsV1";

/** The results block of the Storm Drill panel: what the chosen fall does to each tower. Read-only. */
export function YardResults({ state }: { state: YardState }) {
  return (
    <section aria-label={YARD_TITLE} className="mt-3 border-t border-white/10 pt-2" aria-live="polite">
      <h3 className="g3d-label">{YARD_TITLE}</h3>
      {state.status === "reading" && <p className="g3d-muted mt-1">{YARD_READING}</p>}
      {state.status === "failed" && <p className="g3d-demo mt-1" role="status">{YARD_FAILED}</p>}
      {state.status === "ready" && <YardBody view={state.view} refreshing={state.refreshing} />}
      <p className="g3d-muted mt-2">
        <Link to="/fortress/siege" className="underline">{YARD_FLAT}</Link>
      </p>
    </section>
  );
}

function YardBody({ view, refreshing }: { view: YardView; refreshing: boolean }) {
  if (view.towers === 0) return <p className="g3d-muted mt-1">{YARD_EMPTY}</p>;
  return (
    <div className={refreshing ? "opacity-60" : undefined}>
      {refreshing && <p className="g3d-muted mt-1">{YARD_REFRESHING}</p>}
      <p className="mt-1">
        <strong>{view.level}.</strong> {view.headline}
      </p>
      {view.book && (
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div><dt className="g3d-muted">{YARD_BOOK}</dt><dd>{view.book.shock}</dd></div>
          <div><dt className="g3d-muted">{YARD_LOSS}</dt><dd>{view.book.loss}</dd></div>
          <div><dt className="g3d-muted">{YARD_BETA}</dt><dd>{view.book.beta}</dd></div>
          <div><dt className="g3d-muted">{YARD_COVERAGE}</dt><dd>{view.book.coverage}</dd></div>
        </dl>
      )}
      <ul className="mt-2 space-y-1.5">
        {view.rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-2">
              <Link to={`/holdings/${r.id}`} className="min-w-0 truncate underline">{r.name}</Link>
              <span className="shrink-0 tabular-nums">{r.shock} · {r.loss}</span>
            </div>
            {/* A wall that fills with loss: the number and the word beside it carry the meaning, never the colour. */}
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15" aria-hidden>
              <div className="h-full rounded-full bg-[#d9a83a]" style={{ width: `${r.bar}%` }} />
            </div>
            <p className="g3d-muted text-xs">
              {r.status}
              {r.rough ? ` · ${YARD_ROUGH}` : ""}
              {r.gap ? ` · ${YARD_GAP}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {view.more > 0 && <p className="g3d-muted mt-1">{yardMoreLine(view.more)}</p>}
      {view.fog.length > 0 && (
        <div className="mt-2">
          <p className="font-medium">{yardFogTitle(view.fog.length)}</p>
          <ul className="g3d-muted mt-1 space-y-0.5 text-xs">
            {view.fog.map((f) => (
              <li key={f.id}>
                {YARD_UNKNOWN} <Link to={`/holdings/${f.id}`} className="underline">{f.name}</Link>: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.book && <p className="g3d-muted mt-2 text-xs">{view.book.coverageLine}</p>}
    </div>
  );
}
