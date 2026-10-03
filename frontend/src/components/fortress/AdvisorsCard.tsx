import { Link } from "react-router-dom";
import {
  ADVISOR_NAME,
  ADVISOR_ROLE,
  ADVISOR_TONE_LABEL,
  advisorRuleLabel,
} from "../../lib/fortress";
import type { GameAdvisorLine, GameAdvisorName, GameAdvisors, GameAdvisorTone } from "../../lib/types";
import { Card } from "../ui";

/** Game mode G7b: the two advisors. Every line is hand-written text chosen by a
 * fixed rule over the stored state (backend/app/services/game/advisors.py);
 * nothing is generated, nothing is scored, and no line tells you to trade.
 * Each line lists the stored facts it came from, so it can be checked. They are
 * not quotations from Warren Buffett or Charlie Munger. */

const TONE_CLASS: Record<GameAdvisorTone, string> = {
  warning: "bg-caution-subtle text-caution",
  note: "bg-raised text-ink-muted",
  calm: "bg-positive-subtle text-positive",
};

/** Small generic busts, drawn for this app: an owner with a lamp-lit scholar's
 * look, and a sharp-eyed sceptic. Not likenesses of any real person. */
export function Portrait({ who }: { who: GameAdvisorName }) {
  const ring = who === "oracle" ? "#d9a93e" : "#9aa4b8";
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" role="img" aria-label={ADVISOR_NAME[who]}>
      <circle cx="22" cy="22" r="20.5" fill="#20170e" stroke={ring} strokeWidth="2" />
      {who === "oracle" ? (
        <>
          <path d="M9 36 Q22 28 35 36 V42 H9 Z" fill="#3a5a8c" />
          <ellipse cx="22" cy="21" rx="8" ry="9.5" fill="#e6c9a3" />
          <path d="M13.5 19 Q14 8 22 8 Q30 8 30.5 19 Q27 13 22 13 Q17 13 13.5 19 Z" fill="#ece6d6" />
          <circle cx="18.6" cy="21" r="3" fill="none" stroke="#6e4a12" strokeWidth="1.2" />
          <circle cx="25.4" cy="21" r="3" fill="none" stroke="#6e4a12" strokeWidth="1.2" />
          <path d="M21.6 21 H22.4" stroke="#6e4a12" strokeWidth="1.2" />
          <path d="M19 27.5 Q22 29.5 25 27.5" fill="none" stroke="#8a5a3a" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M9 36 Q22 28 35 36 V42 H9 Z" fill="#4a2a2a" />
          <ellipse cx="22" cy="21" rx="8" ry="9.5" fill="#d9b690" />
          <path d="M13.8 18 Q15 9 22 9 Q29 9 30.2 18 Q26 13.5 22 14.5 Q18 13.5 13.8 18 Z" fill="#2e2a26" />
          <path d="M16.2 19.2 L20.4 20.2 M27.8 19.2 L23.6 20.2" stroke="#2e2a26" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="18.6" cy="21.6" r="1" fill="#2e2a26" />
          <circle cx="25.4" cy="21.6" r="1" fill="#2e2a26" />
          <path d="M19 28 H25" stroke="#8a5a3a" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Line({ line }: { line: GameAdvisorLine }) {
  return (
    <li className="flex gap-3 py-3">
      <Portrait who={line.advisor} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-semibold text-ink">{ADVISOR_NAME[line.advisor]}</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${TONE_CLASS[line.tone]}`}>
            {ADVISOR_TONE_LABEL[line.tone]}
          </span>
          {line.holding_id && line.holding_name && (
            <Link to={`/holdings/${line.holding_id}`} className="text-accent hover:underline">
              {line.holding_name}
            </Link>
          )}
        </p>
        <p className="mt-1 text-sm text-ink">{line.text}</p>
        {line.facts.length > 0 && (
          <details className="mt-1 text-xs text-ink-faint">
            <summary className="cursor-pointer select-none hover:text-ink-muted">Why this line</summary>
            <p className="mt-1">
              Rule: <span className="text-ink-muted">{advisorRuleLabel(line.rule)}</span>
            </p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              {line.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}

export default function AdvisorsCard({ advisors }: { advisors: GameAdvisors | null | undefined }) {
  if (!advisors) return null;
  const who: GameAdvisorName[] = ["oracle", "partner"];
  return (
    <Card>
      <h2 className="section-title">The advisors</h2>
      <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2" aria-label="Who the advisors are">
        {who.map((w) => (
          <li key={w} className="flex items-center gap-2">
            <Portrait who={w} />
            <span>
              <span className="font-semibold text-ink">{ADVISOR_NAME[w]}.</span> {ADVISOR_ROLE[w]}
            </span>
          </li>
        ))}
      </ul>

      {advisors.lines.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          The advisors have nothing to say yet: there are no holdings to survey.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {advisors.lines.map((l, i) => (
            <Line key={`${l.rule}-${l.holding_id ?? "realm"}-${i}`} line={l} />
          ))}
        </ul>
      )}

      {advisors.hidden_count > 0 && (
        <p className="text-xs text-ink-faint">
          {advisors.hidden_count} more {advisors.hidden_count === 1 ? "observation" : "observations"} matched but did
          not fit; the most urgent are shown first. The survey and the Ledger carry the facts behind all of them.
        </p>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        {advisors.disclaimer} Lines {advisors.lines_version}. Informational only; nothing here trades, scores or
        rewards anything.
      </p>
    </Card>
  );
}
