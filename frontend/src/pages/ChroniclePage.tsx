import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  SOURCE_LABEL,
  SOURCE_NOTE,
  WALL_FILL,
  changesOn,
  clampIndex,
  describeFrame,
  frameTitle,
  headline,
  miniLayout,
  newestIndex,
  nextPlayIndex,
  recordLimits,
} from "../lib/chronicle";
import { formatNok, formatPct100 } from "../lib/format";
import { MOAT_LABEL, SIEGE_LABEL, STRUCTURE_LABEL, THESIS_LABEL, WALL_LABEL, isFundCode, shortLabel } from "../lib/fortress";
import type { Chronicle, ChronicleFrame, FortressSiegeLevel } from "../lib/types";
import { Button, Card, Disclosure, EmptyState, PageHeader } from "../components/ui";
import GameFooter from "../components/fortress/GameFooter";

/** The Chronicle (game mode G14): the fortress replayed through time. Frames stored nightly by the
 * worker carry the real walls, moats and weather of their day; older days are rebuilt from
 * portfolio imports with the walls left unsurveyed (they were never stored and cannot be rebuilt).
 * Read-only: a replay of stored data. It scores nothing, predicts nothing and rewards nothing. */

const SKY: Record<FortressSiegeLevel, [string, string]> = {
  calm: ["#2b3a5e", "#c98a52"],
  gathering: ["#3a3f4c", "#8a7a6a"],
  besieged: ["#3a1f1f", "#a8442f"],
  unsurveyed: ["#2a303a", "#59606c"],
};

