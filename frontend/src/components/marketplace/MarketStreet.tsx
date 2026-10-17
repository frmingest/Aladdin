import { Fragment, type CSSProperties, type RefObject } from "react";
import { Link } from "react-router-dom";
import ObjectArtImage from "../ObjectArtImage";
import type { ObjectArtId } from "../../lib/stitchArt";
import { VerdictBadge } from "../ui";
import { Awning, Pip } from "./MarketArt";
import { SalesRep } from "./SalesRepArt";
import { formatPrice } from "../../lib/format";
import { stallArtId } from "../../lib/marketArt";
import { boothNumeral, shopFront, shopPips, storePath, type ShopTone } from "../../lib/marketplace";
import { TONE_PAINT } from "../../lib/marketplacePaint";
import { decorId, decorSlots, gapLabel, jitterPx, stallLabel, streetDistricts, TONE_FLAG, type FlagShape } from "../../lib/marketStreet";
import type { WatchlistRow } from "../../lib/types";
import "./street.css";

/**
 * Market Street (game mode): the watchlist as a street of stalls on a painted landscape. Sal's counter and the
 * Hype tent stand on the fountain square, districts run down the street, the gate closes it. Every stall is a
 * real link with a printed plate; the pictures are decoration (empty alt) and carry no fact. The flag on each
 * stall is drawn here: a shape and a word per tone, never colour alone. Read-only: nothing here buys or sells.
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

function StreetStall({ row, place, fog }: { row: WatchlistRow; place: number; fog: boolean }) {
  const front = shopFront(row);
  const paint = TONE_PAINT[front.tone];
  const flag = TONE_FLAG[front.tone];
  const gap = gapLabel(row);
  const pips = shopPips(row);
  const analysed = row.verdict_rating !== null || row.moat_rating !== null;
  return (
    <Link
      to={storePath(row.holding_id)}
      className={`ms-stall${fog ? " is-fog" : ""}`}
      aria-label={stallLabel(row)}
      title={front.tag}
      style={{ "--stall-tone": paint.a, "--ms-jitter": `${jitterPx(row.holding_id)}px` } as CSSProperties}
    >
      <span className="ms-art" aria-hidden>
        <ObjectArtImage
          id={stallArtId(row.holding_id)}
          width={136}
          className="ms-stall-img"
          fallback={<Awning a={paint.a} b={paint.b} stripes={8} className="market-awning-sm" />}
        />
        <Flag tone={front.tone} shape={flag.shape} />
      </span>
      <span className="ms-plate">
        <span className="stall-numeral" aria-hidden>
          {boothNumeral(place)}
        </span>
        <span className="ms-plate-body">
          <span className="ms-name">{row.name}</span>
          <span className="ms-meta">
            {row.ticker}
            {row.owned ? " · In your fortress" : ""}
          </span>
          <span className="ms-tone">
            <ToneMark tone={front.tone} shape={flag.shape} />
            {flag.word}
            {gap ? ` · ${gap}` : ""}
          </span>
          <span className="ms-ledger tabular">
            {row.price ? formatPrice(row.price, row.price_currency) : "—"} · yours {row.buy_below_price ? formatPrice(row.buy_below_price, row.buy_below_currency) : "not named"}
          </span>
          {analysed ? (
            <span className="ms-pips">
              <span className="flex items-center gap-1">
                {pips.map((p) => (
                  <Pip key={p.id} gate={p} size={16} />
                ))}
              </span>
              <VerdictBadge rating={row.verdict_rating} title="Stored analyst verdict" />
            </span>
          ) : (
            <span className="ms-meta">Not analysed yet</span>
          )}
          <span className="ms-enter">Step inside →</span>
        </span>
      </span>
    </Link>
  );
}

/** Rendered width of each prop in px, so the props read as one street (heights follow the pictures). */
const DECOR_WIDTH: Record<string, number> = {
  "market-lamp": 44,
  "market-tree": 110,
  "market-crates": 100,
  "market-bench": 110,
  "market-handcart": 110,
  "market-fence": 140,
};

/** Street furniture standing between districts: a pair at the edges (left, right) and an optional one in the middle. */
const FURNITURE: { left: [string, number]; right: [string, number]; mid?: [string, number] }[] = [
  { left: ["market-lamp", 40], right: ["market-tree", 104] },
  { left: ["market-crates", 88], right: ["market-lamp", 40], mid: ["market-bench", 96] },
  { left: ["market-tree", 96], right: ["market-handcart", 100] },
];

