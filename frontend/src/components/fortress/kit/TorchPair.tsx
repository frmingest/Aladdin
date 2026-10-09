import { useId } from "react";

/** Two wall torches for a page header or chamber (page-scene kit). The flame uses the shared
 * `fortress-flicker` class, which only animates when the reader has not asked for reduced motion. The
 * glow gradient has its own id so two copies on a page do not clash. */
export default function TorchPair({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const torch = (x: number) => (
    <g>
      <circle cx={x} cy={14} r={11} fill={`url(#tp-glow-${id})`} />
      <rect x={x - 1} y={16} width={2} height={8} fill="#2a1d12" />
      <g className="fortress-flicker">
        <path d={`M${x} 16 q-3.5 -4 0 -10 q3.5 6 0 10 Z`} fill="#ff9a2e" />
        <path d={`M${x} 16 q-1.5 -2 0 -5 q1.5 3 0 5 Z`} fill="#fff1a8" />
      </g>
    </g>
  );
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <radialGradient id={`tp-glow-${id}`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      {torch(8)}
      {torch(92)}
    </svg>
  );
}
