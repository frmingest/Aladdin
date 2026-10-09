import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "../../../lib/format";
import { capsuleLabel, capsuleState } from "../../../lib/capsules";
import { HALL_COPY, SEAL_LOOK, defaultOpenId, tomeAria, tomeFor, type Tome } from "../../../lib/hall";
import type { CapsuleState } from "../../../lib/capsules";
import { actionLabel, daysText, filterRecords, priceLine, verdictLine } from "../../../lib/rituals";
import type { DecisionRecord, Records } from "../../../lib/types";
import { EmptyState } from "../../ui";
import TorchPair from "./TorchPair";
import "./hall.css";

/** The Hall of Records (game mode, Records page hero). A stone archive: every decision is a tome in
 * its own arched niche, with a wax seal per review (intact, split, or an empty ring) and a bookmark
 * ribbon when a review is owed. Pressing a tome opens it at the reading desk, which holds the same facts
 * the old cards held. The painting is static and aria-hidden; the tomes are real buttons and the desk is
 * the text. No tome is drawn better or worse for its outcome: hindsight, not a score. */

const WAX = { sealed: "#7a1f18", unsealed: "#7a1f18", opened: "none" } as const;

/** One wax seal. Shape carries the state: whole disc, disc split by a crack, empty ring. */
export function SealGlyph({ state, months, cx, cy, r }: { state: CapsuleState; months: 6 | 12; cx: number; cy: number; r: number }) {
  const shape = SEAL_LOOK[state].shape;
  const ink = "#f6dfa6";
  return (
    <g>
      {shape === "intact" && <circle cx={cx} cy={cy} r={r} fill={WAX[state]} stroke="#d9a93e" strokeWidth="1.2" />}
      {shape === "cracked" && (
        <>
          <path d={`M${cx - r} ${cy} a${r} ${r} 0 0 1 ${2 * r} 0 L${cx + r - 1.5} ${cy - 1.5} L${cx - r - 1.5} ${cy - 1.5} Z`} fill={WAX[state]} stroke="#d9a93e" strokeWidth="1.2" transform={`translate(0 -1.6)`} />
          <path d={`M${cx - r} ${cy} a${r} ${r} 0 0 0 ${2 * r} 0 Z`} fill={WAX[state]} stroke="#d9a93e" strokeWidth="1.2" transform={`translate(0 1.6)`} />
        </>
      )}
      {shape === "open" && <circle cx={cx} cy={cy} r={r} fill="#1a120b" stroke="#d9a93e" strokeWidth="1.6" strokeDasharray="0" />}
      <text x={cx} y={cy + r * 0.38} textAnchor="middle" fontSize={months === 6 ? r * 1.15 : r * 0.95} fontWeight="700" fontFamily="Georgia, serif" fill={ink}>
        {months}
      </text>
    </g>
  );
}

