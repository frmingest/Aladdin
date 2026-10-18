import type { Council, CouncilAnswer, CouncilQuestion, GameAdvisorName, GameTower } from "./types";

/**
 * "Call someone to the floor" (Council page). Wording and ordering only: the answers come from
 * GET /game/council/ask, picked by fixed rules and worded by hand on the server. Four fixed questions,
 * no free text, nothing the player wrote is sent.
 */

export const COUNCIL_QUESTIONS: readonly CouncilQuestion[] = ["why_here", "edge", "storm", "beside"];

export const QUESTION_LABEL: Record<CouncilQuestion, string> = {
  why_here: "Why is this here?",
  edge: "How close is the edge?",
  storm: "What does the storm do?",
  beside: "Who stands beside it?",
};

export const ASK_LABEL: Record<GameAdvisorName, string> = {
  oracle: "Ask the Oracle",
  partner: "Ask the Partner",
};

export const OTHER_ADVISOR: Record<GameAdvisorName, GameAdvisorName> = { oracle: "partner", partner: "oracle" };

/** What to print under an answer that is not a reading, so silence or fog never reads as "all clear". */
export function answerNote(a: Pick<CouncilAnswer, "read">): string | null {
  if (a.read === "silent") return "Silence is not a clean bill of health.";
  if (a.read === "none") return "Nothing stored to read. Unknown is not safe.";
  return null;
}

export interface Token {
  id: string;
  name: string;
  weight: string | null;
  /** Named by at least one agenda rule tonight. */
  named: boolean;
}

/** The towers on the table: agenda-named first, then biggest first; towers with no stored weight last. */
export function lecternTokens(towers: GameTower[], council: Pick<Council, "items">): Token[] {
  const named = new Set(council.items.flatMap((it) => it.holdings.map((h) => h.holding_id).filter((id): id is string => !!id)));
  return towers
    .map((t) => ({ id: t.holding_id, name: t.name, weight: t.weight_pct, named: named.has(t.holding_id) }))
    .sort((a, b) => {
      if (a.named !== b.named) return a.named ? -1 : 1;
      const wa = a.weight === null ? -1 : Number(a.weight);
      const wb = b.weight === null ? -1 : Number(b.weight);
      return wb - wa || a.name.localeCompare(b.name);
    });
}
