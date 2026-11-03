import { useState } from "react";
import { REALM_LEVEL_LABEL, REALM_RULES, type RealmLevel, type RealmTone, type RealmVerdict as Verdict } from "../../lib/realmVerdict";
import { formatPct100 } from "../../lib/format";
import { Card, VerdictBadge } from "../ui";
import VerdictKeep from "./kit/VerdictKeep";
import {
  REALM_HIDE_NUMBERS, REALM_LEVEL_WORD, REALM_LOOK_FIRST, REALM_RULES_CLOSE, REALM_RULES_LINES, REALM_RULES_OPEN,
  REALM_SHOW_NUMBERS, REALM_SIGN, REALM_TONE_WORD,
} from "./realmGameWords";

/**
 * The summary verdict on the whole fortress: what you read after pressing the
 * Great Keep or the walls. Everything here is a reading of values the backend
 * already decided (see lib/realmVerdict.ts); nothing is recomputed, nothing
 * is scored by a model, and nothing says to buy or sell.
 */

const LEVEL_STYLE: Record<RealmLevel, string> = {
  sound: "bg-positive-subtle text-positive",
  mixed: "bg-caution-subtle text-caution",
  attention: "bg-negative-subtle text-negative",
  unknown: "bg-border-subtle text-ink-muted",
};

const TONE_MARK: Record<RealmTone, { symbol: string; label: string; cls: string }> = {
  good: { symbol: "●", label: "No flag", cls: "text-positive" },
  watch: { symbol: "▲", label: "Watch", cls: "text-caution" },
  bad: { symbol: "■", label: "Needs a look", cls: "text-negative" },
  unknown: { symbol: "?", label: "Unknown", cls: "text-ink-faint" },
};

