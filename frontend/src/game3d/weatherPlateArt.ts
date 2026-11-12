/**
 * The Weather Tower's wall plates (2026-11-12, issue #402). Replaces the round clock faces and the little DOM tags.
 *
 * Faiz did not like the clocks or the way the text was shown: every face looked the same, no face said what it was, and
 * the numbers sat in a narrow sticky note you only got by standing next to a dial. Now every series wears a parchment
 * plate that always shows its name and its number in big type, the last 24 months as a line, and a "low .. high" bar with
 * a dot for where today sits. Pure drawing on a 2D canvas context (no three.js, no React), so the words and the shapes are
 * testable. The numbers all come from the layout (`weatherTowerRoom.ts`), which takes them from `lib/format.ts`.
 *
 * Nothing here says good or bad. State is told by shape and word, never colour alone: no reading = dashed rim and
 * "No reading"; stale = a slate tab that says "stale" and a dimmed number.
 */
import type { DialPlan } from "./weatherTowerRoom";
import { WEATHER_WORDS } from "./weatherTowerWordsV2";

export const PLATE_PX = { w: 400, h: 338 } as const;
export const POST_PX = { w: 240, h: 128 } as const;
export const BANNER_PX = { w: 1024, h: 160 } as const;

const PAPER = "#F6EFE0";
const PAPER_EMPTY = "#D9D8E4";
const INK_TEXT = "#2a1a06";
const SOFT = "#5a4a30";
const RIM = "#8a6a32";
const GOLD = "#E3B341";
const OUTLINE = "#26253B";
const SLATE = "#3b3d57";
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type Measure = (text: string) => number;

/** Breaks `text` into at most `maxLines` lines no wider than `maxW`, by whole words. Returns null if it cannot fit. */
export function wrapWords(text: string, maxW: number, maxLines: number, measure: Measure): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next) <= maxW) {
      line = next;
    } else if (!line) {
      return null;
    } else {
      lines.push(line);
      line = w;
      if (measure(line) > maxW) return null;
    }
  }
  if (line) lines.push(line);
  return lines.length <= maxLines ? lines : null;
}

/** The plate's words, split out of a dial's readout so the drawing and the tests agree on them. */
export interface PlateText {
  name: string;
  value: string;
  changes: string;
  stale: boolean;
  empty: boolean;
}

export function plateText(d: Pick<DialPlan, "readout" | "state">): PlateText {
  const [name = "", rawValue = "", changes = ""] = d.readout;
  const suffix = ` (${WEATHER_WORDS.stale})`;
  const value = rawValue.endsWith(suffix) ? rawValue.slice(0, -suffix.length) : rawValue;
  return { name, value, changes: d.state === "empty" ? "" : changes.replace(/\s{2,}/g, "   "), stale: d.state === "stale", empty: d.state === "empty" };
}

function rimPath(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number) {
  ctx.beginPath();
  ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, 16);
}

function paper(ctx: CanvasRenderingContext2D, w: number, h: number, empty: boolean, lit: boolean) {
  ctx.fillStyle = OUTLINE;
  rimPath(ctx, w, h, 0);
  ctx.fill();
  ctx.fillStyle = lit ? GOLD : RIM;
  rimPath(ctx, w, h, 4);
  ctx.fill();
  ctx.fillStyle = empty ? PAPER_EMPTY : PAPER;
  rimPath(ctx, w, h, lit ? 14 : 11);
  ctx.fill();
  if (empty) {
    ctx.save();
    ctx.setLineDash([14, 9]);
    ctx.strokeStyle = SOFT;
    ctx.lineWidth = 3;
    rimPath(ctx, w, h, 20);
    ctx.stroke();
    ctx.restore();
  }
}

