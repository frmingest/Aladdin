import { useId } from "react";

/** Two wall torches for a page header or chamber (page-scene kit). Each torch is its own square SVG pinned
 * to one side, so the flame keeps its true shape at any page width. (The first version was one wide SVG
 * stretched with `preserveAspectRatio="none"`, which squashed the flames flat on wide screens.) The flame
 * uses the shared `fortress-flicker` class, which only animates when the reader has not asked for reduced
 * motion. The glow gradient has its own id so several copies on a page do not clash. */
export default function TorchPair({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const torch = (n: number) => (
    <svg viewBox="0 0 28 28" focusable="false" aria-hidden>
      <defs>
        <radialGradient id={`tp-glow-${id}-${n}`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={14} cy={15} r={13.5} fill={`url(#tp-glow-${id}-${n})`} />
      <rect x={12.5} y={20} width={3} height={8} rx={0.6} fill="#2a1d12" />
      <g className="fortress-flicker">
        <path d="M14 21 q-5.2 -6 0 -17 q5.2 11 0 17 Z" fill="#ff9a2e" />
        <path d="M14 21 q-2.4 -3.2 0 -8.5 q2.4 5.3 0 8.5 Z" fill="#fff1a8" />
      </g>
    </svg>
  );
  return (
    <div className={`torch-pair ${className}`} aria-hidden>
      {torch(0)}
      {torch(1)}
    </div>
  );
}
