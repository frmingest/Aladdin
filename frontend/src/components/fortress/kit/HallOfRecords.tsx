import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "../../../lib/format";
import { capsuleLabel, capsuleState } from "../../../lib/capsules";
import { BOOK_ART, HALL_COPY, SEAL_LOOK, coverArtId, defaultOpenId, tomeAria, tomeFor, type Tome } from "../../../lib/hall";
import type { CapsuleState } from "../../../lib/capsules";
import { actionLabel, daysText, filterRecords, priceLine, verdictLine } from "../../../lib/rituals";
import type { DecisionRecord, Records } from "../../../lib/types";
import { capsuleArt } from "../../../lib/roomArt";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import { EmptyState } from "../../ui";
import ThenAndNow from "../../ThenAndNow";
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

function TomePicture({ t, id, scale = 1 }: { t: Tome; id: string; scale?: number }) {
  return (
    <svg viewBox="0 0 96 124" width={96 * scale} height={124 * scale} aria-hidden focusable="false" className="hall-tome-art">
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

/** One review's mark. With "Object art" on it is a time-capsule casket: closed while sealed, closed with a
 * cracked seal when the review is owed, open once it is written (the shape tells the state; the printed
 * label beside it says it in words). Otherwise, or if the picture fails, the painted wax seal. */
function CapsuleMark({ state, months }: { state: CapsuleState; months: 6 | 12 }) {
  const mode = useArtMode();
  const [failed, setFailed] = useState(false);
  const look = capsuleArt(state);
  const art = look ? getObjectArt(look.id) : null;
  if (mode !== "stitch" || failed || !look || !art) {
    return (
      <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden focusable="false" className="shrink-0">
        <SealGlyph state={state} months={months} cx={14} cy={14} r={11} />
      </svg>
    );
  }
  return (
    <span className="hall-casket" aria-hidden="true">
      <img src={art.src} alt="" width={40} height={Math.round((40 * art.height) / art.width)} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      {look.broken && (
        <svg viewBox="0 0 28 28" width="22" height="22" focusable="false" className="hall-casket-seal">
          <SealGlyph state="unsealed" months={months} cx={14} cy={14} r={11} />
        </svg>
      )}
    </span>
  );
}

function Review({ months, state, text }: { months: 6 | 12; state: DecisionRecord["review_6m"]; text: string | null }) {
  const c = capsuleState(state);
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CapsuleMark state={c} months={months} />
        <span>{capsuleLabel(months, state)}</span>
      </p>
      {text && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{text}</p>}
    </div>
  );
}

/** The painted book (Game mode, "Object art"): the six covers, two leaves and the ribbon. Returns the picture
 * addresses once every picture the desk needs has loaded, else null and the desk keeps its drawn book. Loading
 * is checked up front so the book never flips from drawn to painted in front of the reader. */
type BookArt = { left: string; right: string; ribbon: string; covers: Record<string, string> };
function useBookArt(actions: string[]): BookArt | null {
  const mode = useArtMode();
  const [art, setArt] = useState<BookArt | null>(null);
  const key = actions.join("|");
  useEffect(() => {
    if (mode !== "stitch") {
      setArt(null);
      return;
    }
    const left = getObjectArt(BOOK_ART.left);
    const right = getObjectArt(BOOK_ART.right);
    const ribbon = getObjectArt(BOOK_ART.ribbon);
    if (!left || !right || !ribbon) return;
    const covers: Record<string, string> = {};
    for (const a of key.split("|").filter(Boolean)) {
      const id = coverArtId(a);
      const pic = id ? getObjectArt(id) : null;
      if (pic) covers[a] = pic.src;
    }
    const urls = [left.src, right.src, ribbon.src, ...Object.values(covers)];
    let live = true;
    let pending = urls.length;
    for (const src of urls) {
      const img = new Image();
      img.onload = () => {
        pending -= 1;
        if (live && pending === 0) setArt({ left: left.src, right: right.src, ribbon: ribbon.src, covers });
      };
      img.onerror = () => {
        live = false;
      };
      img.src = src;
    }
    return () => {
      live = false;
    };
  }, [mode, key]);
  return art;
}

/** Round emblem for a painted cover: the action's letter, as on the shelf tome. Decoration. */
function CoverEmblem({ letter }: { letter: string }) {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden focusable="false" className="hall-cover-emblem">
      <circle cx="32" cy="32" r="27" fill="#120c07" fillOpacity="0.5" stroke="#d9a93e" strokeWidth="2" />
      <text x="32" y="42" textAnchor="middle" fontSize="30" fontWeight="700" fontFamily="Georgia, serif" fill="#f6dfa6">
        {letter}
      </text>
    </svg>
  );
}

