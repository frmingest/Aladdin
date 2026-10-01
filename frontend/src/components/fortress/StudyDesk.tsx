import { useEffect, useState } from "react";
import { clockHands, clockPoint, lampReading } from "../../lib/fortress";

/** Game mode G7b: the study lamp and clock. The clock is the real local time.
 * The lamp is lit while the portfolio snapshot is recent, dim when it is
 * older and out when there is none: a reading of how old the data is, not a
 * score or a reward. */

function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

export default function StudyDesk({ asOf }: { asOf: string | null }) {
  const now = useNow(30_000);
  const lamp = lampReading(asOf, now);
  const hands = clockHands(now);
  const cx = 22;
  const cy = 22;
  const hourTip = clockPoint(hands.hour, cx, cy, 9);
  const minuteTip = clockPoint(hands.minute, cx, cy, 14);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const glow = lamp.state === "lit" ? 0.9 : lamp.state === "dim" ? 0.35 : 0;

  return (
    <div className="flex items-center gap-3" aria-label="Study desk">
      <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" role="img" aria-label={`Clock: ${time}`}>
        <circle cx={cx} cy={cy} r="20" fill="#f3e4bf" stroke="#6e4a12" strokeWidth="2.4" />
        <circle cx={cx} cy={cy} r="17" fill="none" stroke="#6e4a12" strokeOpacity="0.4" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = clockPoint(i * 30, cx, cy, 15.5);
          const b = clockPoint(i * 30, cx, cy, i % 3 === 0 ? 12.5 : 14);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3a2614" strokeWidth={i % 3 === 0 ? 1.6 : 1} />;
        })}
        <line x1={cx} y1={cy} x2={hourTip.x} y2={hourTip.y} stroke="#20170e" strokeWidth="2.4" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={minuteTip.x} y2={minuteTip.y} stroke="#20170e" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="1.8" fill="#7a1d18" />
      </svg>

      <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" role="img" aria-label={lamp.text}>
        {glow > 0 && (
          <g opacity={glow}>
            <ellipse className="study-lamp-glow" cx="22" cy="20" rx="19" ry="15" fill="#ffd978" />
          </g>
        )}
        <rect x="9" y="38" width="26" height="3.4" rx="1.4" fill="#5a4220" />
        <rect x="20.4" y="24" width="3.2" height="14" fill="#8a5a2a" />
        <path d="M10 24 L15 10 H29 L34 24 Z" fill={lamp.state === "out" ? "#4a4036" : "#c98f2e"} stroke="#2a1a06" />
        <ellipse cx="22" cy="24" rx="12" ry="2.6" fill={lamp.state === "out" ? "#2f2820" : "#ffe6a3"} opacity={lamp.state === "dim" ? 0.55 : 1} />
      </svg>

      <p className="min-w-0 text-xs leading-snug text-ink-muted">
        <span className="tabular font-semibold text-ink">{time}</span> local time.
        <br />
        {lamp.text}
      </p>
    </div>
  );
}
