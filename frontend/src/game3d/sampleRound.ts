/**
 * The sample round (Morning Round step 4, #412). Pure, no React, no storage, no clock (`nowMs` is passed in).
 *
 * The sample fortress shows a made-up round so every mark and the round can be seen without real data. Demo wins both ways:
 * nothing real reaches it (this file takes towers and stall names only, never ravens, wires, the Night Watch or the
 * watchlist's statuses), and nothing from it reaches the real browser keys (the page keeps sample ticks in memory only).
 * Marks go on fixed yard holdings in order (smoke, bell, raven), so the same fortress always shows the same round.
 * "All quiet" is never said here: the sample always has something to do, and a sample source that is not read says so.
 */
import { holdingMarks } from "./marks";
import type { HoldingMarks } from "./marks";
import { buildRound } from "./round";
import type { Round, RoundFacts } from "./round";
import type { TowerView } from "./stateToWorld";

export const SAMPLE_WIRE = "sample-wire";
export const SAMPLE_RAVEN = "sample-raven";
export const SAMPLE_DAY = "sample-day";
export const SAMPLE_SHEETS = 2;

export interface SampleStall {
  holdingId: string;
  ticker: string;
}

/** The holdings that carry the sample marks: yard holdings in order, smoke first, then bell, then raven. */
function picks(towers: readonly TowerView[]): { smoke: string | null; bell: string | null; raven: string | null } {
  const yard = towers.filter((t) => t.plot !== undefined);
  const at = (i: number) => (yard.length === 0 ? null : yard[i % yard.length].holdingId);
  return { smoke: at(0), bell: at(1), raven: at(2) };
}

export function sampleMarks(towers: readonly TowerView[]): HoldingMarks {
  const p = picks(towers);
  const m = holdingMarks(towers, {
    recentRavenHoldingIds: new Set(p.raven ? [p.raven] : []),
    unseenWireHoldingIds: new Set(p.smoke ? [p.smoke] : []),
    wiresUnmatched: 0,
    watchState: "ok",
    stallsRead: true,
  });
  // The bell is the sample's own, never a real "review" thesis.
  const byHolding = new Map([...m.byHolding].map(([id, v]) => [id, { ...v, bell: id === p.bell }] as const));
  // Sample marks stand on yard holdings only, so nothing is off the yard.
  return { ...m, byHolding, offYard: [] };
}

/** The first stall of the sample street is the lit one (ids and ticker only). */
export function sampleLit(stalls: readonly SampleStall[]): SampleStall[] {
  return stalls.slice(0, 1);
}

export function sampleRoundFacts(towers: readonly TowerView[], stalls: readonly SampleStall[]): RoundFacts {
  const p = picks(towers);
  const ravenFacts = new Map<string, string>(p.raven ? [[p.raven, SAMPLE_RAVEN]] : []);
  const wireFacts = new Map<string, string>(p.smoke ? [[p.smoke, SAMPLE_WIRE]] : []);
  return {
    towers,
    marks: sampleMarks(towers),
    ravenFacts,
    wireFacts,
    lit: sampleLit(stalls),
    noticeSheets: SAMPLE_SHEETS,
    noticeDay: SAMPLE_DAY,
  };
}

export function sampleRound(
  towers: readonly TowerView[],
  stalls: readonly SampleStall[],
  done: ReadonlySet<string>,
  nowMs: number,
  carry: Parameters<typeof buildRound>[2] = [],
): Round {
  return buildRound(sampleRoundFacts(towers, stalls), { done, since: null, nowMs }, carry);
}