function Desk({ r, t, deskId, demo, opening, art }: { r: DecisionRecord; t: Tome; deskId: string; demo: boolean; opening: boolean; art: BookArt | null }) {
  const cover = art?.covers[r.action];
  const painted = Boolean(art && cover);
  const look = { "--cover": t.leather, "--cover-edge": t.edge } as CSSProperties;
  if (painted && art && cover) {
    Object.assign(look, { "--page-left": `url(${art.left})`, "--page-right": `url(${art.right})`, "--cover-img": `url(${cover})` });
  }
  return (
    <div className="hall-desk" id="hall-desk" aria-live="polite">
      <div className={`hall-book${painted ? " hall-book--art" : ""}${opening ? " hall-book--opening" : ""}`} style={look}>
        <div className="hall-board">
          <div className="hall-page hall-page-left">
            <h3 className="hall-title font-display text-lg text-ink">
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
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="hall-leaf-label">What you wrote then</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink">{r.thesis}</dd>
              </div>
              <div>
                <dt className="hall-leaf-label">What would prove it wrong</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink">{r.invalidation ?? <span className="text-ink-muted">Nothing was written.</span>}</dd>
              </div>
            </dl>
          </div>
          <div className="hall-spine" aria-hidden />
          <div className="hall-page hall-page-right">
            <p className="hall-price text-sm text-ink">{priceLine(r)}</p>
            <p className="text-sm text-ink-muted">{verdictLine(r)}</p>
            <div className="mt-4 space-y-3 border-t border-border-subtle pt-3">
              <Review months={6} state={r.review_6m} text={r.review_6m_text} />
              <Review months={12} state={r.review_12m} text={r.review_12m_text} />
            </div>
            {!demo && r.holding_id && <ThenAndNow key={r.id} entryId={r.id} />}
          </div>
          {t.owed && (painted && art ? <img className="hall-ribbon-art" src={art.ribbon} alt="" aria-hidden="true" width={89} height={200} /> : <span className="hall-ribbon" aria-hidden />)}
        </div>
        <div className="hall-cover" aria-hidden>
          <div className="hall-cover-front">
            {painted ? <CoverEmblem letter={t.letter} /> : <TomePicture t={t} id={`${deskId}${r.id}`} scale={1.7} />}
          </div>
          <div className="hall-cover-back" />
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
  // The cover swings open only after a press, never on page load (the desk starts below the fold).
  const [opening, setOpening] = useState(false);
  const actions = useMemo(() => Array.from(new Set(records.records.map((x) => x.action))).sort(), [records.records]);
  const bookArt = useBookArt(actions);
  const open = shown.find((r) => r.id === openId) ?? shown[0] ?? null;
  useEffect(() => {
    if (shown.length > 0 && !shown.some((r) => r.id === openId)) setOpenId(shown[0].id);
  }, [shown, openId]);

  const count = records.records.length;
  return (
    <div className="hall">
      <div className="hall-cornice" aria-hidden>
        <TorchPair className="hall-torches" />
        <svg className="hall-arcade" width="100%" height="36" focusable="false">
          <defs>
            {/* Tile origin is the page centre and arches sit on the tile edges, so the row is symmetric. */}
            <pattern id={`arcade-${uid}`} x="50%" width="44" height="36" patternUnits="userSpaceOnUse">
              {[0, 44].map((cx) => (
                <g key={cx}>
                  <path d={`M${cx - 17} 36 V19 a17 17 0 0 1 34 0 V36`} fill="#0e0905" stroke="#8a6a32" strokeWidth="1.4" />
                  <path d={`M${cx - 12} 36 V20 a12 12 0 0 1 24 0 V36`} fill="#1b120a" stroke="#3a2a18" strokeWidth="1" />
                </g>
              ))}
            </pattern>
          </defs>
          <rect width="100%" height="36" fill={`url(#arcade-${uid})`} />
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
          The shelves are bare. Decisions you log in the <Link to="/journal" className="text-accent underline underline-offset-2">Journal</Link> are shelved here.
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
                      setOpening(true);
                      deskRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
                    }}
                  >
                    <TomePicture t={t} id={`${uid}${r.id}`} />
                    <span className="hall-label">
                      <span className="hall-label-name font-display" title={r.company_name}>
                        {r.company_name}
                      </span>
                      <span className="hall-label-rule" aria-hidden />
                      <span className="hall-label-meta">
                        <span className="hall-label-action">{t.actionWord}</span>
                        <span className="hall-label-date">{formatDate(r.decided_on)}</span>
                      </span>
                    </span>
                  </button>
                  <span className="hall-plank" aria-hidden />
                </li>
              );
            })}
          </ul>
          <p className="hall-hint">{HALL_COPY.press}</p>
          <div ref={deskRef}>{open && <Desk key={open.id} r={open} t={tomeFor(open)} deskId={`d${uid}`} demo={records.demo} opening={opening} art={bookArt} />}</div>
        </>
      )}
    </div>
  );
}
