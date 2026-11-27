import { TOUCH_TOKENS as T } from "../../../game3d/gameTokens";

/**
 * Shared kit (#485): the art of the 3D touch controls. Both are decoration (aria-hidden); the buttons around them carry
 * the names. Shape carries the meaning, never colour alone: the rose has four long points (where you can push), the
 * seal is a round blob with a scalloped rim and a word. They are controls, not facts, so they have no unknown (fog) or Plain
 * variant: the seal only exists while the prompt names a real E action. Used by /game3d only, as its touch signature.
 */

const POINTS = [0, 90, 180, 270];
const SMALL_POINTS = [45, 135, 225, 315];

/** The stick's base: a brass compass rose in a ring, drawn to fill its box. */
export function CompassRose({ size }: { size: number }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden focusable="false" data-kit="compass-rose">
      <circle r="49" cy="2" fill={T.shadow} />
      <circle r="47" fill={T.roseGround} stroke={T.brassDeep} strokeWidth="3" />
      <circle r="41" fill="none" stroke={T.brass} strokeWidth="1.5" strokeDasharray="2 4" />
      {SMALL_POINTS.map((a) => (
        <path key={a} d="M0 -26 L5 -5 L0 0 L-5 -5 Z" transform={`rotate(${a})`} fill={T.brassDeep} stroke={T.outline} strokeWidth="1" />
      ))}
      {POINTS.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0 -40 L7 -7 L0 0 Z" fill={T.brassLight} stroke={T.outline} strokeWidth="1.2" />
          <path d="M0 -40 L-7 -7 L0 0 Z" fill={T.brass} stroke={T.outline} strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}

/** The stick's knob: a small brass boss the thumb moves. */
export function RoseKnob({ size }: { size: number }) {
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} aria-hidden focusable="false" data-kit="rose-knob">
      <circle r="18" fill={T.brass} stroke={T.outline} strokeWidth="2" />
      <circle r="12" fill={T.brassLight} stroke={T.brassDeep} strokeWidth="2" />
      <circle r="3" fill={T.brassDeep} />
    </svg>
  );
}

/** The action seal's wax: a round blob with a scalloped rim (the word goes on top, as text, so it stays crisp). */
export function WaxSealDisc({ size }: { size: number }) {
  const scallops = Array.from({ length: 14 }, (_, i) => (i * 360) / 14);
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden focusable="false" data-kit="wax-seal">
      {scallops.map((a) => (
        <circle key={a} cx="0" cy="-40" r="9" transform={`rotate(${a})`} fill={T.wax} stroke={T.outline} strokeWidth="1.5" />
      ))}
      <circle r="41" fill={T.wax} />
      <circle r="33" fill="none" stroke={T.waxDeep} strokeWidth="3" />
    </svg>
  );
}
