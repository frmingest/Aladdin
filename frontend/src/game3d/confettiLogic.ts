/**
 * Confetti maths (S8). Pure and allocation-light: one fixed set of pieces from a fixed seed,
 * a position at a given age. No texture, no data, no red or green (so no piece can read as a status).
 */
export const CONFETTI_COUNT = 150;
export const CONFETTI_SECONDS = 3;
export const CONFETTI_COLOURS = ["#0CA5B0", "#F2C14E", "#FFFFFF", "#5B8DEF"] as const;
const GRAVITY = 9;

export interface Piece {
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  size: number;
  colour: number;
}

/** Tiny seeded generator so every burst looks the same and tests are stable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePieces(count = CONFETTI_COUNT): Piece[] {
  const r = rng(20261031);
  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const angle = r() * Math.PI * 2;
    const out_ = 1 + r() * 3.2;
    out.push({
      vx: Math.cos(angle) * out_,
      vz: Math.sin(angle) * out_,
      vy: 6 + r() * 5,
      spin: (r() - 0.5) * 14,
      size: 0.12 + r() * 0.1,
      colour: Math.floor(r() * CONFETTI_COLOURS.length),
    });
  }
  return out;
}

/** Height above the start after `age` seconds; the floor is y = 0 relative to the start, never below. */
export function heightAt(p: Piece, age: number): number {
  return Math.max(-1.5, p.vy * age - 0.5 * GRAVITY * age * age);
}

export function burstActive(age: number): boolean {
  return age >= 0 && age < CONFETTI_SECONDS;
}
