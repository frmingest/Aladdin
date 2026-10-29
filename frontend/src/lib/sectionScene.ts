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
