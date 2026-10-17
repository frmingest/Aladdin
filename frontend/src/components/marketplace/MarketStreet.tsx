import { useEffect, useReducer, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link } from "react-router-dom";
import ObjectArtImage from "../ObjectArtImage";
import { Awning, Pip } from "./MarketArt";
import { SalesRep } from "./SalesRepArt";
import { stallArtId } from "../../lib/marketArt";
import { boothNumeral, shopFront, shopPips, storePath, type ShopTone } from "../../lib/marketplace";
import { TONE_PAINT } from "../../lib/marketplacePaint";
import { gapLabel, lanePlots, openReducer, priceLine, stallLabel, streetDistricts, TONE_FLAG, type FlagShape, type LaneRow, type Slot } from "../../lib/marketStreet";
import type { WatchlistRow } from "../../lib/types";
import "./street.css";

/**
 * Market Street (game mode): the watchlist as one cobbled lane with stalls on both sides. Sal's counter and the
 * Hype tent stand on the rim of the fountain square, each district starts at a cross-street with a plank sign, the
 * gate closes the lane. Every stall is a button that opens its card (the way into the store is a real link inside it), with a slim signboard; the pictures are decoration (empty
 * alt) and carry no fact. The flag on each stall is drawn here: a shape and a word per tone, never colour alone.
 * Where each stall stands is the pure `lanePlots`. Read-only: nothing here buys or sells.
 */

const INK = "#26253B";