/** Largest font (px, bold) from `sizes` at which `text` fits in `maxLines` lines of `maxW`; falls back to the smallest, clipped by a trailing cut. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, sizes: readonly number[]): { size: number; lines: string[] } {
  for (const size of sizes) {
    ctx.font = `700 ${size}px ${FONT}`;
    const lines = wrapWords(text, maxW, maxLines, (t) => ctx.measureText(t).width);
    if (lines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = `700 ${size}px ${FONT}`;
  return { size, lines: [text] };
}

export function drawPlate(ctx: CanvasRenderingContext2D, d: DialPlan, lit: boolean): void {
  const { w, h } = PLATE_PX;
  const t = plateText(d);
  ctx.clearRect(0, 0, w, h);
  paper(ctx, w, h, t.empty, lit);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Name: up to two lines, never cut.
  const name = fitText(ctx, t.name, w - 64, 2, [30, 27, 24, 21]);
  ctx.fillStyle = INK_TEXT;
  ctx.font = `700 ${name.size}px ${FONT}`;
  const nameTop = 52;
  name.lines.forEach((line, i) => ctx.fillText(line, w / 2, nameTop + i * (name.size + 4)));

  // The number, big. No reading says so in words.
  ctx.fillStyle = t.stale ? SOFT : INK_TEXT;
  const value = fitText(ctx, t.value, w - 70, 1, t.empty ? [34, 28] : [68, 58, 48, 40]);
  ctx.font = `700 ${value.size}px ${FONT}`;
  ctx.fillText(value.lines[0], w / 2, 150);

  if (t.changes) {
    ctx.fillStyle = SOFT;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(t.changes, w / 2, 184);
  }

  const frac = d.fraction;
  if (d.trace.length >= 2 && !t.empty) {
    // The last 24 months as a line, left to right, with today as its last point.
    const x0 = 40;
    const x1 = w - 40;
    const y0 = 204;
    const y1 = 246;
    ctx.strokeStyle = INK_TEXT;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    d.trace.forEach(([tx, ty], i) => {
      const px = x0 + ((tx + 0.75) / 1.5) * (x1 - x0);
      const py = y1 - (ty / 0.5) * (y1 - y0);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  if (frac !== null && !t.empty) {
    // The range bar: low on the left, high on the right, a dot where today sits.
    const bx0 = 40;
    const bx1 = w - 40;
    const by = 270;
    ctx.fillStyle = "#cdbf9f";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx0, by - 5, bx1 - bx0, 10, 5);
    ctx.fill();
    ctx.stroke();
    const cx = bx0 + Math.min(1, Math.max(0, frac)) * (bx1 - bx0);
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(cx, by, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(cx, by, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SOFT;
    ctx.font = `600 19px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(WEATHER_WORDS.low, bx0, 312);
    ctx.textAlign = "right";
    ctx.fillText(WEATHER_WORDS.high, bx1, 312);
    ctx.textAlign = "center";
  }

  if (t.stale) {
    // A slate tab hung over the top rim: shape and word, not colour.
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.roundRect(w - 118, 0, 104, 34, [0, 0, 10, 10]);
    ctx.fill();
    ctx.fillStyle = SLATE;
    ctx.beginPath();
    ctx.roundRect(w - 115, 0, 98, 30, [0, 0, 8, 8]);
    ctx.fill();
    ctx.fillStyle = "#F6EFE0";
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(WEATHER_WORDS.stale, w - 66, 23);
  }
}

/** A small plate for one post of the curve rail: the maturity and the yield. */
export function drawPost(ctx: CanvasRenderingContext2D, tenor: string, text: string, stale: boolean): void {
  const { w, h } = POST_PX;
  ctx.clearRect(0, 0, w, h);
  paper(ctx, w, h, false, false);
  ctx.textAlign = "center";
  ctx.fillStyle = SOFT;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(tenor, w / 2, 52);
  ctx.fillStyle = stale ? SOFT : INK_TEXT;
  const v = fitText(ctx, text, w - 40, 1, [44, 38, 32]);
  ctx.font = `700 ${v.size}px ${FONT}`;
  ctx.fillText(v.lines[0], w / 2, 100);
  if (stale) {
    ctx.fillStyle = SLATE;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(WEATHER_WORDS.stale, w / 2, 121);
  }
}

/** A wide banner with one big line and, optionally, one smaller line under it. */
export function drawBanner(ctx: CanvasRenderingContext2D, big: string, small: string | null): void {
  const { w, h } = BANNER_PX;
  ctx.clearRect(0, 0, w, h);
  paper(ctx, w, h, false, false);
  ctx.textAlign = "center";
  ctx.fillStyle = INK_TEXT;
  const b = fitText(ctx, big, w - 80, 1, small ? [64, 54, 46] : [84, 70, 58]);
  ctx.font = `700 ${b.size}px ${FONT}`;
  ctx.fillText(b.lines[0], w / 2, small ? 78 : 104);
  if (small) {
    ctx.fillStyle = SOFT;
    const s = fitText(ctx, small, w - 80, 1, [36, 30, 26]);
    ctx.font = `600 ${s.size}px ${FONT}`;
    ctx.fillText(s.lines[0], w / 2, 126);
  }
}
