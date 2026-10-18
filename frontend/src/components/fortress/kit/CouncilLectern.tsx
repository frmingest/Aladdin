import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import {
  ASK_LABEL,
  COUNCIL_QUESTIONS,
  OTHER_ADVISOR,
  QUESTION_LABEL,
  answerNote,
  type Token,
} from "../../../lib/councilAsk";
import { describeError } from "../../../lib/errors";
import { ADVISOR_NAME, ADVISOR_TONE_LABEL, advisorRuleLabel } from "../../../lib/fortress";
import { weightText } from "../../../lib/rituals";
import type { CouncilAnswer, CouncilQuestion, GameAdvisorName } from "../../../lib/types";
import ObjectArtImage from "../../ObjectArtImage";
import { Portrait } from "../AdvisorsCard";
import SealArt from "./SealArt";

/** "Call someone to the floor" (Council page). Pick a tower, pick one of four fixed questions, then pick
 * who answers. The answer comes from the server, chosen by fixed rules from stored fields and worded by
 * hand: no model, no free text, nothing you wrote is read. Silence and "no reading" are said plainly and
 * never look like an all clear. Read-only: nothing is saved and nothing is scored. */

function Pennant() {
  return (
    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden className="shrink-0">
      <path d="M1 1 H13 L10 6 L13 11 H1 Z" fill="#c9962f" stroke="#3a2a0e" strokeWidth="0.8" />
    </svg>
  );
}

function Speaker({ who, width }: { who: GameAdvisorName; width: number }) {
  return (
    <ObjectArtImage
      id={who === "oracle" ? "council-speak-oracle" : "council-speak-partner"}
      width={width}
      className="shrink-0"
      fallback={<Portrait who={who} />}
    />
  );
}

