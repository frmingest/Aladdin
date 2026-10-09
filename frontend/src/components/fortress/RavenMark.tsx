/** A small drawn raven perched on a tower roof (game mode G15). It marks "a new report was
 * captured for this holding and you have not seen it yet". Decoration for a fact the Ravens card
 * also states in words; the bob is off under reduced motion. */
export default function RavenMark({ x, y }: { x: number; y: number }) {
  return (
    // The position lives on the outer group: the bob animation sets a CSS
    // transform, which would replace a transform attribute on the same element
    // and throw the bird to the corner of the scene.
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <g className="fortress-raven">
        <title>A new report has landed on this tower</title>
        {/* A pale halo and outline so the black bird reads against a night sky. */}
        <circle cx="0" cy="-2" r="15" fill="#e9e1f2" opacity={0.2} />
        <ellipse
          cx="0"
          cy="0"
          rx="10.2"
          ry="6.7"
          fill="#e9e1f2"
          opacity={0.85}
        />
        <circle cx="8" cy="-4" r="4.7" fill="#e9e1f2" opacity={0.85} />
        <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#15121a" />
        <path d="M-9 -1 Q-15 -9 -5 -8 Q-2 -4 -3 0 Z" fill="#241f2b" />
        <circle cx="8" cy="-4" r="3.6" fill="#15121a" />
        <path d="M11 -4.6 L16 -3.2 L11 -2.2 Z" fill="#d9a93e" />
        <circle cx="9" cy="-4.8" r="0.9" fill="#f2e6c9" />
        <path
          d="M-9 1 L-15 4 M-7 2 L-12 6.5"
          stroke="#15121a"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M-2 5 V9 M2 5 V9"
          stroke="#8a6a1c"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}
