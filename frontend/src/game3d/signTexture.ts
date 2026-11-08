import { INK, PAL } from "./Inked";
import { LABEL_TOKENS } from "./gameTokens";

/**
 * Painted signs: names that live ON a thing in the world (a plank over a door, a banner on a wall, a carved
 * stone) instead of floating over it. One painter for all three shapes, so the look stays one family.
 * `chalkFor` is the pure, tested part: it turns the flat page's signed share into the glyph, tone and words
 * chalked on the sign. A loss is a stripe plus a glyph plus the number, never colour alone, and an unknown
 * value is a "?" seal that never carries a number.
 */
export type SignKind = "plank" | "banner" | "stone";
export type ChalkTone = "loss" | "gain" | "flat" | "fog";

export interface Chalk {
  tone: ChalkTone;
  glyph: string;
  /** The number as the flat page prints it. Empty for fog. */
  text: string;
}

export interface SignSpec {
  kind: SignKind;
  /** The name, first; further lines are small print under it. */
  lines: string[];
  chalk?: Chalk;
  /** Unknown value: grey cloth, dashed rim. */
  fog?: boolean;
}

/** Sign tokens: colours for the chalk board and the state stripe, one place. */
export const SIGN_TOKENS = {
  board: "#2f3140",
  chalk: "#f4f1e6",
  stone: "#d8d6e4",
  stoneRim: "#6b6e8a",
  loss: "#d9583b",
  gain: "#4f9d3a",
  flat: "#8f93ad",
  fog: "#6b6e8a",
} as const;

/** Text/background pairs the tokens promise are readable (4.5:1), checked in the unit test. */
export const SIGN_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["chalk on board", SIGN_TOKENS.chalk, SIGN_TOKENS.board],
  ["ink on stone", LABEL_TOKENS.ink, SIGN_TOKENS.stone],
  ["ink on cream", LABEL_TOKENS.ink, LABEL_TOKENS.plate],
];

const MINUS = /^[-−]/;
const PLUS = /^\+/;

/** Glyph, tone and words for a signed share ("-31.5%", "+4.0%", "0.0%"). `null` or empty is unknown: a fog seal. */
export function chalkFor(shock: string | null | undefined): Chalk {
  const t = (shock ?? "").trim();
  if (!t || t === "?" || t === "—") return { tone: "fog", glyph: "?", text: "" };
  if (MINUS.test(t)) return { tone: "loss", glyph: "▼", text: t };
  if (PLUS.test(t)) return { tone: "gain", glyph: "▲", text: t };
  return { tone: "flat", glyph: "■", text: t };
}

/** Canvas size in pixels per shape; the world size is chosen by the caller, so the aspect is fixed here. */
export const SIGN_PX: Readonly<Record<SignKind, { w: number; h: number }>> = {
  plank: { w: 768, h: 192 },
  banner: { w: 640, h: 384 },
  stone: { w: 768, h: 384 },
};

/** Height of a sign of this shape at this world width, for callers that must place it on something. */
export function signHeight(kind: SignKind, width: number): number {
  const px = SIGN_PX[kind];
  return (width * px.h) / px.w;
}

const FACE = `"Marcellus", "Segoe UI", system-ui, sans-serif`;
const NUM = `"Segoe UI", system-ui, sans-serif`;

/** Shrink a font until the text fits `max` pixels wide (never below `min`). */
function fit(g: CanvasRenderingContext2D, text: string, weight: string, size: number, min: number, max: number, face = FACE): number {
  let f = size;
  g.font = `${weight} ${f}px ${face}`;
  while (g.measureText(text).width > max && f > min) {
    f -= 4;
    g.font = `${weight} ${f}px ${face}`;
  }
  return f;
}

function rim(g: CanvasRenderingContext2D, w: number, h: number, color: string, dashed: boolean) {
  g.strokeStyle = color;
  g.lineWidth = 10;
  g.setLineDash(dashed ? [28, 16] : []);
  g.strokeRect(5, 5, w - 10, h - 10);
  g.setLineDash([]);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, h - 3);
}

/** Paint one sign. Done once per distinct spec (the component memoises it); never per frame. */
export function paintSign(spec: SignSpec): HTMLCanvasElement {
  const { w, h } = SIGN_PX[spec.kind];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return c;
  const fog = !!spec.fog || spec.chalk?.tone === "fog";
  const ground = spec.kind === "stone" ? SIGN_TOKENS.stone : fog ? LABEL_TOKENS.fogPlate : LABEL_TOKENS.plate;
  const edge = spec.kind === "stone" ? SIGN_TOKENS.stoneRim : fog ? LABEL_TOKENS.fogRim : PAL.timberDark;
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
  rim(g, w, h, edge, fog);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = fog ? LABEL_TOKENS.fogInk : LABEL_TOKENS.ink;

  const [title = "", ...small] = spec.lines;
  const chalk = spec.chalk;
  // The chalk board takes the lower part of a banner; a plank has none.
  const boardH = chalk && spec.kind !== "plank" ? Math.round(h * 0.4) : 0;
  const top = h - boardH;
  const lines = small.length;
  const titleArea = top - 24 - lines * 46;
  fit(g, title, "700", Math.min(96, titleArea * 0.7), 32, w - 64);
  g.fillText(title, w / 2, 14 + titleArea / 2 + 6, w - 64);
  small.forEach((l, i) => {
    fit(g, l, "600", 36, 22, w - 64, NUM);
    g.fillText(l, w / 2, 14 + titleArea + 26 + i * 46, w - 64);
  });

  if (chalk && boardH > 0) {
    g.fillStyle = SIGN_TOKENS.board;
    g.fillRect(10, top, w - 20, boardH - 10);
    // The state stripe down the left edge of the board, plus the glyph and the number: never colour alone.
    g.fillStyle = SIGN_TOKENS[chalk.tone];
    g.fillRect(10, top, 22, boardH - 10);
    g.fillStyle = SIGN_TOKENS.chalk;
    const mid = top + (boardH - 10) / 2;
    if (chalk.tone === "fog") {
      g.font = `700 ${Math.round(boardH * 0.6)}px ${FACE}`;
      g.fillText("?", w / 2, mid + 4);
    } else {
      const text = `${chalk.glyph} ${chalk.text}`;
      fit(g, text, "700", Math.round(boardH * 0.62), 30, w - 100, NUM);
      g.fillText(text, w / 2 + 12, mid + 4, w - 100);
    }
  }
  return c;
}