export default function CouncilLectern({ tokens }: { tokens: Token[] }) {
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [question, setQuestion] = useState<CouncilQuestion>("why_here");
  const [answer, setAnswer] = useState<CouncilAnswer | null>(null);
  const [busy, setBusy] = useState<GameAdvisorName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  // A different tower or question is a different conversation: drop the old answer.
  useEffect(() => {
    latest.current += 1;
    setAnswer(null);
    setError(null);
    setBusy(null);
  }, [holdingId, question]);

  function ask(who: GameAdvisorName) {
    if (!holdingId) return;
    const id = ++latest.current;
    setBusy(who);
    setError(null);
    api
      .askCouncil(holdingId, question, who)
      .then((a) => id === latest.current && setAnswer(a))
      .catch((e: unknown) => id === latest.current && setError(describeError(e, "the councillor").message))
      .finally(() => id === latest.current && setBusy(null));
  }

  function onQuestionKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = COUNCIL_QUESTIONS[(i + step + COUNCIL_QUESTIONS.length) % COUNCIL_QUESTIONS.length];
    setQuestion(next);
    document.getElementById(`ask-q-${next}`)?.focus();
  }

  if (tokens.length === 0) return null;
  const chosen = tokens.find((t) => t.id === holdingId) ?? null;
  const note = answer ? answerNote(answer) : null;
  const seal = answer ? (answer.read !== "read" ? "unknown" : answer.tone === "warning" ? "alert" : "notice") : "none";

  return (
    <section className="chamber rounded-xl p-4 text-[#f3e4bf]" aria-labelledby="ask-title">
      <div className="flex items-start gap-3">
        <ObjectArtImage id="council-lectern" width={46} className="shrink-0" fallback={null} />
        <div className="min-w-0">
          <h2 id="ask-title" className="font-display text-lg font-semibold text-[#f6e6bd]">
            Call someone to the floor
          </h2>
          <p className="text-sm text-[#cdb98c]">Pick a tower, then a question, then who answers.</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cdb98c]">1. A tower</p>
        <ul className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1" aria-label="Towers on the table">
          {tokens.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={t.id === holdingId}
                onClick={() => setHoldingId(t.id === holdingId ? null : t.id)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2d27a] ${
                  t.id === holdingId ? "border-[#f2d27a] bg-[#4a3220] text-[#fff1cc]" : "border-[#8a6a32] bg-[#2b2014] text-[#f3e4bf] hover:bg-[#3a2a1a]"
                }`}
              >
                {t.named && <Pennant />}
                <span>{t.name}</span>
                <span className="text-xs text-[#cdb98c]">{weightText(t.weight)}</span>
                {t.named && <span className="sr-only"> (on tonight&apos;s agenda)</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-[#a8977a]">A gold pennant marks a tower the agenda names tonight.</p>
      </div>

      <div className="mt-3" role="radiogroup" aria-label="Question">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cdb98c]">2. A question</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {COUNCIL_QUESTIONS.map((q, i) => (
            <button
              key={q}
              id={`ask-q-${q}`}
              type="button"
              role="radio"
              aria-checked={q === question}
              tabIndex={q === question ? 0 : -1}
              onClick={() => setQuestion(q)}
              onKeyDown={(e) => onQuestionKey(e, i)}
              className={`min-h-[44px] rounded-md border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2d27a] ${
                q === question ? "border-[#f2d27a] bg-[#4a3220] font-semibold text-[#fff1cc]" : "border-[#8a6a32] bg-[#2b2014] hover:bg-[#3a2a1a]"
              }`}
            >
              {QUESTION_LABEL[q]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#cdb98c]">3. Who answers</p>
        <div className="mt-1 grid grid-cols-2 gap-3">
          {(["oracle", "partner"] as const).map((who) => (
            <button
              key={who}
              type="button"
              disabled={!holdingId || busy !== null}
              aria-label={chosen ? `${ASK_LABEL[who]} about ${chosen.name}: ${QUESTION_LABEL[question]}` : `${ASK_LABEL[who]} (pick a tower first)`}
              onClick={() => ask(who)}
              className={`flex min-h-[44px] flex-col items-center gap-1 rounded-md border px-2 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2d27a] disabled:cursor-not-allowed disabled:opacity-55 ${
                answer?.advisor === who ? "border-[#f2d27a] bg-[#4a3220]" : "border-[#8a6a32] bg-[#2b2014] enabled:hover:bg-[#3a2a1a]"
              }`}
            >
              <Speaker who={who} width={72} />
              <span>{busy === who ? "Thinking…" : ASK_LABEL[who]}</span>
            </button>
          ))}
        </div>
        {!holdingId && <p className="mt-1 text-xs text-[#a8977a]">Pick a tower first.</p>}
      </div>

      <div aria-live="polite" className="mt-4">
        {error && <p className="rounded-md border border-dashed border-[#6b5a3c] p-2 text-sm text-[#f2b8a8]">{error}</p>}
        {answer && (
          <div className="flex items-start gap-3">
            <Speaker who={answer.advisor} width={64} />
            <div className="market-bubble min-w-0 flex-1 text-sm">
              <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
                <span>{ADVISOR_NAME[answer.advisor]}</span>
                <SealArt kind={seal} size={18} decorative />
                <span className="rounded-full border border-current px-2 py-0.5">
                  {answer.read === "read" ? ADVISOR_TONE_LABEL[answer.tone] : answer.read === "silent" ? "Quiet" : "No reading"}
                </span>
              </p>
              <p className="text-[#f3e4bf]">{answer.text}</p>
              {note && <p className="mt-1 text-xs italic text-[#cdb98c]">{note}</p>}
              {answer.facts.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="What this is built from">
                  {answer.facts.map((f) => (
                    <li key={f} className="rounded border border-[#6b5a3c] px-1.5 py-0.5 text-xs text-[#cdb98c]">
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {answer.rules.length > 0 && (
                <p className="mt-1 text-xs text-[#a8977a]">Rule: {answer.rules.map((r) => advisorRuleLabel(r)).join("; ")}</p>
              )}
              <p className="mt-2 flex flex-wrap gap-x-4 text-xs">
                <button type="button" disabled={busy !== null} onClick={() => ask(OTHER_ADVISOR[answer.advisor])} className="inline-block min-h-[44px] py-2 text-[#f2d27a] hover:underline disabled:opacity-55">
                  Ask {ADVISOR_NAME[OTHER_ADVISOR[answer.advisor]].replace("The ", "the ")} the same
                </button>
                <Link to={`/holdings/${answer.holding_id}`} className="inline-block min-h-[44px] py-2 text-[#f2d27a] hover:underline">
                  Open {answer.holding_name}
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-[#a8977a]">
        Answers are picked by fixed rules from what is stored and written by hand. Not advice, and nothing here is saved.
      </p>
    </section>
  );
}