/** Each district starts its cycle of props at a different one, so the street does not repeat in step. */
const DECOR_START: Record<string, number> = { range: 0, near: 2, above: 4, fog: 1 };

function Furniture({ n }: { n: number }) {
  const f = FURNITURE[n % FURNITURE.length]!;
  const pic = (e: [string, number]) => <ObjectArtImage id={e[0] as ObjectArtId} width={e[1]} fallback={<span />} />;
  return (
    <div className="ms-furniture" aria-hidden>
      {pic(f.left)}
      {f.mid ? pic(f.mid) : <span />}
      {pic(f.right)}
    </div>
  );
}

export default function MarketStreet({
  rows,
  loaded,
  demoMode,
  onTalk,
  onHype,
  salRef,
  hypeRef,
}: {
  /** Already in street order (orderStreet). */
  rows: WatchlistRow[];
  loaded: boolean;
  demoMode: boolean;
  onTalk: () => void;
  onHype: () => void;
  salRef: RefObject<HTMLButtonElement>;
  hypeRef: RefObject<HTMLButtonElement>;
}) {
  const districts = streetDistricts(rows);
  return (
    <section className="market-street" aria-label="Market Street">
      <div className="ms-sky" aria-hidden>
        <ObjectArtImage id="market-skyline" width={900} className="ms-skyline" fallback={null} />
      </div>
      <div className="ms-ground">
        <div className="ms-square">
          <div className="ms-booth">
            <ObjectArtImage id="sal-counter" width={140} fallback={<SalesRep mood="pitch" size={64} className="sal-figure" />} />
            <button ref={salRef} type="button" className="sal-btn" onClick={onTalk}>
              Ask Sal for a stall
            </button>
          </div>
          <div className="ms-fountain" aria-hidden>
            <ObjectArtImage id="market-cobble" width={288} className="ms-cobble" fallback={null} />
            <ObjectArtImage id="market-fountain" width={208} className="ms-fountain-pic" fallback={null} />
          </div>
          <div className="ms-booth">
            <ObjectArtImage id="market-hype-tent" width={130} fallback={null} />
            <button
              ref={hypeRef}
              type="button"
              className="sal-btn-ghost"
              onClick={onHype}
              title="Bring a tip from a friend, Reddit or a newsletter and see whether it survives the eight gates"
            >
              Hear the hype
            </button>
          </div>
          <p className="ms-hint">
            {demoMode ? "Demo mode is on: the street is painted scenery." : "Add a company by its Yahoo ticker. Oslo Børs symbols end in .OL."}
          </p>
        </div>

        {loaded && rows.length === 0 && <p className="ms-empty">No stalls yet. Sal can raise one.</p>}

        {districts.map((d, di) => {
          const slots = decorSlots(d.rows.length);
          return (
            <div key={d.id} className="ms-district">
              <div className="ms-district-head">
                <ObjectArtImage id="market-signpost" width={40} fallback={null} />
                <h2 className="ms-district-title">
                  {d.label} <span>{d.rows.length}</span>
                </h2>
              </div>
              <ul className="ms-plots">
                {d.rows.map(({ row, place }, i) => (
                  <Fragment key={row.id}>
                    {slots.includes(i) && (
                      <li className="ms-decor" aria-hidden>
                        <ObjectArtImage
                          id={decorId(slots.indexOf(i) + (DECOR_START[d.id] ?? 0))}
                          width={DECOR_WIDTH[decorId(slots.indexOf(i) + (DECOR_START[d.id] ?? 0))] ?? 100}
                          fallback={null}
                        />
                      </li>
                    )}
                    <li>
                      <StreetStall row={row} place={place} fog={d.id === "fog"} />
                    </li>
                  </Fragment>
                ))}
              </ul>
              {di < districts.length - 1 && <Furniture n={di} />}
            </div>
          );
        })}

        <div className="ms-gate" aria-hidden>
          <ObjectArtImage id="market-fence" width={140} className="ms-fence" fallback={null} />
          <ObjectArtImage id="market-gate" width={260} className="ms-gate-pic" fallback={null} />
          <ObjectArtImage id="market-fence" width={140} className="ms-fence ms-fence-right" fallback={null} />
        </div>
      </div>
    </section>
  );
}
