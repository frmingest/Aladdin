import { SIEGE_LABEL, TEMPERAMENT_LABEL, VAULT_LABEL, needsAttention } from "./fortress";
import type { GameState, GameTower } from "./types";

/**
 * The verdict on the whole fortress (2026-10-01): what you read when you
 * press the Great Keep or the walls instead of one tower.
 *
 * It is a reading aid over categories the backend has already decided
 * (wall, moat, freshness, land, thesis, weather, vault, temperament). It does
 * not recompute a wall, price or score, calls no provider or model, and never
 * says to buy, sell, add or trim. "Unknown" stays unknown: a tower that was
 * never surveyed counts as unknown, not as sound or as weak.
 *
 * Shares are sums of each tower's `weight_pct` (a percentage of the portfolio).
 * The thresholds are below and are shown to the reader in the card, so the
 * verdict can be checked line by line. They are version 1; a change to them
 * is a new version, not an in-place edit.
 */

export const REALM_RULES_VERSION = "realm-v1";

export const REALM_RULES = {
  /** Timber or rotted walls: this share of the portfolio or more = needs a look first. */
  weakWallAttentionPct: 20,
  /** Towers with no moat: this share or more = needs a look first. */
  noMoatAttentionPct: 40,
  /** Old (overgrown) analyses: this share or more = mixed. */
  staleMixedPct: 25,
  /** Priced above the bull case: this share or more = mixed. */
  dearMixedPct: 25,
  /** Never surveyed: this share or more = mixed. */
  unsurveyedMixedPct: 20,
  /** Never surveyed: this share or more = cannot judge (unless something else is definitely wrong). */
  unsurveyedUnknownPct: 50,
} as const;

export type RealmLevel = "attention" | "mixed" | "sound" | "unknown";
export type RealmTone = "good" | "watch" | "bad" | "unknown";

export interface RealmLine {
  id: string;
  tone: RealmTone;
  title: string;
  text: string;
}

export interface RealmLook {
  holdingId: string;
  name: string;
  weightPct: number | null;
  reasons: string[];
}

export interface RealmVerdict {
  level: RealmLevel;
  headline: string;
  /** One sentence for screen readers and the hover card. */
  oneLine: string;
  lines: RealmLine[];
  /** Towers to open first, biggest holding first. */
  lookFirst: RealmLook[];
  /** Count of stored analyst verdicts (Strong Buy, Buy, Hold, Sell, Avoid, Not analyzed). */
  analystMix: Array<{ rating: string; count: number }>;
  rulesVersion: string;
}

export const REALM_LEVEL_LABEL: Record<RealmLevel, string> = {
  attention: "Needs a look first",
  mixed: "Mixed",
  sound: "No rule flags",
  unknown: "Cannot judge yet",
};

const w = (t: GameTower): number => {
  if (t.weight_pct === null) return 0;
  const n = Number(t.weight_pct);
  return Number.isFinite(n) ? n : 0;
};

const pct = (n: number): string => `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`;

const unsurveyedTower = (t: GameTower): boolean => t.freshness === "unsurveyed" || t.wall === "unsurveyed";

/** Why a single tower is on the look-first list, in the same words as the Ledger's filter. */
export function lookReasons(t: GameTower): string[] {
  const out: string[] = [];
  if (t.thesis === "breached") out.push("a tripwire has fired");
  if (t.wall === "rotted") out.push("rotted walls");
  else if (t.wall === "timber") out.push("timber walls");
  if (t.moat === "none") out.push("no moat");
  if (t.freshness === "overgrown") out.push("analysis is stale");
  if (t.freshness === "unsurveyed") out.push("never analysed");
  return out;
}

const RATING_ORDER = ["Strong Buy", "Buy", "Hold", "Sell", "Avoid"];