export default function RealmVerdict({
  verdict,
  count,
  onOpenHolding,
  game = false,
}: {
  verdict: Verdict;
  count: number;
  onOpenHolding: (id: string) => void;
  /** The 3D courtyard's reading: a sign and one word per row, numbers one tap away, no analyst Buy/Sell. */
  game?: boolean;
}) {
  const [showRules, setShowRules] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  if (game) {
    return (
      <GameRealm
        verdict={verdict}
        count={count}
        onOpenHolding={onOpenHolding}
        showNumbers={showNumbers}
        setShowNumbers={setShowNumbers}
        showRules={showRules}
        setShowRules={setShowRules}
      />
    );
  }
  const R = REALM_RULES;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <VerdictKeep level={verdict.level} />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">The whole fortress</h2>
            <p className="text-xs text-ink-faint">
              Verdict on all {count} {count === 1 ? "holding" : "holdings"} together
            </p>
          </div>
        </div>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${LEVEL_STYLE[verdict.level]}`}>
          {REALM_LEVEL_LABEL[verdict.level]}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink">{verdict.headline}</p>

      <ul className="mt-4 divide-y divide-border-subtle text-sm" aria-label="What the verdict rests on">
        {verdict.lines.map((l) => {
          const mark = TONE_MARK[l.tone];
          return (
            <li key={l.id} className="flex gap-3 py-2">
              <span className={`mt-0.5 w-4 shrink-0 text-center ${mark.cls}`} role="img" aria-label={mark.label}>
                {mark.symbol}
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">{l.title}</p>
                <p className="text-ink-muted">{l.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {verdict.lookFirst.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Open these towers first</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {verdict.lookFirst.map((l) => (
              <li key={l.holdingId}>
                <button
                  type="button"
                  onClick={() => onOpenHolding(l.holdingId)}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded-md border border-border bg-raised px-3 py-1.5 text-left text-sm hover:border-accent"
                >
                  <span className="font-medium text-ink">
                    {l.name}
                    {l.weightPct !== null && <span className="tabular ml-2 text-xs text-ink-faint">{formatPct100(String(l.weightPct))}</span>}
                  </span>
                  <span className="text-xs text-ink-muted">{l.reasons.join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Analyst verdicts in the stored analyses
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {verdict.analystMix.map((m) => (
            <span key={m.rating} className="flex items-center gap-1.5 text-sm text-ink-muted">
              <VerdictBadge rating={m.rating === "Not analyzed" ? null : m.rating} />
              <span className="tabular">× {m.count}</span>
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-faint" title="These ratings come from your saved analyses (partly written by a model from the evidence). They are shown as they were stored; this card does not change or re-rate them.">
          Ratings as stored; nothing is re-rated here.
        </p>
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        A reading aid over the walls, moats, ages, prices, thesis flags, weather, vault and temperament shown in this
        fortress. It is not a score and not advice to buy or sell.{" "}
        <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => setShowRules((v) => !v)}>
          {showRules ? "Hide how it is decided" : "How it is decided"}
        </button>
      </p>
      {showRules && (
        <div className="mt-2 rounded-md bg-raised p-3 text-xs text-ink-muted">
          <p className="mb-1 font-semibold text-ink">Rules {verdict.rulesVersion}, in this order (shares are % of the portfolio):</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <b>Needs a look first</b> if any tripwire has fired, or {R.weakWallAttentionPct}% or more stands behind
              timber or rotted walls, or {R.noMoatAttentionPct}% or more has no moat, or the weather is under siege.
            </li>
            <li>
              <b>Cannot judge yet</b> if {R.unsurveyedUnknownPct}% or more was never surveyed (or there is nothing to
              judge).
            </li>
            <li>
              <b>Mixed</b> if any weight sits behind timber or rotted walls or has no moat, or {R.staleMixedPct}% or
              more has a stale analysis, or {R.dearMixedPct}% or more is priced above its bull case, or{" "}
              {R.unsurveyedMixedPct}% or more is unsurveyed, or a thesis is flagged for review, or the storm is
              gathering, or your temperament reads restless or rash.
            </li>
            <li>
              <b>No rule flags</b> otherwise. That means none of the above fired. It does not mean the holdings are
              good buys.
            </li>
          </ol>
        </div>
      )}
    </Card>
  );
}

function GameRealm({
  verdict, count, onOpenHolding, showNumbers, setShowNumbers, showRules, setShowRules,
}: {
  verdict: Verdict;
  count: number;
  onOpenHolding: (id: string) => void;
  showNumbers: boolean;
  setShowNumbers: (v: boolean) => void;
  showRules: boolean;
  setShowRules: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid="realm-game">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <VerdictKeep level={verdict.level} />
          <div>
            <p className="font-display text-lg font-semibold text-ink">All {count} {count === 1 ? "tower" : "towers"}</p>
            <p className="text-sm text-ink">{verdict.headline}</p>
          </div>
        </div>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${LEVEL_STYLE[verdict.level]}`}>
          {REALM_LEVEL_WORD[verdict.level]}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="What the verdict rests on">
        {verdict.lines.map((l) => {
          const mark = TONE_MARK[l.tone];
          return (
            <li key={l.id} className="rounded-md border border-border-subtle bg-raised px-3 py-1.5" title={l.text}>
              <div className="flex items-center gap-2">
                <span className={`w-4 shrink-0 text-center ${mark.cls}`} role="img" aria-label={mark.label}>{mark.symbol}</span>
                <span className="font-medium text-ink">{REALM_SIGN[l.id] ?? l.title}</span>
                <span className="ml-auto text-xs text-ink-muted">{REALM_TONE_WORD[l.tone]}</span>
              </div>
              {showNumbers && <p className="mt-1 pl-6 text-xs text-ink-muted">{l.text}</p>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" className="underline underline-offset-2 text-ink-muted hover:text-ink" aria-expanded={showNumbers} onClick={() => setShowNumbers(!showNumbers)}>
          {showNumbers ? REALM_HIDE_NUMBERS : REALM_SHOW_NUMBERS}
        </button>
        <button type="button" className="underline underline-offset-2 text-ink-muted hover:text-ink" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>
          {showRules ? REALM_RULES_CLOSE : REALM_RULES_OPEN}
        </button>
      </div>
      {showRules && (
        <ol className="list-decimal space-y-1 rounded-md bg-raised p-3 pl-7 text-xs text-ink-muted">
          {REALM_RULES_LINES.map((t) => <li key={t}>{t}</li>)}
        </ol>
      )}

      {verdict.lookFirst.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-faint">{REALM_LOOK_FIRST}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {verdict.lookFirst.map((l) => (
              <li key={l.holdingId}>
                <button
                  type="button"
                  onClick={() => onOpenHolding(l.holdingId)}
                  title={l.reasons.join(", ")}
                  className="rounded-md border border-border bg-raised px-3 py-1 text-sm text-ink hover:border-accent"
                >
                  {l.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
