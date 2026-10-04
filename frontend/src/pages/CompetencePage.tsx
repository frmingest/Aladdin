import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { LEVEL_LABEL, STATUS_CLASS, STATUS_LABEL, circleSegments, weightText } from "../lib/rituals";
import type { Competence, CompetenceLevel, CompetenceSector } from "../lib/types";
import { Button, Card, EmptyState, PageHeader } from "../components/ui";

/** The Circle of Competence (game mode G19, after Munger): you mark how well you know each sector and
 * the page lays your marks over the holdings. The app never infers a mark: no mark is "unmarked", which
 * is not the same as inside, and a holding with no sector set is "no sector set". Funds and gold are not
 * judged. The marks are the only write of this sprint and they are yours; it is information, not advice. */

const SEGMENT_FILL: Record<string, string> = {
  inside: "bg-positive",
  edge: "bg-caution",
  outside: "bg-negative",
  unmarked: "bg-ink-faint",
  unclassified: "bg-border",
};

function SectorRow({
  sector,
  noteMax,
  demo,
  onSaved,
}: {
  sector: CompetenceSector;
  noteMax: number;
  demo: boolean;
  onSaved: (c: Competence) => void;
}) {
  const [level, setLevel] = useState<CompetenceLevel | "">(sector.level ?? "");
  const [note, setNote] = useState(sector.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = level !== (sector.level ?? "") || note.trim() !== (sector.note ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(level === "" ? await api.deleteCompetence(sector.sector) : await api.putCompetence(sector.sector, level, note.trim() || null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="w-48 text-sm font-semibold text-ink">{sector.sector}</h3>
        <select
          aria-label={`${sector.sector}: how well you know it`}
          value={level}
          disabled={demo || busy}
          onChange={(e) => setLevel(e.target.value as CompetenceLevel | "")}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="">Unmarked</option>
          {(Object.keys(LEVEL_LABEL) as CompetenceLevel[]).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">
          {sector.holdings.length === 0
            ? "nothing held"
            : `${weightText(sector.weight_pct)} of the portfolio in ${sector.holdings.length}`}
        </span>
        {sector.marked_at && <span className="text-xs text-ink-faint">marked {formatDate(sector.marked_at)}</span>}
      </div>
      {sector.holdings.length > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          {sector.holdings.map((h, i) => (
            <span key={h.holding_id}>
              {i > 0 && ", "}
              <Link to={`/holdings/${h.holding_id}`} className="text-accent hover:underline">
                {h.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          aria-label={`${sector.sector}: note`}
          value={note}
          maxLength={noteMax}
          disabled={demo || busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note: why you do or do not know it"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm"
        />
        <Button variant="secondary" disabled={demo || busy || !changed} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
    </li>
  );
}

export default function CompetencePage() {
  const [data, setData] = useState<Competence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getCompetence()
      .then((c) => live && setData(c))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Could not load the circle."));
    return () => {
      live = false;
    };
  }, []);

  const segments = data ? circleSegments(data) : [];
  return (
    <div>
      <PageHeader
        title="Circle of Competence"
        subtitle="Mark the sectors you really understand. The page lays your marks over what you own."
        actions={
          <Link to="/fortress" className="text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <EmptyState>{error}</EmptyState>}
      {!error && !data && <p className="text-sm text-ink-muted">Drawing the circle…</p>}
      {data && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title mb-0">Your stock holdings against your marks</h2>
              {data.demo && (
                <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">
                  Demo data (marks are read-only)
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink">{data.summary}</p>
            {segments.length > 0 && (
              <>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-raised" role="img" aria-label={data.summary}>
                  {segments.map((s) => (
                    <div key={s.key} className={SEGMENT_FILL[s.key]} style={{ width: `${s.pct}%` }} title={`${STATUS_LABEL[s.key]} ${s.pct.toFixed(1)}%`} />
                  ))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  {segments.map((s) => (
                    <li key={s.key} className="flex items-center gap-1">
                      <span className={`inline-block h-2 w-2 rounded-full ${SEGMENT_FILL[s.key]}`} aria-hidden />
                      {STATUS_LABEL[s.key]} {s.pct.toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <h2 className="section-title">Holdings</h2>
            {data.towers.length === 0 ? (
              <p className="text-sm text-ink-muted">There are no holdings in the stored portfolio.</p>
            ) : (
              <ul className="divide-y divide-border-subtle text-sm">
                {data.towers.map((t) => (
                  <li key={t.holding_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Link to={`/holdings/${t.holding_id}`} className="min-w-0 flex-1 text-accent hover:underline">
                      {t.name}
                    </Link>
                    <span className="text-xs text-ink-faint">{t.sector ?? "no sector"}</span>
                    <span className="w-14 text-right text-xs text-ink-muted">{weightText(t.weight_pct)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="section-title">Your marks</h2>
            <ul className="divide-y divide-border-subtle">
              {data.sectors.map((s) => (
                <SectorRow key={`${s.sector}-${s.level}-${s.note}`} sector={s} noteMax={data.note_max_chars} demo={data.demo} onSaved={setData} />
              ))}
            </ul>
          </Card>
          <p className="text-xs text-ink-faint">
            The marks are your own statement and are never inferred. This is information about your portfolio, not advice to trade.
          </p>
        </div>
      )}
    </div>
  );
}
