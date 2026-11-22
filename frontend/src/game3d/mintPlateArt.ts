/**
 * The Royal Mint's wall plates (2026-11-15, issue #413). Pure drawing on a 2D canvas context (no three.js, no React), in the same
 * parchment style as the Weather Tower's plates (it reuses their paper, rim and text fitting). Every word and every figure is
 * handed in already decided (`mintRoom.ts` picks them from the backend's answer); nothing is worked out here.
 *
 * State is told by shape and word, never colour alone: the direction wears its own mark (a filled or open triangle or a
 * diamond) beside the word; a holding the engine could not model has a dashed rim and says "Not modelled"; an answer that
 * no longer matches the levers wears a slate tab that says "stale".
 */
import type { PlateText } from "./mintRoomLogic";
import { MINT_WORDS } from "./mintWordsV1";
import { BANNER_PX, PLATE_PX, fitText, paper, wrapWords } from "./weatherPlateArt";

export { BANNER_PX, PLATE_PX };

const INK_TEXT = "#2a1a06";
const SOFT = "#5a4a30";
const SLATE = "#3b3d57";
const PAPER = "#F6EFE0";
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Most lines of small print under the verdict. */
export const MAX_SMALL_LINES = 4;

export function drawMintPlate(ctx: CanvasRenderingContext2D, p: PlateText, stale: boolean): void {
  const { w, h } = PLATE_PX;
  ctx.clearRect(0, 0, w, h);
  paper(ctx, w, h, p.mark === "unmodelled", false);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Name: up to two lines, never cut.
  const name = fitText(ctx, p.name, w - 64, 2, [30, 27, 24, 21]);
  ctx.fillStyle = INK_TEXT;
  ctx.font = `700 ${name.size}px ${FONT}`;
  name.lines.forEach((line, i) => ctx.fillText(line, w / 2, 52 + i * (name.size + 4)));

  // The verdict: mark and word, big.
  ctx.fillStyle = stale ? SOFT : INK_TEXT;
  const verdict = fitText(ctx, p.verdict, w - 70, 1, p.mark === "unmodelled" ? [34, 28] : [50, 44, 38, 32]);
  ctx.font = `700 ${verdict.size}px ${FONT}`;
  ctx.fillText(verdict.lines[0], w / 2, 150);

  // Small print: ranges (only when the backend allowed them) or the reason. Wrapped by whole words, clipped to a few lines.
  ctx.fillStyle = SOFT;
  ctx.font = `600 21px ${FONT}`;
  const measure = (t: string) => ctx.measureText(t).width;
  const rows: string[] = [];
  for (const line of p.lines) {
    const wrapped = wrapWords(line, w - 56, MAX_SMALL_LINES, measure);
    rows.push(...(wrapped ?? [line]));
  }
  rows.slice(0, MAX_SMALL_LINES).forEach((row, i) => ctx.fillText(row, w / 2, 192 + i * 28));

  if (stale) {
    ctx.fillStyle = SLATE;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 70, h - 54, 140, 34, 10);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(MINT_WORDS.stale, w / 2, h - 30);
  }
}

/**
 * A wide board for the Mint: one big line that wraps to two (and shrinks down to a small size) before it is ever cut, and an optional
 * smaller line under it. The Weather Tower's banner keeps to one line; the Mint's banners carry sentences ("A game of consequences...",
 * a lever's notch in words), so they need the room.
 */
/**
 * The name board over one lever (#480). Twice as tall as a banner for the same width, so the lever's name can be drawn
 * about two and a half times bigger: on an 800 px wide screen the banner's 64 px name came out a few pixels high.
 */
export const LEVER_BOARD_PX = { w: 1024, h: 320 } as const;

/** Sizes tried for the lever's name (one line), then for its readout ("At rest", a notch). */
export const LEVER_NAME_SIZES = [150, 132, 116, 100, 86, 72] as const;
export const LEVER_READOUT_SIZES = [96, 84, 72, 60, 50] as const;

export function drawLeverBoard(ctx: CanvasRenderingContext2D, name: string, readout: string): { nameSize: number; readoutSize: number } {
  const { w, h } = LEVER_BOARD_PX;
  ctx.clearRect(0, 0, w, h);
  paper(ctx, w, h, false, false);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const n = fitText(ctx, name, w - 70, 1, LEVER_NAME_SIZES);
  const r = fitText(ctx, readout, w - 90, 1, LEVER_READOUT_SIZES);
  const gap = 18;
  const top = (h - (n.size + gap + r.size)) / 2;
  ctx.fillStyle = INK_TEXT;
  ctx.font = `700 ${n.size}px ${FONT}`;
  ctx.fillText(n.lines[0] ?? name, w / 2, top + n.size * 0.9);
  ctx.fillStyle = SOFT;
  ctx.font = `600 ${r.size}px ${FONT}`;
  ctx.fillText(r.lines[0] ?? readout, w / 2, top + n.size + gap + r.size * 0.9);
  return { nameSize: n.size, readoutSize: r.size };
}

export function drawMintBanner(ctx: CanvasRenderingContext2D, big: string, small: string | null): void {
  const { w, h } = BANNER_PX;
  ctx.clearRect(0, 0, w, h);
  paper(ctx, w, h, false, false);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK_TEXT;
  const b = fitText(ctx, big, w - 90, small ? 1 : 2, small ? [64, 54, 46, 40, 34] : [72, 60, 50, 42, 36, 30, 26]);
  ctx.font = `700 ${b.size}px ${FONT}`;
  const smallFit = small ? fitText(ctx, small, w - 90, 2, [38, 32, 28, 24, 21]) : null;
  const bigH = b.lines.length * (b.size + 6);
  const smallH = smallFit ? smallFit.lines.length * (smallFit.size + 6) + 6 : 0;
  const top = (h - (bigH + smallH)) / 2;
  ctx.font = `700 ${b.size}px ${FONT}`;
  b.lines.forEach((line, i) => ctx.fillText(line, w / 2, top + b.size + i * (b.size + 6)));
  if (smallFit) {
    ctx.fillStyle = SOFT;
    ctx.font = `600 ${smallFit.size}px ${FONT}`;
    const smallTop = top + bigH + 6;
    smallFit.lines.forEach((line, i) => ctx.fillText(line, w / 2, smallTop + smallFit.size + i * (smallFit.size + 6)));
  }
}
