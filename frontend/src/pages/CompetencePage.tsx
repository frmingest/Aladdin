import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { LEVEL_LABEL, STATUS_CLASS, STATUS_LABEL, circleSegments, weightText } from "../lib/rituals";
import type { Competence, CompetenceLevel, CompetenceSector, CompetenceStatus } from "../lib/types";
import { buildCircleMap, circleView, focusSectorControl, saveMark, sectorDomId } from "../lib/circleMap";
import { useGameMode } from "../lib/gameMode";
import { usePlainView } from "../lib/plainView";
import { Button, Card, Disclosure, EmptyState, PageHeader } from "../components/ui";
import GameFooter from "../components/fortress/GameFooter";
import CircleGlyph from "../components/fortress/kit/CircleGlyph";
import CircleMap from "../components/fortress/kit/CircleMap";
import MarkControl, { BoundaryStone } from "../components/fortress/kit/MarkControl";
import NightPanel from "../components/fortress/kit/NightPanel";

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
  ringMap = false,
  pin = null,
}: {
  sector: CompetenceSector;
  noteMax: number;
  demo: boolean;
  onSaved: (c: Competence) => void;
  /** Game mode with the ring map: the three-state control and the boundary stone replace the select. */
  ringMap?: boolean;
  pin?: number | null;
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
      onSaved(await saveMark(api, sector.sector, level, note));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li id={ringMap ? sectorDomId(sector.sector) : undefined} tabIndex={ringMap ? -1 : undefined} className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {ringMap && pin !== null && (
          <span className="circle-pin !static" aria-hidden>
            {pin}
          </span>
        )}
        <h3 className={`${ringMap ? "" : "w-48 "}text-sm font-semibold text-ink`}>{sector.sector}</h3>
        {ringMap ? (
          <BoundaryStone level={sector.level} markedAt={sector.marked_at} hasNote={!!sector.note} />
        ) : (
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
        )}
        <span className="text-xs text-ink-faint">
          {sector.holdings.length === 0
            ? "nothing held"
            : ringMap
              ? `${weightText(sector.weight_pct)} of the portfolio`
              : `${weightText(sector.weight_pct)} of the portfolio in ${sector.holdings.length}`}
        </span>
        {!ringMap && sector.marked_at && <span className="text-xs text-ink-faint">marked {formatDate(sector.marked_at)}</span>}
      </div>
      {sector.holdings.length > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          {sector.holdings.map((h, i) => (
            <span key={h.holding_id}>
              {i > 0 && ", "}
              <Link to={`/holdings/${h.holding_id}`} className={`text-accent hover:underline${ringMap ? " inline-flex min-h-[44px] items-center" : ""}`}>
                {h.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      {ringMap && (
        <div className="mt-2">
          <MarkControl sector={sector.sector} groupId={`mark-${sector.sector}`} value={level} disabled={demo || busy} onChange={setLevel} />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          aria-label={`${sector.sector}: note`}
          value={note}
          maxLength={noteMax}
          disabled={demo || busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note: why you do or do not know it"
          className={`min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm ${ringMap ? "min-h-[44px] py-2" : "py-1"}`}
        />
        {ringMap ? (
          <button type="button" className="mark-save" disabled={demo || busy || !changed} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        ) : (
          <Button variant="secondary" disabled={demo || busy || !changed} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
    </li>
  );
}

/** Everything the page showed before the ring map: the bar legend, the holdings list, the select per
 * sector. Plain view and normal mode keep showing exactly this, with the same facts. */
export function PlainBody({ data, segments, onSaved }: { data: Competence; segments: ReturnType<typeof circleSegments>; onSaved: (c: Competence) => void }) {
  return (
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
                <SectorRow key={`${s.sector}-${s.level}-${s.note}`} sector={s} noteMax={data.note_max_chars} demo={data.demo} onSaved={onSaved} />
              ))}
            </ul>
          </Card>
          <p className="text-xs text-ink-faint">
            The marks are your own statement and are never inferred. This is information about your portfolio, not advice to trade.
          </p>
    </div>
  );
}

function statusGlyph(status: CompetenceStatus): CompetenceLevel | null | undefined {
  return status === "inside" ? "know" : status === "edge" ? "partly" : status === "outside" ? "outside" : status === "unmarked" ? null : undefined;
}

/** The ring map body (game mode, not Plain view). The map is the picture; the marks list under it is
 * the same facts as rows, and the holdings list and the sectors with nothing held sit behind a
 * disclosure. Neutral palette: statuses are shape plus word, never green, amber or red. */
export function RingBody({ data, onSaved }: { data: Competence; onSaved: (c: Competence) => void }) {
  const model = useMemo(() => buildCircleMap(data), [data]);
  const pins = useMemo(() => new Map(model.markers.map((m) => [m.sector, m.pin])), [model]);

  const focusRow = (sector: string | null) => focusSectorControl(document, sector);

  const row = (s: CompetenceSector) => (
    <SectorRow
      key={`${s.sector}-${s.level}-${s.note}`}
      sector={s}
      noteMax={data.note_max_chars}
      demo={data.demo}
      onSaved={onSaved}
      ringMap
      pin={pins.get(s.sector) ?? null}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="sr-only">Your stock holdings against your marks</h2>
        {data.demo && (
          <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data (marks are read-only)</span>
        )}
        <p className="text-sm text-ink">{data.summary}</p>
      </div>

      <CircleMap data={data} onPress={focusRow} />

      <NightPanel id="circle-marks" tabIndex={-1}>
        <h2 className="section-title">Your marks</h2>
        <ul className="divide-y divide-border-subtle">{model.rows.map(row)}</ul>
        {model.quiet.length > 0 && (
          <Disclosure label={`${model.quiet.length} other sectors, nothing held and unmarked`} level="evidence" className="mt-2 [&>button]:min-h-[44px]">
            <ul className="divide-y divide-border-subtle">{model.quiet.map(row)}</ul>
          </Disclosure>
        )}
      </NightPanel>

      <Disclosure label="the holdings as a list" className="[&>button]:min-h-[44px]">
        {data.towers.length === 0 ? (
          <p className="text-sm text-ink-muted">There are no holdings in the stored portfolio.</p>
        ) : (
          <ul className="divide-y divide-border-subtle text-sm">
            {data.towers.map((t) => {
              const g = statusGlyph(t.status);
              return (
                <li key={t.holding_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link to={`/holdings/${t.holding_id}`} className="inline-flex min-h-[44px] min-w-0 flex-1 items-center text-accent hover:underline">
                    {t.name}
                  </Link>
                  <span className="text-xs text-ink-faint">{t.sector ?? "no sector"}</span>
                  <span className="w-14 text-right text-xs text-ink-muted">{weightText(t.weight_pct)}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                    {g !== undefined && <CircleGlyph level={g} size={16} />}
                    {STATUS_LABEL[t.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Disclosure>

      <GameFooter rules={`Circle rules ${data.rules_version}.`}>
        <p className="mt-1">The marks are your own statement and are never inferred. This is information about your portfolio, not advice to trade.</p>
      </GameFooter>
    </div>
  );
}

/** Ring map in game mode, the old page in Plain view and normal mode; the same facts either way. */
export function CompetenceView({ data, onSaved }: { data: Competence; onSaved: (c: Competence) => void }) {
  const { gameMode } = useGameMode();
  const [plain] = usePlainView();
  return circleView(gameMode, plain) === "ring" ? (
    <RingBody data={data} onSaved={onSaved} />
  ) : (
    <PlainBody data={data} segments={circleSegments(data)} onSaved={onSaved} />
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

  return (
    <div>
      <PageHeader
        title="Circle of Competence"
        subtitle="Mark the sectors you really understand. The page lays your marks over what you own."
        actions={
          <Link to="/fortress" className="inline-flex min-h-[44px] items-center text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <EmptyState>{error}</EmptyState>}
      {!error && !data && <p className="text-sm text-ink-muted">Drawing the circle…</p>}
      {data && <CompetenceView data={data} onSaved={setData} />}
    </div>
  );
}
