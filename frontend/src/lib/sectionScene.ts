import type { RealmLevel } from "./realmVerdict";
import type { NightWatchState, NightWatchStatus, FortressVaultLevel } from "./types";
import type { WallRung } from "./wallRise";

/**
 * Pure mappings for the pictures under the Fortress scene (2026-10-29). Each takes a value the
 * backend already decided and returns a shape; none computes a financial figure. Unknown is always
 * its own look (a blank flag, a cold bowl, an empty vault with a "?"), never a default-good draw.
 */

export type PennantShape = "straight" | "swallow" | "torn" | "blank";

/** The flag the Great Keep flies for the verdict on the whole fortress. Shape carries the level (colour is never alone). */
export function pennantFor(level: RealmLevel): { shape: PennantShape; tone: string; label: string } {
  switch (level) {
    case "sound":
      return { shape: "straight", tone: "text-ink-muted", label: "No rule flags" };
    case "mixed":
      return { shape: "swallow", tone: "text-caution", label: "Mixed" };
    case "attention":
      return { shape: "torn", tone: "text-negative", label: "Needs a look" };
    default:
      return { shape: "blank", tone: "text-ink-faint", label: "Cannot judge yet" };
  }
}

export type BeaconState = "lit" | "alert" | "out";

/** The brazier on the watch turret. A watch that has not reported on time is never drawn lit: "out" shows a cold bowl. */
export function beaconFor(status: NightWatchStatus, watchState: NightWatchState): BeaconState {
  if (watchState !== "ok" || status === "unknown") return "out";
  return status === "attention" ? "alert" : "lit";
}

/** The picture id for a wall rung's bastion (the same material the scene draws). */
export function bastionId(rung: WallRung): `bastion-${WallRung}` {
  return `bastion-${rung}`;
}

/** How high the gold stands inside the vault opening, 0 to 1. Decided by the backend's level; "unsurveyed" is fog, not zero gold. */
export const VAULT_FILL: Record<FortressVaultLevel, number> = {
  deep: 1,
  stocked: 0.66,
  thin: 0.33,
  empty: 0.04,
  unsurveyed: 0,
};

export function vaultScene(level: FortressVaultLevel): { fill: number; fog: boolean } {
  return { fill: VAULT_FILL[level], fog: level === "unsurveyed" };
}

/** Account pips for "n of m accounts have a cash figure": filled count, hollow count, capped so a long list stays one row. */
export function accountPips(withCash: number, total: number, cap = 12): { filled: number; hollow: number; more: number } {
  const t = Math.max(0, total);
  const shown = Math.min(t, cap);
  const filled = Math.min(Math.max(0, withCash), shown);
  return { filled, hollow: shown - filled, more: t - shown };
}

// --- Spread of the realm ----------------------------------------------------------------------

export interface SkylineTower {
  x: number;
  w: number;
  h: number;
  /** A holding with no weight stored: drawn as fog at an average width, never as zero or as small. */
  fog: boolean;
}

export interface SpreadScene {
  towers: SkylineTower[];
  /** Span of the five largest, or null with fewer than two weighted holdings. */
  topFive: { x: number; w: number } | null;
  /** Equal outline towers: how many equal holdings the portfolio behaves like. Null when unknown. */
  ghosts: { x: number; w: number }[] | null;
  /** Holdings beyond the drawn towers, shown as a count of huts rather than slivers. */
  tail: number;
  unweighted: number;
}

const SKY_W = 300;
const GAP = 3;
const MAX_TOWERS = 12;

/** Width of each tower is its share of the weighted total (with a floor so a small one stays visible), height follows the
 * share too; the largest is leftmost. The ghost row is `effective` equal towers across the same width: the gap between the two
 * rows is the concentration. Pure; the weights and the effective count come from the backend. */
export function spreadScene(weights: (number | null)[], effective: number | null): SpreadScene {
  const weighted = weights.filter((w): w is number => w !== null && Number.isFinite(w) && w > 0).sort((a, b) => b - a);
  const unweighted = weights.length - weighted.length;
  const drawn = weighted.slice(0, MAX_TOWERS);
  const tail = weights.length - drawn.length - unweighted;
  const total = drawn.reduce((a, b) => a + b, 0);
  const slots = drawn.length + (unweighted > 0 ? 1 : 0);
  if (slots === 0 || total === 0) return { towers: [], topFive: null, ghosts: null, tail: 0, unweighted };
  const usable = SKY_W - GAP * (slots - 1);
  const avg = usable / slots;
  const raw = drawn.map((w) => Math.max(8, (w / total) * usable * 0.85));
  const scale = Math.min(1, (usable - (unweighted > 0 ? avg : 0)) / raw.reduce((a, b) => a + b, 0));
  const max = drawn[0] ?? 1;
  const towers: SkylineTower[] = [];
  let x = 0;
  drawn.forEach((w, i) => {
    const wd = raw[i] * scale;
    towers.push({ x, w: wd, h: 14 + 34 * (w / max), fog: false });
    x += wd + GAP;
  });
  if (unweighted > 0) towers.push({ x, w: avg, h: 30, fog: true });
  const five = towers.filter((t) => !t.fog).slice(0, 5);
  const topFive = five.length >= 2 ? { x: five[0].x, w: five[five.length - 1].x + five[five.length - 1].w - five[0].x } : null;
  let ghosts: SpreadScene["ghosts"] = null;
  if (effective !== null && Number.isFinite(effective) && effective > 0) {
    const n = Math.min(MAX_TOWERS, Math.max(1, Math.round(effective)));
    const gw = (SKY_W - GAP * (n - 1)) / n;
    ghosts = Array.from({ length: n }, (_, i) => ({ x: i * (gw + GAP), w: gw }));
  }
  return { towers, topFive, ghosts, tail: Math.max(0, tail), unweighted };
}

export const SKYLINE_WIDTH = SKY_W;