export function summarizeRealm(state: GameState): RealmVerdict {
  const towers = state.towers;
  const total = towers.reduce((sum, t) => sum + w(t), 0);
  const share = (pred: (t: GameTower) => boolean): number =>
    total <= 0 ? 0 : towers.filter(pred).reduce((sum, t) => sum + w(t), 0);

  const strongWalls = share((t) => t.wall === "basalt" || t.wall === "granite");
  const brickWalls = share((t) => t.wall === "brick");
  const weakWalls = share((t) => t.wall === "timber" || t.wall === "rotted");
  const noWalls = share((t) => t.wall === "not_applicable");
  const unsurveyed = share(unsurveyedTower);
  const wideMoat = share((t) => t.moat === "wide");
  const narrowMoat = share((t) => t.moat === "narrow");
  const noMoat = share((t) => t.moat === "none");
  const fresh = share((t) => t.freshness === "fresh");
  const ageing = share((t) => t.freshness === "weathered");
  const stale = share((t) => t.freshness === "overgrown");
  const cheap = share((t) => t.land === "bargain" || t.land === "discount");
  const dear = share((t) => t.land === "overpriced");
  const breached = towers.filter((t) => t.thesis === "breached");
  const reviewing = towers.filter((t) => t.thesis === "review");
  const siege = state.siege?.level ?? "unsurveyed";
  const temperament = state.temperament?.level ?? "unsurveyed";
  const R = REALM_RULES;

  // --- level -----------------------------------------------------------------
  let level: RealmLevel;
  if (towers.length === 0 || total <= 0) {
    level = "unknown";
  } else if (
    breached.length > 0 ||
    weakWalls >= R.weakWallAttentionPct ||
    noMoat >= R.noMoatAttentionPct ||
    siege === "besieged"
  ) {
    level = "attention";
  } else if (unsurveyed >= R.unsurveyedUnknownPct) {
    level = "unknown";
  } else if (
    weakWalls > 0 ||
    noMoat > 0 ||
    stale >= R.staleMixedPct ||
    dear >= R.dearMixedPct ||
    unsurveyed >= R.unsurveyedMixedPct ||
    reviewing.length > 0 ||
    siege === "gathering" ||
    temperament === "restless" ||
    temperament === "rash"
  ) {
    level = "mixed";
  } else {
    level = "sound";
  }

  // --- lines -----------------------------------------------------------------
  const lines: RealmLine[] = [];

  const wallBits: string[] = [];
  if (strongWalls > 0) wallBits.push(`${pct(strongWalls)} behind basalt or granite`);
  if (brickWalls > 0) wallBits.push(`${pct(brickWalls)} behind brick`);
  if (weakWalls > 0) wallBits.push(`${pct(weakWalls)} behind timber or rotted walls`);
  if (noWalls > 0) wallBits.push(`${pct(noWalls)} in funds and gold, which have no balance-sheet wall`);
  if (unsurveyed > 0) wallBits.push(`${pct(unsurveyed)} not surveyed`);
  lines.push({
    id: "walls",
    tone: weakWalls >= R.weakWallAttentionPct ? "bad" : weakWalls > 0 ? "watch" : unsurveyed >= R.unsurveyedMixedPct ? "unknown" : "good",
    title: "Walls (balance sheets)",
    text: wallBits.length ? `${wallBits.join("; ")}.` : "No wall could be read.",
  });

  const moatBits: string[] = [];
  if (wideMoat > 0) moatBits.push(`${pct(wideMoat)} behind a wide moat`);
  if (narrowMoat > 0) moatBits.push(`${pct(narrowMoat)} behind a narrow moat`);
  if (noMoat > 0) moatBits.push(`${pct(noMoat)} with no moat`);
  const moatUnknown = share((t) => t.moat === "unsurveyed");
  if (moatUnknown > 0) moatBits.push(`${pct(moatUnknown)} not surveyed`);
  lines.push({
    id: "moat",
    tone: noMoat >= R.noMoatAttentionPct ? "bad" : noMoat > 0 ? "watch" : wideMoat + narrowMoat > 0 ? "good" : "unknown",
    title: "Moats (competitive position)",
    text: moatBits.length ? `${moatBits.join("; ")}.` : "No moat could be read.",
  });

  const ageBits: string[] = [];
  if (fresh > 0) ageBits.push(`${pct(fresh)} analysed recently`);
  if (ageing > 0) ageBits.push(`${pct(ageing)} with an ageing analysis`);
  if (stale > 0) ageBits.push(`${pct(stale)} with a stale analysis`);
  const never = share((t) => t.freshness === "unsurveyed");
  if (never > 0) ageBits.push(`${pct(never)} never analysed`);
  lines.push({
    id: "analysis",
    tone: stale >= R.staleMixedPct ? "watch" : never >= R.unsurveyedMixedPct ? "unknown" : stale > 0 ? "watch" : "good",
    title: "Analyses (how current)",
    text: ageBits.length ? `${ageBits.join("; ")}.` : "No analysis dates were available.",
  });

  if (breached.length > 0) {
    lines.push({
      id: "thesis",
      tone: "bad",
      title: "Thesis tripwires",
      text: `${breached.length === 1 ? "A tripwire has" : `${breached.length} holdings have tripped a wire:`} fired on ${breached
        .map((t) => t.name)
        .join(", ")}. Re-read the thesis before doing anything.`,
    });
  } else if (reviewing.length > 0) {
    lines.push({
      id: "thesis",
      tone: "watch",
      title: "Thesis tripwires",
      text: `No tripwire has fired. ${reviewing.length === 1 ? "One holding is" : `${reviewing.length} holdings are`} flagged for a thesis review: ${reviewing
        .map((t) => t.name)
        .join(", ")}.`,
    });
  } else {
    const monitored = towers.filter((t) => t.thesis === "intact").length;
    lines.push({
      id: "thesis",
      tone: monitored > 0 ? "good" : "unknown",
      title: "Thesis tripwires",
      text: monitored > 0 ? `No tripwire has fired on the ${monitored} monitored holdings.` : "No holding has tripwires set up yet.",
    });
  }

  const landBits: string[] = [];
  if (cheap > 0) landBits.push(`${pct(cheap)} priced below its base case`);
  const full = share((t) => t.land === "full_price");
  if (full > 0) landBits.push(`${pct(full)} at a full price`);
  if (dear > 0) landBits.push(`${pct(dear)} above its bull case`);
  const fog = share((t) => t.land === "fog");
  if (fog > 0) landBits.push(`${pct(fog)} with no usable valuation`);
  lines.push({
    id: "land",
    tone: dear >= R.dearMixedPct ? "watch" : cheap + full + dear > 0 ? "good" : "unknown",
    title: "Land (price against value)",
    text: landBits.length
      ? `${landBits.join("; ")}. Cheap land is a reason to study a business, not a signal.`
      : "No holding has a usable valuation.",
  });

  const reasonText = state.siege && state.siege.reasons.length > 0 ? ` ${state.siege.reasons[0]}` : "";
  lines.push({
    id: "weather",
    tone: siege === "besieged" ? "bad" : siege === "gathering" ? "watch" : siege === "calm" ? "good" : "unknown",
    title: "Weather (market stress)",
    text: `${SIEGE_LABEL[siege]}.${reasonText}`.trim(),
  });

  lines.push({
    id: "vault",
    tone: state.vault.level === "empty" || state.vault.level === "thin" ? "watch" : state.vault.level === "unsurveyed" ? "unknown" : "good",
    title: "Vault (your cash)",
    text: `${VAULT_LABEL[state.vault.level]}${
      state.vault.cash_share_pct !== null ? `: ${pct(Number(state.vault.cash_share_pct))} of cash plus portfolio` : ""
    }.`,
  });

  const d = state.diworsification;
  lines.push({
    id: "spread",
    tone: d.shantytown === "heavy" ? "watch" : "good",
    title: "Spread of the realm",
    text: `${d.position_count} positions${
      d.top1_pct !== null ? `; the largest is ${pct(Number(d.top1_pct))}` : ""
    }${d.top5_pct !== null ? ` and the top five together ${pct(Number(d.top5_pct))}` : ""}${
      d.shantytown === "none" ? "." : d.shantytown === "light" ? "; a few tiny positions sit between the towers." : "; a shantytown of tiny positions has grown."
    }`,
  });

  if (state.temperament) {
    lines.push({
      id: "temperament",
      tone: temperament === "rash" ? "bad" : temperament === "restless" ? "watch" : temperament === "unsurveyed" ? "unknown" : "good",
      title: "Temperament (your decisions)",
      text: `${TEMPERAMENT_LABEL[temperament]}${state.temperament.low_confidence ? ", low confidence" : ""}. ${state.temperament.summary}`,
    });
  }

  // --- look first -------------------------------------------------------------
  const lookFirst: RealmLook[] = towers
    .filter(needsAttention)
    .sort((a, b) => Number(b.thesis === "breached") - Number(a.thesis === "breached") || w(b) - w(a) || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((t) => ({
      holdingId: t.holding_id,
      name: t.name,
      weightPct: t.weight_pct === null ? null : w(t),
      reasons: lookReasons(t),
    }));

  // --- analyst verdict mix (from the stored analyses) ---------------------------
  const counts = new Map<string, number>();
  for (const t of towers) counts.set(t.verdict_rating ?? "Not analyzed", (counts.get(t.verdict_rating ?? "Not analyzed") ?? 0) + 1);
  const analystMix = [...counts.entries()]
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => {
      const ia = RATING_ORDER.indexOf(a.rating);
      const ib = RATING_ORDER.indexOf(b.rating);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  // --- headline ---------------------------------------------------------------
  const headline: Record<RealmLevel, string> = {
    attention:
      breached.length > 0
        ? "A tripwire has fired: read that thesis first."
        : weakWalls >= R.weakWallAttentionPct
          ? `${pct(weakWalls)} of the portfolio stands behind timber or rotted walls.`
          : noMoat >= R.noMoatAttentionPct
            ? `${pct(noMoat)} of the portfolio has no moat.`
            : "The market is besieging the realm.",
    mixed: "Some parts are strong, some need watching. Nothing has fired.",
    sound: "No rule flags: no breached tripwire, no weak walls, no moat-less holdings, and the weather is calm.",
    unknown: towers.length === 0 ? "There is nothing here to judge yet." : "Too much of the fortress has not been surveyed to judge it as a whole.",
  };

  return {
    level,
    headline: headline[level],
    oneLine: `${REALM_LEVEL_LABEL[level]}. ${headline[level]}`,
    lines,
    lookFirst,
    analystMix,
    rulesVersion: REALM_RULES_VERSION,
  };
}
