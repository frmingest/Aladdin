/**
 * Text tokens for the 3D world, in one place. A label is a parchment tag: dark ink on cream with a
 * timber rim, so it holds on the light sky and on the dark halls. The unit test checks every
 * text/plate pair for 4.5:1 or better.
 */
export const LABEL_TOKENS = {
  /** Cream parchment plate and its ink. */
  plate: "#F6EFE0",
  ink: "#2a1a06",
  rim: "#8a6a32",
  /** Fog (unknown) plate: a greyer parchment with a dashed rim. Never carries a number. */
  fogPlate: "#d9d4c8",
  fogInk: "#2e2d38",
  fogRim: "#6b6e8a",
  /** The thing you face: a gold plate so it stands out from the rest. */
  nowPlate: "#f2d27a",
  nowInk: "#2a1a06",
  /** The Stitch outline round every plate. */
  outline: "#26253B",
} as const;

/** The (ink, plate) pairs the tokens promise are readable. */
export const LABEL_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["plate", LABEL_TOKENS.ink, LABEL_TOKENS.plate],
  ["fog", LABEL_TOKENS.fogInk, LABEL_TOKENS.fogPlate],
  ["now", LABEL_TOKENS.nowInk, LABEL_TOKENS.nowPlate],
];

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio of two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