function MiniScene({ frame }: { frame: ChronicleFrame }) {
  const placed = useMemo(() => miniLayout(frame, 760), [frame]);
  const [top, bottom] = SKY[frame.source === "stored" ? frame.weather : "unsurveyed"];
  const ground = 168;
  return (
    <svg
      viewBox="0 0 800 210"
      className="block h-auto w-full rounded-md"
      role="img"
      aria-label={describeFrame(frame)}
    >
      <defs>
        <linearGradient id="chron-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="800" height="210" fill="url(#chron-sky)" />
      <rect y={ground} width="800" height="42" fill="#2a2418" />
      <g transform="translate(20 0)">
        {placed.map(({ tower, x, w, h, ghost }) => {
          const y = ground - h;
          const breached = tower.thesis === "breached";
          const fill = ghost ? "none" : WALL_FILL[tower.wall];
          const stroke = ghost ? "#a8977a" : "#14110b";
          return (
            <g key={tower.holding_id}>
              <title>{`${tower.name}: ${tower.weight_pct === null ? "weight unknown" : formatPct100(tower.weight_pct)} of the realm`}</title>
              {tower.structure === "bullion" ? (
                <rect x={x} y={ground - h * 0.55} width={w} height={h * 0.55} fill={ghost ? "none" : "#c9a24a"} stroke={stroke} strokeWidth={ghost ? 1.5 : 1} strokeDasharray={ghost ? "4 3" : undefined} />
              ) : (
                <>
                  <rect x={x} y={y} width={w} height={h} rx={tower.structure === "outpost" ? w / 3 : 2} fill={fill} stroke={stroke} strokeWidth={ghost ? 1.5 : 1} strokeDasharray={ghost ? "4 3" : undefined} />
                  <path d={`M${x - 3} ${y} L${x + w / 2} ${y - Math.max(10, w * 0.5)} L${x + w + 3} ${y} Z`} fill={ghost ? "none" : "#3b3f4a"} stroke={stroke} strokeWidth={ghost ? 1.5 : 1} strokeDasharray={ghost ? "4 3" : undefined} />
                </>
              )}
              {ghost && (
                <text x={x + w / 2} y={ground - h / 2} textAnchor="middle" fontSize="14" fill="#cdbb97">
                  ?
                </text>
              )}
              {breached && (
                <g>
                  <circle cx={x + w / 2} cy={y - 4} r={8} fill="#c8473c" />
                  <text x={x + w / 2} y={y - 0.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
                    !
                  </text>
                </g>
              )}
              <text x={x + w / 2} y={ground + 14} textAnchor="middle" fontSize="8.5" fill="#cdbb97">
                {shortLabel(tower.name, tower.ticker, 7)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function ChroniclePage() {
  const [chronicle, setChronicle] = useState<Chronicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    document.title = "Chronicle · Aladdin";
    let live = true;
    api
      .getChronicle()
      .then((c) => {
        if (!live) return;
        setChronicle(c);
        setIndex(newestIndex(c));
      })
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Could not load the Chronicle."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  // Playing steps one frame per second and stops at the newest frame.
  useEffect(() => {
    if (!playing || !chronicle) return;
    timer.current = window.setInterval(() => {
      setIndex((cur) => {
        const step = nextPlayIndex(cur, chronicle.frames.length);
        if (step.done) setPlaying(false);
        return step.index;
      });
    }, 1000);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [playing, chronicle]);

  const frames = chronicle?.frames ?? [];
  const i = clampIndex(index, frames.length);
  const frame = i >= 0 ? frames[i] : null;
  const changes = chronicle && frame ? changesOn(chronicle, frame.day) : [];

  const play = () => {
    if (!chronicle || frames.length < 2) return;
    // Start from the beginning when parked on the newest frame.
    if (i >= frames.length - 1) setIndex(0);
    setPlaying(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="The Chronicle"
        subtitle="The fortress through time. Each frame is what was stored that day; older days are rebuilt from your imports, with the walls left unsurveyed because they were never saved."
        actions={
          <>
            {chronicle?.demo && (
              <span className="rounded-full bg-caution-subtle px-2.5 py-1 text-xs font-semibold text-caution">Demo data</span>
            )}
            <Link to="/fortress" className="text-sm text-accent hover:underline">
              Back to the Fortress
            </Link>
          </>
        }
      />

      {error && <Card className="mb-4 border-negative/40 bg-negative-subtle text-sm text-negative">{error}</Card>}
      {loading && <EmptyState>Opening the chronicle…</EmptyState>}

      {chronicle && !frame && !loading && (
        <EmptyState>
          {chronicle.notes[0] ?? "Nothing to replay yet."}
        </EmptyState>
      )}

      {chronicle && frame && (
        <div className="space-y-4">
          <Card>
            <p className="mb-3 text-sm text-ink-muted">{headline(chronicle)}</p>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => { setPlaying(false); setIndex(Math.max(0, i - 1)); }} disabled={i <= 0}>
                ◀ Earlier
              </Button>
              <Button variant="secondary" onClick={() => (playing ? setPlaying(false) : play())} disabled={frames.length < 2}>
                {playing ? "Pause" : "Play"}
              </Button>
              <Button variant="secondary" onClick={() => { setPlaying(false); setIndex(Math.min(frames.length - 1, i + 1)); }} disabled={i >= frames.length - 1}>
                Later ▶
              </Button>
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs text-ink-faint">
                <span className="sr-only">Frame</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  value={i}
                  onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
                  className="w-full accent-[var(--color-accent,#d9a93e)]"
                  aria-valuetext={describeFrame(frame)}
                />
              </label>
            </div>

            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold text-ink">{frameTitle(frame)}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${frame.source === "stored" ? "bg-positive-subtle text-positive" : "bg-raised text-ink-muted"}`}>
                {SOURCE_LABEL[frame.source]}
              </span>
              <span className="text-xs text-ink-faint">
                {frame.source === "stored" ? `Weather: ${SIEGE_LABEL[frame.weather]}` : "Weather not recorded"}
                {frame.total_value_nok !== null && ` · ${formatNok(frame.total_value_nok)}`}
              </span>
            </div>
            <MiniScene frame={frame} />
            <p className="mt-2 text-xs text-ink-faint">{SOURCE_NOTE[frame.source]}</p>
          </Card>

          <Card>
            <h2 className="section-title">What changed on this day</h2>
            {changes.length === 0 ? (
              <p className="text-sm text-ink-muted">
                {i === 0 ? "This is the first frame: there is nothing earlier to compare with." : "Nothing changed between this frame and the one before it."}
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                {changes.map((c, n) => (
                  <li key={`${c.kind}-${n}`}>
                    {c.holding_id && c.holding_name ? (
                      <>
                        <Link to={`/holdings/${c.holding_id}`} className="text-accent hover:underline">
                          {c.holding_name}
                        </Link>
                        {c.text.startsWith(c.holding_name) ? c.text.slice(c.holding_name.length) : `: ${c.text}`}
                      </>
                    ) : (
                      c.text
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Disclosure label={`the ${frame.towers.length} towers in this frame`}>
          <Card className="overflow-x-auto">
            <h2 className="section-title">Towers in this frame</h2>
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="py-1 pr-3 font-medium">Holding</th>
                  <th className="py-1 pr-3 font-medium">Share</th>
                  <th className="py-1 pr-3 font-medium">Walls</th>
                  <th className="py-1 pr-3 font-medium">Moat</th>
                  <th className="py-1 font-medium">Thesis</th>
                </tr>
              </thead>
              <tbody>
                {[...frame.towers]
                  .sort((a, b) => Number(b.weight_pct ?? -1) - Number(a.weight_pct ?? -1))
                  .map((t) => (
                    <tr key={t.holding_id} className="border-t border-border-subtle">
                      <td className="py-1.5 pr-3">
                        <Link to={`/holdings/${t.holding_id}`} className="text-ink hover:underline">
                          {t.name}
                        </Link>
                        <span className="block text-xs text-ink-faint">
                          {isFundCode(t.ticker) ? "Fund" : t.ticker} · {STRUCTURE_LABEL[t.structure]}
                        </span>
                      </td>
                      <td className="tabular py-1.5 pr-3">{t.weight_pct === null ? "—" : formatPct100(t.weight_pct)}</td>
                      <td className="py-1.5 pr-3 text-ink-muted">{WALL_LABEL[t.wall]}</td>
                      <td className="py-1.5 pr-3 text-ink-muted">{MOAT_LABEL[t.moat]}</td>
                      <td className="py-1.5 text-ink-muted">{frame.source === "stored" ? THESIS_LABEL[t.thesis] : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
          </Disclosure>

          {chronicle.changes.length > 0 && (
            <Card>
              <details>
                <summary className="section-title cursor-pointer select-none">Every change, newest first</summary>
                <ul className="mt-2 divide-y divide-border-subtle text-sm">
                  {[...chronicle.changes].reverse().map((c, n) => (
                    <li key={`${c.day}-${c.kind}-${n}`} className="flex gap-3 py-1.5">
                      <span className="tabular w-24 shrink-0 text-xs text-ink-faint">{c.day}</span>
                      <span className="text-ink-muted">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          )}

          {recordLimits(chronicle).length > 0 && (
            <Card className="bg-raised">
              <h2 className="section-title">What the record cannot show</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {recordLimits(chronicle).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Card>
          )}

          <GameFooter rules={`Rules version ${chronicle.rules_version}. A replay of stored data: it predicts nothing and scores nothing.`} />
        </div>
      )}
    </div>
  );
}