/** The pennant on a stall's pole. Shape and mark differ per tone; the word is printed on the plate as well. */
function Flag({ tone, shape }: { tone: ShopTone; shape: FlagShape }) {
  const fill = TONE_PAINT[tone].a;
  return (
    <svg className="ms-flag" viewBox="0 0 26 40" aria-hidden>
      <path d="M4 2 V39" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      {shape === "swallowtail" && (
        <>
          <path d="M4 3 H24 L18.5 9.5 L24 16 H4 Z" fill={fill} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8.5 9.5 L11 12 L16 6.8" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "pointed" && (
        <>
          <path d="M4 3 L24 9.5 L4 16 Z" fill={fill} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 9.5 H14" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {shape === "blunt" && (
        <>
          <path d="M4 3 H24 V16 H4 Z" fill={fill} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9 12.5 L14 7 L19 12.5" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {shape === "ring" && <circle cx="14" cy="9.5" r="6" fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="3 2.6" />}
    </svg>
  );
}

/** The same mark, small, in front of the printed word. */
function ToneMark({ tone, shape }: { tone: ShopTone; shape: FlagShape }) {
  const fill = TONE_PAINT[tone].a;
  return (
    <svg width="16" height="14" viewBox="0 0 26 20" aria-hidden>
      {shape === "swallowtail" && <path d="M2 2 H24 L18 10 L24 18 H2 Z" fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {shape === "pointed" && <path d="M2 2 L24 10 L2 18 Z" fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {shape === "blunt" && <path d="M2 2 H24 V18 H2 Z" fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {shape === "ring" && <circle cx="13" cy="10" r="7" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="4 3" />}
    </svg>
  );
}

/** The four flags with their words, as the foldout key. Same marks as the plates. */
export function FlagKey() {
  return (
    <ul className="ms-key" aria-label="How to read the flags">
      {(["gold", "amber", "plain", "mist"] as const).map((t) => (
        <li key={t}>
          <ToneMark tone={t} shape={TONE_FLAG[t].shape} />
          {TONE_FLAG[t].word}
        </li>
      ))}
      <li className="ms-key-pips">Pips: moat, fair price, your price, analyst word, freshness. Dashed = unknown.</li>
    </ul>
  );
}

/**
 * One stall. The stall is a button: it shows the picture, the flag (shape only) and a slim signboard with the name.
 * Pressing it opens its card (an overlay under the signboard, so nothing around it moves) with the tone, ticker, pips
 * and the real link into the store. The card is a sibling of the button, never inside it.
 */
function StreetStall({ row, place, fog, open, onToggle }: { row: WatchlistRow; place: number; fog: boolean; open: boolean; onToggle: () => void }) {
  const front = shopFront(row);
  const paint = TONE_PAINT[front.tone];
  const flag = TONE_FLAG[front.tone];
  const gap = gapLabel(row);
  const pips = shopPips(row);
  const analysed = row.verdict_rating !== null || row.moat_rating !== null;
  const cardId = `ms-card-${row.id}`;
  const card = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // Keep an opened card on screen (phones): scroll just enough, instantly under reduced motion.
    if (!open || typeof card.current?.scrollIntoView !== "function") return;
    const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.current.scrollIntoView({ block: "nearest", inline: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [open]);
  return (
    <div className={`ms-stall-wrap${open ? " is-open" : ""}`} style={{ "--stall-tone": paint.a } as CSSProperties}>
      <button
        type="button"
        id={`ms-stall-${row.id}`}
        className={`ms-stall${fog ? " is-fog" : ""}`}
        aria-expanded={open}
        aria-controls={cardId}
        aria-label={stallLabel(row)}
        title={`${front.tag} · ${priceLine(row)}`}
        data-tone={front.tone}
        onClick={onToggle}
      >
        <span className="ms-art" aria-hidden>
          <ObjectArtImage
            id={stallArtId(row.holding_id)}
            width={196}
            className="ms-stall-img"
            fallback={<Awning a={paint.a} b={paint.b} stripes={8} className="market-awning-sm" />}
          />
          <Flag tone={front.tone} shape={flag.shape} />
        </span>
        <span className="ms-plate" aria-hidden>
          <span className="ms-name">{row.name}</span>
        </span>
      </button>
      <span id={cardId} ref={card} className="ms-card" hidden={!open}>
        <span className="ms-card-head">
          <span className="ms-numeral" aria-hidden>
            {boothNumeral(place)}
          </span>
          <span className="ms-tone">
            <ToneMark tone={front.tone} shape={flag.shape} />
            {flag.word}
            {gap ? ` · ${gap}` : ""}
          </span>
        </span>
        <span className="ms-meta">
          {row.ticker}
          {row.owned ? " · In your fortress" : ""}
        </span>
        <span className="ms-pips" title={analysed ? undefined : "Not analysed yet"}>
          {analysed
            ? pips.map((p) => <Pip key={p.id} gate={p} size={16} />)
            : pips.map((p) => (
                <svg key={p.id} width="16" height="16" viewBox="0 0 20 20" aria-hidden>
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2.5" />
                </svg>
              ))}
        </span>
        <Link to={storePath(row.holding_id)} className="ms-enter">
          Step inside →
        </Link>
      </span>
    </div>
  );
}

/** One prop on its plot: standing on the same baseline as the stalls, with one soft contact shadow. */
function Prop({ id }: { id: Extract<Slot, { kind: "prop" }>["id"] }) {
  return (
    <span className={`ms-prop ms-prop-${id.replace("market-", "")}`} aria-hidden>
      <ObjectArtImage id={id} width={140} fallback={null} />
    </span>
  );
}

/** Wide screens (the lane may take two plots a side). Matches the media query the CSS uses. */
function useLaneWidth(): "wide" | "narrow" {
  const q = "(min-width: 1024px)";
  const has = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [wide, setWide] = useState(() => has && window.matchMedia(q).matches);
  useEffect(() => {
    if (!has) return;
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [has]);
  return wide ? "wide" : "narrow";
}

/** The cross-street that opens a district: a strip of cobbles across the scene, a plank sign, lamps at the lane edges. */
function CrossStreet({ row }: { row: LaneRow }) {
  return (
    <div className="ms-cross" aria-hidden>
      {row.districtIndex > 0 && (
        <>
          <span className="ms-lamp ms-lamp-l">
            <ObjectArtImage id="market-lamp" width={48} fallback={null} />
          </span>
          <span className="ms-lamp ms-lamp-r">
            <ObjectArtImage id="market-lamp" width={48} fallback={null} />
          </span>
        </>
      )}
      <span className="ms-plank">
        {row.label} <b>{row.count}</b>
      </span>
    </div>
  );
}

function LaneRowView({ row, perSide, openId, onToggle }: { row: LaneRow; perSide: number; openId: string | null; onToggle: (id: string) => void }) {
  const fog = row.districtId === "fog";
  const cells: { slot: Slot; col: number }[] = [
    ...row.left.map((slot, i) => ({ slot, col: perSide - i })),
    ...row.right.map((slot, i) => ({ slot, col: perSide + 2 + i })),
  ];
  // DOM and tab order are street order (place); props and bare ground come after, hidden from assistive tech.
  const stalls = cells.flatMap((c) => (c.slot.kind === "stall" ? [{ ...c, slot: c.slot }] : [])).sort((a, b) => a.slot.place - b.slot.place);
  const props = cells.flatMap((c) => (c.slot.kind === "prop" ? [{ ...c, slot: c.slot }] : []));
  const stallCount = stalls.length;
  return (
    <ul className={`ms-row${fog ? " is-fog" : ""}`} aria-label={`${row.label}, ${stallCount} ${stallCount === 1 ? "stall" : "stalls"}`}>
      {stalls.map(({ slot, col }) => (
        <li key={slot.row.id} className={`ms-cell${openId === slot.row.id ? " is-open" : ""}`} style={{ gridColumn: col }}>
          <StreetStall row={slot.row} place={slot.place} fog={fog} open={openId === slot.row.id} onToggle={() => onToggle(slot.row.id)} />
        </li>
      ))}
      {props.map(({ slot, col }) => (
        <li key={`${row.districtId}-${col}-${slot.id}`} className="ms-cell ms-cell-prop" style={{ gridColumn: col }} aria-hidden>
          <Prop id={slot.id} />
        </li>
      ))}
      {row.first && (
        <li className="ms-cell ms-cell-sign" style={{ gridColumn: perSide + 1 }} aria-hidden>
          <ObjectArtImage id="market-signpost" width={96} fallback={null} />
        </li>
      )}
    </ul>
  );
}

export default function MarketStreet({
  rows,
  loaded,
  onTalk,
  onHype,
  salRef,
  hypeRef,
  initialOpenId = null,
}: {
  /** Already in street order (orderStreet). */
  rows: WatchlistRow[];
  loaded: boolean;
  onTalk: () => void;
  onHype: () => void;
  salRef: RefObject<HTMLButtonElement>;
  hypeRef: RefObject<HTMLButtonElement>;
  /** Start with this stall's card open (tests). */
  initialOpenId?: string | null;
}) {
  const width = useLaneWidth();
  const [openId, dispatch] = useReducer(openReducer, initialOpenId);
  useEffect(() => {
    if (openId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dispatch({ type: "close" });
      document.getElementById(`ms-stall-${openId}`)?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);
  const plan = lanePlots(streetDistricts(rows), width);
  return (
    <section className="market-street" aria-label="Market Street" style={{ "--ms-per-side": plan.perSide } as CSSProperties}>
      <div className="ms-sky" aria-hidden>
        <ObjectArtImage id="market-skyline" width={900} className="ms-skyline" fallback={null} />
      </div>
      <div className="ms-ground">
        <div className="ms-square">
          <div className="ms-patch">
            <span className="ms-floor" aria-hidden>
              <ObjectArtImage id="market-cobble" width={288} className="ms-cobble" fallback={null} />
            </span>
            <span className="ms-fountain" aria-hidden>
              <ObjectArtImage id="market-fountain" width={208} className="ms-fountain-pic" fallback={null} />
            </span>
            <div className="ms-fig ms-fig-sal">
              <ObjectArtImage id="sal-counter" width={140} fallback={<SalesRep mood="pitch" size={64} className="sal-figure" />} />
              <button ref={salRef} type="button" className="ms-board ms-board-gold" onClick={onTalk}>
                Ask Sal for a stall
              </button>
            </div>
            <div className="ms-fig ms-fig-hype">
              <ObjectArtImage id="market-hype-tent" width={130} fallback={null} />
              <button
                ref={hypeRef}
                type="button"
                className="ms-board"
                onClick={onHype}
                title="Test a tip against the eight gates"
              >
                Hear the hype
              </button>
            </div>
          </div>
        </div>

        <div className="ms-lane-area">
          {loaded && rows.length === 0 && <p className="ms-empty">No stalls yet. Sal can raise one.</p>}
          {plan.rows.map((r, i) => (
            <div key={`${r.districtId}-${i}`} className="ms-district-row">
              {r.first && <CrossStreet row={r} />}
              <LaneRowView row={r} perSide={plan.perSide} openId={openId} onToggle={(id) => dispatch({ type: "toggle", id })} />
            </div>
          ))}
          <div className="ms-gate" aria-hidden>
            <ObjectArtImage id="market-fence" width={200} className="ms-fence" fallback={null} />
            <ObjectArtImage id="market-gate" width={260} className="ms-gate-pic" fallback={null} />
            <ObjectArtImage id="market-fence" width={200} className="ms-fence ms-fence-right" fallback={null} />
          </div>
        </div>
      </div>
    </section>
  );
}
