/**
 * The practice company (starter level, #477 build step 1, #493): Pip's Lemonade, version 1, 2026-11-22.
 *
 * Made up end to end: a made-up name, made-up numbers, in made-up coins, so nothing reads as NOK or dollars and no real
 * company ever carries a made-up number (Faiz's decision 2 on #476; spec `docs/game/game3d-starter-level-spec-2026-11-22.md`
 * section 1). Every beat of the starter reads this one frozen table; no other module carries a practice number. A change to
 * any number is a new file (`practiceCompanyV2.ts`), never an edit of this one (CLAUDE.md rule 3).
 *
 * The tiers the yard shows (granite walls, a narrow moat, a bargain price) are not typed in by hand: `practiceTiers` works
 * them out from the numbers with the same thresholds the real fortress uses, so the practice can never teach a meaning the
 * real towers do not have. The thresholds are copied from `backend/app/domain/game_mapping/v1.py` (granite up to 1x a
 * year's earnings, brick up to 2.5x, timber up to 4x, interest cover under 3x drops one tier) and the land rule from
 * `backend/app/services/game/rules.py` (bargain below the low guess, discount below the middle, full price up to the high
 * guess, overpriced above it). A test pins both. Pure data and maths: no three.js, no React, no network.
 */

export const PRACTICE_COMPANY_VERSION = "v1";

/** Pip's Lemonade. Coins are a made-up money. */
export const PIP = {
  name: "Pip's Lemonade",
  what: "A lemonade stand by the park",
  /** The stand is cut into this many pieces; you own `owned` of them. */
  pieces: 10,
  owned: 1,
  /** Money left over in each of the last three years, oldest first. The last one is the year's earnings. */
  leftOver: [6, 8, 10] as const,
  /** What it owes: the loan for the stand. */
  owes: 5,
  cash: 0,
  /** Interest paid on the loan each year. */
  interest: 0.5,
  /** What stops others copying it: hard to copy, not impossible, so a narrow moat. */
  moatReason: "Gran's secret recipe",
  moat: "narrow" as const,
  /** What one piece is worth: a low, a middle and a high guess. Middle: about 10 years of last year's 10 coins, over 10 pieces. */
  worth: { low: 8, middle: 10, high: 12 },
  /** The price of one piece. */
  price: 7,
  /** The storm: every price falls by this share. */
  stormFall: 0.3,
  /** The second storm ("Play again" only, beat 6b): the fridge broke and Pip's borrowed this much for a new one. */
  secondStormBorrow: 10,
} as const;

/** The real v1 thresholds (backend/app/domain/game_mapping/v1.py). Copied, not shared, because the backend is Python. */
export const V1_WALL = {
  graniteMax: 1.0,
  brickMax: 2.5,
  timberMax: 4.0,
  weakCover: 3,
} as const;

export type PracticeWall = "basalt" | "granite" | "brick" | "timber" | "rotted";
export type PracticeLand = "bargain" | "discount" | "full_price" | "overpriced";

const ORDER: readonly PracticeWall[] = ["basalt", "granite", "brick", "timber", "rotted"];

/**
 * The wall by the real non-financial rule: net cash is basalt; debt with no positive earnings is rotted; otherwise the
 * net debt against one year's earnings picks the tier, and interest cover under 3x drops it one tier (never below rotted).
 */
export function wallFor(netDebt: number, earnings: number, interest: number): PracticeWall {
  if (netDebt <= 0) return "basalt";
  if (earnings <= 0) return "rotted";
  const ratio = netDebt / earnings;
  let wall: PracticeWall = ratio <= V1_WALL.graniteMax ? "granite" : ratio <= V1_WALL.brickMax ? "brick" : ratio <= V1_WALL.timberMax ? "timber" : "rotted";
  if (interest > 0 && earnings / interest < V1_WALL.weakCover) wall = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(wall) + 1)];
  return wall;
}

/** The land by the real rule: below the low guess is a bargain, below the middle a discount, up to the high full price. */
export function landFor(price: number, worth: { low: number; middle: number; high: number }): PracticeLand {
  if (price < worth.low) return "bargain";
  if (price < worth.middle) return "discount";
  if (price <= worth.high) return "full_price";
  return "overpriced";
}

/** Rounded to one decimal, so 7 x 0.7 reads 4.9 and never 4.8999999. */
const tenth = (n: number): number => Math.round(n * 10) / 10;

export interface PracticeTiers {
  wall: PracticeWall;
  moat: typeof PIP.moat;
  land: PracticeLand;
  /** The price of one piece, in coins. */
  price: number;
  /** Room to be wrong: the middle guess less the price, in coins and as a share of the middle guess. */
  room: number;
  roomShare: number;
  owes: number;
  worth: { low: number; middle: number; high: number };
}

/** What the real rules make of Pip's numbers: before the storm, after it, and after the second storm. */
export function practiceTiers(when: "calm" | "storm" | "secondStorm" = "calm"): PracticeTiers {
  const earnings = PIP.leftOver[PIP.leftOver.length - 1];
  const borrowed = when === "secondStorm" ? PIP.secondStormBorrow : 0;
  const owes = PIP.owes + borrowed;
  // The loan carries the same rate after the second storm: 0.5 on 5 is a tenth of what is owed.
  const interest = tenth((PIP.interest / PIP.owes) * owes);
  // New money owed comes off what the whole stand is worth, shared over the pieces.
  const less = borrowed / PIP.pieces;
  const worth = { low: PIP.worth.low - less, middle: PIP.worth.middle - less, high: PIP.worth.high - less };
  const price = when === "calm" ? PIP.price : tenth(PIP.price * (1 - PIP.stormFall));
  const room = tenth(worth.middle - price);
  return {
    wall: wallFor(owes - PIP.cash, earnings, interest),
    moat: PIP.moat,
    land: landFor(price, worth),
    price,
    room,
    roomShare: tenth(room / worth.middle),
    owes,
    worth,
  };
}
