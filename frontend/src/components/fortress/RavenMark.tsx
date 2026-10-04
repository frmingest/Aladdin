/** A small drawn raven perched on a tower roof (game mode G15). It marks "a new report was
 * captured for this holding and you have not seen it yet". Decoration for a fact the Ravens card
 * also states in words; the bob is off under reduced motion. */
export default function RavenMark({ x, y }: { x: number; y: number }) {
  return (
    <g className="fortress-raven" transform={`translate(${x} ${y})`} pointerEvents="none">
      <title>A new report has landed on this tower</title>
      <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#15121a" />
      <path d="M-9 -1 Q-15 -9 -5 -8 Q-2 -4 -3 0 Z" fill="#241f2b" />
      <circle cx="8" cy="-4" r="3.6" fill="#15121a" />
      <path d="M11 -4.6 L16 -3.2 L11 -2.2 Z" fill="#d9a93e" />
      <circle cx="9" cy="-4.8" r="0.9" fill="#f2e6c9" />
      <path d="M-9 1 L-15 4 M-7 2 L-12 6.5" stroke="#15121a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M-2 5 V9 M2 5 V9" stroke="#8a6a1c" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}
