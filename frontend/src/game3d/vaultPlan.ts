/**
 * The Vault chest east of the keep door (3D sprint S16, PR 1). Pure data and maths, no three.js and no React.
 *
 * The flat Fortress has a Vault card (cash you typed in, drawn as a cutaway) and a Temperament meter. In 3D they
 * become one chest you walk up to; press E and the SAME two cards open in a world panel. Nothing is copied: the
 * words, the numbers and the one write (update cash, `PATCH /accounts/{id}`) are the flat page's own components.
 *
 * The chest is code-built and carries exactly one fact: how many coin stacks sit on its lid, chosen from the
 * level the backend already decided (`vault.level`). This file never works out a level, an amount or a share.
 * An unentered cash figure stays fog: a plain chest with a "?" plate, never an empty-looking one.
 */
import { yawToward } from "./npcs";
import type { FortressVaultLevel } from "../lib/types";

/**
 * East of the keep door, in front of the keep like the writing desk on the west side. It stands nearer the door than
 * the desk does on purpose: further east it falls inside the reach of the tower pad at (15, -13.5), and E would take
 * you into that tower instead (found in a screenshot; `vaultPlan.test.ts` now checks every door's reach).
 */
export const VAULT = { x: 6, z: -16.5 } as const;
/** The chest faces the middle of the courtyard, like the desk and the people do. */
export const VAULT_FACING = yawToward(VAULT, { x: 0, z: 0 });

export const VAULT_RANGE = 3.4;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const VAULT_LEAVE_RANGE = 4.6;
/** Half the footprint of the chest you walk round. */
export const VAULT_SOLID = { hx: 1.3, hz: 0.9 } as const;

/** The lid holds at most this many stacks. */
export const MAX_STACKS = 6;

/** Stacks per level. Same ladder as the flat picture's fill (deep, stocked, thin, empty); "unsurveyed" has no coins. */
const STACKS: Record<FortressVaultLevel, number> = {
  deep: MAX_STACKS,
  stocked: 4,
  thin: 2,
  empty: 0,
  unsurveyed: 0,
};

/** How many coin stacks stand on the lid. An unreadable or unknown level shows none. */
export function coinStacks(level: FortressVaultLevel | null | undefined): number {
  if (level === null || level === undefined) return 0;
  return STACKS[level] ?? 0;
}

/** True when the chest must say it does not know: no level, or cash never entered. */
export function vaultUnknown(level: FortressVaultLevel | null | undefined): boolean {
  return level === null || level === undefined || level === "unsurveyed";
}

export interface StackSlot {
  /** Across the lid, centred on the chest. */
  x: number;
  /** Along the lid. */
  z: number;
  /** A few coins to a stack; fixed by slot, never data. */
  coins: number;
}

const COIN_COUNTS = [5, 4, 6, 3, 5, 4] as const;

/** Fixed slots, filled in the same order whatever the count, so a fuller vault adds stacks and never rearranges. */
export function stackSlots(count: number): StackSlot[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.min(MAX_STACKS, Math.floor(count))) : 0;
  return Array.from({ length: n }, (_, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return { x: -0.7 + col * 0.7, z: -0.18 + row * 0.42, coins: COIN_COUNTS[i] };
  });
}

export function nearVault(pos: { x: number; z: number }, range: number = VAULT_RANGE): boolean {
  return Math.hypot(VAULT.x - pos.x, VAULT.z - pos.z) <= range;
}
