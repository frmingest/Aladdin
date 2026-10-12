import type { ReactNode } from "react";
import { candleTops, councilFurniture } from "../../../lib/roomArt";
import { getObjectArt } from "../../../lib/stitchArt";

const STAND_H = 92;

function Flame({ left, top }: { left: number; top: number }) {
  return (
    <svg
      viewBox="0 0 10 16"
      width="9"
      height="14"
      aria-hidden="true"
      className="absolute"
      style={{ left, top, transform: "translate(-50%, -100%)" }}
    >
      <path d="M5 1 C8 5 9 8 9 10.5 A4 4.5 0 0 1 1 10.5 C1 8 3 6 5 1 Z" fill="#f7c04a" stroke="#c9801a" strokeWidth="0.8" />
      <path d="M5 8 C6.6 9.6 6.8 11 5 12.6 C3.2 11 3.4 9.6 5 8 Z" fill="#fff1c2" />
    </svg>
  );
}

function CandleStand({ side }: { side: "left" | "right" }) {
  const art = getObjectArt("council-candles");
  if (!art) return null;
  const w = Math.round((STAND_H * art.width) / art.height);
  return (
    <div className="absolute bottom-1 hidden sm:block" style={{ [side]: 4, width: w, height: STAND_H }} aria-hidden="true">
      <img src={art.src} alt="" width={w} height={STAND_H} loading="lazy" decoding="async" className="object-art block" />
      {candleTops().map(([fx, fy], i) => (
        <Flame key={i} left={fx * w} top={fy * STAND_H} />
      ))}
    </div>
  );
}

/**
 * The Council chamber's furniture with Object art on (Design Master Sprint 9): the round table, one iron
 * chair for each advisor (the same picture, mirrored) and two candle stands whose flames are drawn by code.
 * Purely decoration: the eight seats stay the real buttons, the table and chairs carry no fact, the flames
 * are constant (they do not flicker and do not count anything). The advisors sit on the chairs.
 * Returns null unless every picture is packed, so the chamber keeps its SVG table.
 */
export default function ChamberFurniture({
  oracle,
  partner,
  onError,
}: {
  oracle: ReactNode;
  partner: ReactNode;
  onError?: () => void;
}) {
  const f = councilFurniture();
  const table = f && getObjectArt(f.table);
  const chair = f && getObjectArt(f.chair);
  if (!f || !table || !chair) return null;
  return (
    <>
      <CandleStand side="left" />
      <CandleStand side="right" />
      <img src={table.src} alt="" aria-hidden="true" width={170} height={Math.round((170 * table.height) / table.width)} loading="lazy" decoding="async" className="chamber-art-table object-art" onError={onError} />
      {([["left", oracle], ["right", partner]] as const).map(([side, who]) => (
        <div key={side} className={`chamber-art-chair chamber-art-chair-${side}`} aria-hidden="true">
          <img src={chair.src} alt="" width={74} height={Math.round((74 * chair.height) / chair.width)} loading="lazy" decoding="async" className="object-art block" onError={onError} />
          <div className="chamber-art-sitter">{who}</div>
        </div>
      ))}
    </>
  );
}
