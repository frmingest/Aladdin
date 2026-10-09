import { useId } from "react";
import { seatLabel, type Seat } from "../../../lib/councilSeats";
import { Portrait } from "../AdvisorsCard";
import SealMark from "./SealMark";
import TorchPair from "./TorchPair";
import { sealForTone } from "../../../lib/seals";

/** The Council chamber (game mode, Council page hero): a round table with eight chairs, one per agenda
 * kind, in the fixed backend order (lib/councilSeats.ts). A lit seat holds a seal and a stack of papers
 * with the real count printed beside it; an empty chair is plain and says "nothing found". It is not a
 * progress display: no tick, no "x of 8", no fanfare, no gavel (nothing is decided here) and no hourglass.
 * The decorative painting is aria-hidden; the seats are real buttons, and the agenda list below stays the
 * accessible source of truth. Below 640 px the table drops away and the seats become a 2-column grid. */

function Papers({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 40 22" width="40" height="22" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={4 + i * 1.2} y={16 - i * 3} width="28" height="5" rx="1" fill={i % 2 ? "#e6d6a8" : "#efe2c0"} stroke="#8a6a32" strokeWidth="0.7" />
      ))}
    </svg>
  );
}

function SeatBody({ s }: { s: Seat }) {
  return (
    <>
      <span className="flex items-center justify-center gap-1.5">
        {s.occupied && s.tone ? <SealMark kind={sealForTone(s.tone)} size={22} /> : <SealMark kind="none" size={22} />}
        {s.occupied && <Papers n={s.papers} />}
        {s.count !== null && <span className="text-xs font-bold text-[#f6e6bd]">{s.count}</span>}
      </span>
      <span className={`mt-0.5 block text-center text-xs leading-tight ${s.occupied ? "font-semibold text-[#f6e6bd]" : "text-[#a8977a]"}`}>
        {s.label}
        {!s.occupied && <span className="block text-[11px] font-normal">none found</span>}
      </span>
    </>
  );
}

export default function CouncilChamber({
  seats,
  onJump,
  unresolved = false,
}: {
  seats: Seat[];
  onJump: (kind: Seat["kind"]) => void;
  /** True when the council lists things it could not check: an empty chair is then not proof of nothing. */
  unresolved?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const seatClass = (s: Seat) =>
    `rounded-md border px-1.5 py-1.5 ${s.occupied ? "border-[#d9a93e] bg-[#3a2414]" : "border-dashed border-[#6b5a3c] bg-transparent"}`;
  return (
    <div className="chamber relative overflow-hidden rounded-xl" role="group" aria-label="Council chamber: one seat per agenda rule">
      <svg viewBox="0 0 720 260" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full sm:block" aria-hidden>
        <defs>
          <radialGradient id={`ch-floor-${id}`} cx="50%" cy="55%" r="55%">
            <stop offset="0" stopColor="#4a3320" />
            <stop offset="1" stopColor="#1c120b" />
          </radialGradient>
        </defs>
        <rect width="720" height="260" fill={`url(#ch-floor-${id})`} />
        {[90, 270, 450, 630].map((x) => (
          <path key={x} d={`M${x - 40} 0 V40 Q${x} 8 ${x + 40} 40 V0`} fill="#120b06" stroke="#6b5a3c" strokeWidth="1.2" />
        ))}
        <ellipse cx="360" cy="140" rx="150" ry="50" fill="#5a3a1e" stroke="#d9a93e" strokeWidth="2" />
        <ellipse cx="360" cy="140" rx="132" ry="40" fill="none" stroke="#7a5418" strokeWidth="1" />
      </svg>
      <TorchPair className="pointer-events-none absolute inset-x-0 top-0 hidden h-7 w-full sm:block" />
      <div className="relative hidden h-[340px] sm:block">
        <div className="absolute left-1/2 top-[50%] flex -translate-x-1/2 -translate-y-1/2 gap-2 opacity-95">
          <Portrait who="oracle" />
          <Portrait who="partner" />
        </div>
        {seats.map((s) => {
          const style = { left: `${s.leftPct}%`, top: `${s.topPct}%` };
          return s.occupied ? (
            <button
              key={s.kind}
              type="button"
              className={`chamber-seat min-h-[44px] ${seatClass(s)}`}
              style={style}
              aria-label={seatLabel(s)}
              onClick={() => onJump(s.kind)}
            >
              <SeatBody s={s} />
            </button>
          ) : (
            <div key={s.kind} className={`chamber-seat ${seatClass(s)}`} style={style} aria-label={seatLabel(s)} role="img">
              <SeatBody s={s} />
            </div>
          );
        })}
      </div>
      <ul className="relative grid grid-cols-2 gap-2 p-3 pt-8 sm:hidden" aria-label="Council seats">
        {seats.map((s) => (
          <li key={s.kind}>
            {s.occupied ? (
              <button type="button" className={`chamber-btn min-h-[44px] w-full ${seatClass(s)}`} aria-label={seatLabel(s)} onClick={() => onJump(s.kind)}>
                <SeatBody s={s} />
              </button>
            ) : (
              <div className={`min-h-[44px] ${seatClass(s)}`} role="img" aria-label={seatLabel(s)}>
                <SeatBody s={s} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {unresolved && (
        <p className="relative border-t border-dashed border-[#6b5a3c] px-3 py-2 text-xs text-[#cdb98c]">
          Some rules could not be checked (see below). An empty chair is not proof of nothing.
        </p>
      )}
    </div>
  );
}
