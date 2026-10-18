import type { GameMargin, GameTower } from "./types";

/**
 * Walls on the rise: how far each keep's wall stands from the next rung up.
 * Pure display geometry over what the backend already decided (the tier, and
 * the margins from `margins_v1`, which measure the stored ratio against the
 * tier lines). Nothing here changes a tier or scores anything. It is a
 * distance on the last stored statements, and it can move either way with the
 * next report, so the weaker line is kept on the gauge too.
 */

export const WALL_RUNGS = ["rotted", "timber", "brick", "granite", "basalt"] as const;
export type WallRung = (typeof WALL_RUNGS)[number];

export const isRung = (w: string): w is WallRung => (WALL_RUNGS as readonly string[]).includes(w);

export interface WallRise {
  rung: WallRung;
  /** 0 (rotted) to 4 (basalt). */
  rungIndex: number;
  /** The rung above, or null at the top. */
  next: WallRung | null;
  /** climbing: a ratio with a line above it. top: nothing stronger. unmeasured: no ratio stored to measure. */
  kind: "climbing" | "top" | "unmeasured";
  /** 0..1 across the current rung's band toward the next line; null when the band has no lower edge or nothing is stored. */
  progress: number | null;
  /** The backend's plain sentence for the distance to the next rung. */
  gapText: string | null;
  /** The backend's sentence when thin interest cover is holding the wall down a tier. */
  heldBack: string | null;
  /** True when the number sits close to the line of a weaker rung. */
  slipping: boolean;
}

const num = (s: string): number => Number(s);

function bandProgress(value: string, weak: string, strong: string): number | null {
  const v = num(value);
  const w = num(weak);
  const s = num(strong);
  if (![v, w, s].every(Number.isFinite)) return null;
  const span = Math.abs(s - w);
  if (span === 0) return null;
  return Math.min(1, Math.max(0, Math.abs(v - w) / span));
}

/** The rise for a keep's wall, or null when the wall has no rung (fund, bullion, granary, never surveyed). */
export function wallRise(t: Pick<GameTower, "structure" | "wall" | "wall_margins">): WallRise | null {
  if (t.structure !== "keep" || !isRung(t.wall)) return null;
  const rung = t.wall;
  const rungIndex = WALL_RUNGS.indexOf(rung);
  const margins: GameMargin[] = t.wall_margins ?? [];
  const main = margins.filter((m) => m.metric !== "interest_coverage");
  const cover = margins.find((m) => m.metric === "interest_coverage" && m.direction === "stronger");
  const up = main.find((m) => m.direction === "stronger");
  const down = main.find((m) => m.direction === "weaker");
  const slipping = margins.some((m) => m.direction === "weaker" && m.near);
  const base = { rung, rungIndex, heldBack: cover ? cover.text : null, slipping };

  if (rung === "basalt" || (up === undefined && down !== undefined)) {
    return { ...base, next: null, kind: "top", progress: 1, gapText: null };
  }
  if (up === undefined) {
    return { ...base, next: WALL_RUNGS[rungIndex + 1] ?? null, kind: "unmeasured", progress: null, gapText: null };
  }
  const next: WallRung = isRung(up.to_tier) ? up.to_tier : (WALL_RUNGS[rungIndex + 1] ?? rung);
  const progress = down ? bandProgress(up.value, down.boundary, up.boundary) : null;
  return { ...base, next, kind: "climbing", progress, gapText: up.text };
}

export interface RiseRow {
  tower: GameTower;
  rise: WallRise;
}

/** Keeps that have a rung, closest to the next rung first, then those with no band to read, then the top rung. */
export function riseRows(towers: GameTower[]): RiseRow[] {
  const order = (r: WallRise): number => (r.kind === "climbing" ? (r.progress === null ? 1 : 0) : r.kind === "unmeasured" ? 2 : 3);
  return towers
    .flatMap((tower) => {
      const rise = wallRise(tower);
      return rise ? [{ tower, rise }] : [];
    })
    .sort((a, b) => {
      const d = order(a.rise) - order(b.rise);
      if (d !== 0) return d;
      return (b.rise.progress ?? 0) - (a.rise.progress ?? 0);
    });
}

const RUNG_WORD: Record<WallRung, string> = { rotted: "Rotted", timber: "Timber", brick: "Brick", granite: "Granite", basalt: "Basalt" };
export const rungWord = (r: WallRung): string => RUNG_WORD[r];

/** One plain line for the gauge and for screen readers. */
export function describeRise(r: WallRise): string {
  const now = `${RUNG_WORD[r.rung]} walls, rung ${r.rungIndex + 1} of ${WALL_RUNGS.length}`;
  if (r.kind === "top") return `${now}: the top rung.`;
  if (r.kind === "unmeasured") return `${now}. No ratio is stored to measure the way up, so the distance is not known.`;
  const next = r.next ? RUNG_WORD[r.next] : "the next rung";
  const gap = r.gapText ? ` ${r.gapText}` : "";
  return `${now}; next is ${next}.${gap}${r.slipping ? " It also sits close to the line of a weaker rung." : ""}`;
}