function TomePicture({ t, id }: { t: Tome; id: string }) {
  return (
    <svg viewBox="0 0 96 124" width="96" height="124" aria-hidden focusable="false" className="hall-tome-art">
      <defs>
        <linearGradient id={`hl-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="0.18" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {t.owed && (
        <path d="M62 2 H72 V20 L67 15 L62 20 Z" fill="#b8892f" stroke="#2a1a06" strokeWidth="1" transform="translate(0 -1)" />
      )}
      <rect x="8" y="10" width="80" height="106" rx="4" fill={t.leather} stroke="#120c07" strokeWidth="1.5" />
      <rect x="8" y="10" width="80" height="106" rx="4" fill={`url(#hl-${id})`} />
      <rect x="8" y="10" width="15" height="106" rx="3" fill="#000" fillOpacity="0.28" />
      {[24, 54, 84, 106].map((y) => (
        <path key={y} d={`M8 ${y} H23`} stroke="#d9a93e" strokeWidth="1.4" strokeOpacity="0.85" />
      ))}
      <rect x="29" y="16" width="53" height="94" rx="2" fill="none" stroke="#d9a93e" strokeOpacity="0.7" strokeWidth="1" />
      <circle cx="55.5" cy="46" r="15" fill="#120c07" fillOpacity="0.55" stroke="#d9a93e" strokeWidth="1.3" />
      <text x="55.5" y="53" textAnchor="middle" fontSize="20" fontWeight="700" fontFamily="Georgia, serif" fill="#f6dfa6">
        {t.letter}
      </text>
      <path d="M36 70 H75" stroke="#d9a93e" strokeOpacity="0.6" strokeWidth="1" />
      <SealGlyph state={t.review6} months={6} cx={43} cy={92} r={9.5} />
      <SealGlyph state={t.review12} months={12} cx={69} cy={92} r={9.5} />
    </svg>
  );
}

function Review({ months, state, text }: { months: 6 | 12; state: DecisionRecord["review_6m"]; text: string | null }) {
  const c = capsuleState(state);
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden focusable="false" className="shrink-0">
          <SealGlyph state={c} months={months} cx={14} cy={14} r={11} />
        </svg>
        <span>{capsuleLabel(months, state)}</span>
      </p>
      {text && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{text}</p>}
    </div>
  );
}

function Desk({ r }: { r: DecisionRecord }) {
  return (
    <div className="hall-desk" id="hall-desk" aria-live="polite">
      <div className="hall-book">
        <div className="hall-page">
          <h3 className="font-display text-lg text-ink">
            {actionLabel(r.action)}{" "}
            {r.holding_id ? (
              <Link to={`/holdings/${r.holding_id}`} className="text-accent hover:underline">
                {r.company_name}
              </Link>
            ) : (
              r.company_name
            )}
          </h3>
          <p className="text-xs text-ink-muted">
            {formatDate(r.decided_on)} · {daysText(r.days_since)}
            {r.confidence !== null && ` · confidence ${r.confidence} of 5`}
          </p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">What you wrote then</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{r.thesis}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">What would prove it wrong</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{r.invalidation ?? <span className="text-ink-muted">Nothing was written.</span>}</dd>
            </div>
          </dl>
        </div>
        <div className="hall-spine" aria-hidden />
        <div className="hall-page">
          <p className="text-sm text-ink-muted">{priceLine(r)}</p>
          <p className="text-sm text-ink-muted">{verdictLine(r)}</p>
          <div className="mt-4 space-y-3 border-t border-border-subtle pt-3">
            <Review months={6} state={r.review_6m} text={r.review_6m_text} />
            <Review months={12} state={r.review_12m} text={r.review_12m_text} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HallOfRecords({ records }: { records: Records }) {
  const uid = useId().replace(/:/g, "");
  const [onlyOwed, setOnlyOwed] = useState(false);
  const shown = useMemo(() => filterRecords(records.records, onlyOwed), [records.records, onlyOwed]);
  const [openId, setOpenId] = useState<string | null>(() => defaultOpenId(records.records));
  const deskRef = useRef<HTMLDivElement | null>(null);
  const open = shown.find((r) => r.id === openId) ?? shown[0] ?? null;
  useEffect(() => {
    if (shown.length > 0 && !shown.some((r) => r.id === openId)) setOpenId(shown[0].id);
  }, [shown, openId]);

  const count = records.records.length;
  return (
    <div className="hall">
      <div className="hall-cornice" aria-hidden>
        <TorchPair className="hall-torches" />
        <svg viewBox="0 0 400 34" preserveAspectRatio="none" width="100%" height="34" focusable="false">
          {Array.from({ length: 10 }, (_, k) => (
            <path key={k} d={`M${k * 40 + 4} 34 V16 a16 16 0 0 1 32 0 V34`} fill="#0e0905" stroke="#8a6a32" strokeWidth="1.4" />
          ))}
        </svg>
      </div>
      <div className="hall-plaque">
        <p className="text-sm text-ink">{records.caption}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          {records.demo && <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-ink-muted">Demo data</span>}
          <span>
            {count} {count === 1 ? "record" : "records"} · {records.reviews_due} {records.reviews_due === 1 ? "review" : "reviews"} owed
          </span>
          <button type="button" className="hall-toggle" aria-pressed={onlyOwed} onClick={() => setOnlyOwed((v) => !v)}>
            {HALL_COPY.onlyOwed}
          </button>
        </div>
      </div>

      {count === 0 ? (
        <EmptyState>
          The shelves are bare. Decisions you log in the <Link to="/journal" className="text-accent hover:underline">Journal</Link> are shelved here.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>{HALL_COPY.noneOwed}</EmptyState>
      ) : (
        <>
          <ul className="hall-shelf" aria-label="Records">
            {shown.map((r) => {
              const t = tomeFor(r);
              const active = open?.id === r.id;
              return (
                <li key={r.id} className="hall-niche">
                  <button
                    type="button"
                    className="hall-tome"
                    aria-pressed={active}
                    aria-controls="hall-desk"
                    aria-label={tomeAria(r)}
                    onClick={() => {
                      setOpenId(r.id);
                      deskRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
                    }}
                  >
                    <TomePicture t={t} id={`${uid}${r.id}`} />
                    <span className="hall-label">
                      <span className="hall-label-name">{r.company_name}</span>
                      <span className="hall-label-meta">
                        {t.actionWord} · {formatDate(r.decided_on)}
                      </span>
                    </span>
                  </button>
                  <span className="hall-plank" aria-hidden />
                </li>
              );
            })}
          </ul>
          <p className="hall-hint">{HALL_COPY.press}</p>
          <div ref={deskRef}>{open && <Desk r={open} />}</div>
        </>
      )}
    </div>
  );
}
