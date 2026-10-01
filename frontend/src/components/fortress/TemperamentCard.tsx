import { useState } from "react";
import { Link } from "react-router-dom";
import {
  TEMPERAMENT_BANDS,
  TEMPERAMENT_LABEL,
  TEMPERAMENT_TEXT,
  dialArc,
  dialPoint,
  needlePct,
  temperamentRuleLabel,
} from "../../lib/fortress";
import { formatDate } from "../../lib/format";
import type { FortressTemperamentLevel, GameTemperament } from "../../lib/types";
import { Card } from "../ui";

/** Game mode G6: the temperament meter. Every line comes from a fixed rule over
 * the decision journal and stored snapshots (backend/app/services/game/temperament.py).
 * Informational only: it never blocks, nags about or suggests a trade, and it
 * rewards no trading — only patience, acting on a fired tripwire, and reviewing
 * past decisions restore it. */

const BAND_COLOR: Record<FortressTemperamentLevel, string> = {
  rash: "rgb(var(--c-negative))",
  restless: "rgb(var(--c-caution))",
  steady: "rgb(var(--c-ink-faint))",
  composed: "rgb(var(--c-positive))",
  unsurveyed: "rgb(var(--c-border))",
};

const LEVEL_CLASS: Record<FortressTemperamentLevel, string> = {
  composed: "text-positive",
  steady: "text-ink",
  restless: "text-caution",
  rash: "text-negative",
  unsurveyed: "text-ink-muted",
};

const SHOWN = 6;

function day(iso: string): string {
  // Date-only strings are read as noon so no time zone shifts them a day.
  return formatDate(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

function Dial({ level, needle }: { level: FortressTemperamentLevel; needle: number | null }) {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const tip = needle === null ? null : dialPoint(needle, cx, cy, r - 14);
  return (
    <svg
      viewBox="-16 0 232 118"
      className="h-28 w-48 shrink-0"
      role="img"
      aria-label={
        needle === null
          ? `Temperament: ${TEMPERAMENT_LABEL[level]}`
          : `Temperament: ${TEMPERAMENT_LABEL[level]}, needle at ${needle.toFixed(0)} of 100`
      }
    >
      {TEMPERAMENT_BANDS.map((b) => (
        <path
          key={b.level}
          d={dialArc(b.from + 0.6, b.to - 0.6, cx, cy, r)}
          fill="none"
          stroke={BAND_COLOR[b.level]}
          strokeWidth={14}
          strokeOpacity={needle === null ? 0.25 : b.level === level ? 1 : 0.35}
          strokeDasharray={needle === null ? "4 4" : undefined}
        />
      ))}
      {tip ? (
        <>
          <line
            x1={cx}
            y1={cy}
            x2={tip.x}
            y2={tip.y}
            stroke="rgb(var(--c-ink))"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={6} fill="rgb(var(--c-ink))" />
        </>
      ) : (
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fill="rgb(var(--c-ink-faint))">
          ?
        </text>
      )}
      <text x={cx - r} y={cy + 16} textAnchor="middle" fontSize="10" fill="rgb(var(--c-ink-faint))">
        rash
      </text>
      <text x={cx + r} y={cy + 16} textAnchor="middle" fontSize="10" fill="rgb(var(--c-ink-faint))">
        composed
      </text>
    </svg>
  );
}

export default function TemperamentCard({ temperament }: { temperament: GameTemperament | null | undefined }) {
  const [showAll, setShowAll] = useState(false);
  if (!temperament) return null;
  const t = temperament;
  const needle = needlePct(t.needle_pct);
  const events = showAll ? t.events : t.events.slice(0, SHOWN);
  return (
    <Card>
      <h2 className="section-title">Temperament</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Dial level={t.level} needle={needle} />
        <div className="min-w-0">
          <p className={`text-base font-semibold ${LEVEL_CLASS[t.level]}`}>
            {TEMPERAMENT_LABEL[t.level]}
            {needle !== null && <span className="tabular ml-2 text-sm font-normal text-ink-muted">{needle.toFixed(0)} / 100</span>}
            {t.low_confidence && (
              <span className="ml-2 rounded-full bg-caution-subtle px-2 py-0.5 align-middle text-xs font-semibold text-caution">
                Low confidence
              </span>
            )}
          </p>
          <p className="text-sm text-ink-muted">{TEMPERAMENT_TEXT[t.level]}</p>
          <p className="mt-1 text-xs text-ink-faint">{t.summary}</p>
          {t.restores + t.drains > 0 && (
            <p className="tabular mt-2 text-sm">
              <span className="text-positive">▲ {t.restores} restored</span>
              <span className="mx-2 text-ink-faint">·</span>
              <span className="text-negative">▼ {t.drains} drained</span>
            </p>
          )}
        </div>
      </div>

      {t.events.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-wide text-ink-faint">What moved the needle</h3>
          <ul className="mt-1 divide-y divide-border-subtle">
            {events.map((e, i) => (
              <li key={`${e.rule}-${e.on}-${e.holding_name}-${i}`} className="flex gap-3 py-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 ${e.kind === "restore" ? "text-positive" : "text-negative"}`}
                >
                  {e.kind === "restore" ? "▲" : "▼"}
                </span>
                <div className="min-w-0">
                  <p className="text-ink">
                    <span className="sr-only">{e.kind === "restore" ? "Restored: " : "Drained: "}</span>
                    <span className="font-medium">{temperamentRuleLabel(e.rule)}</span>
                    <span className="text-ink-muted"> · {e.holding_name}</span>
                  </p>
                  <p className="text-ink-muted">{e.explanation}</p>
                  <p className="text-xs text-ink-faint">
                    {day(e.on)} · from {e.source === "journal" ? "your journal" : "portfolio snapshots"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {t.events.length > SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 text-sm text-accent hover:underline"
            >
              {showAll ? "Show fewer" : `Show all ${t.events.length}`}
            </button>
          )}
        </div>
      )}

      {t.turnover.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-wide text-ink-faint">Remodelling between the last two snapshots</h3>
          <ul className="mt-1 space-y-1 text-sm text-ink-muted">
            {t.turnover.map((o) => (
              <li key={`${o.account_name}-${o.to_at}`}>
                <span className="text-ink">{o.account_name}</span> ({day(o.from_at)} to {day(o.to_at)}):{" "}
                {o.added} added, {o.removed} removed, {o.resized} resized
                {o.turnover_pct !== null && <> · about {Number(o.turnover_pct).toFixed(0)}% of positions changed</>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-faint">Counts only: there is no fee data to price this in kroner.</p>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        Only what you log in the{" "}
        <Link to="/journal" className="text-accent hover:underline">
          decision journal
        </Link>{" "}
        and what stored snapshots show is read; it cannot see feelings. Informational only — nothing here blocks or
        suggests a trade, and trading never earns points.
      </p>
    </Card>
  );
}
