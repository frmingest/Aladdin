import { useState } from "react";
import { Link } from "react-router-dom";
import { QUEST_TITLE, REVIEW_QUEST_GOAL, REVIEW_QUEST_TITLE, whichWords } from "./quest";
import { QUEST_V2_BAR_LABEL, QUEST_V2_DONE, QUEST_V2_GOAL } from "./questV2";
import type { QuestState, ReviewQuestState } from "./quest";
import { NPCS } from "./npcs";
import type { StandingWords } from "./standingWordsV1";
import type { StandingWire } from "../lib/types";
import { WIRE_BUTTON, WIRE_TITLE, wireLine } from "./wireWords";
import type { LookResult } from "./wireWords";

const STATUS_WORDS: Record<QuestState["status"], string> = {
  loading: "Reading your journal...",
  unreadable: "Can't read your journal right now.",
  empty: "No holdings yet, so nothing to write.",
  open: "Open",
  done: QUEST_V2_DONE,
};

const REVIEW_STATUS_WORDS: Record<ReviewQuestState["status"], string> = {
  loading: "Reading your journal...",
  unreadable: "Can't read your journal right now.",
  empty: "No journal entries yet, so nothing to review.",
  open: "Open",
  clear: "Clear! No review is waiting.",
};

/** A short row of name chips, then "+N more" so a long list never grows the panel. */
function Chips({ items, max }: { items: string[]; max: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <ul className="mt-2 flex flex-wrap gap-1">
      {shown.map((s) => (
        <li key={s} className="g3d-chip">{s}</li>
      ))}
      {rest > 0 && <li className="g3d-chip fog">+{rest} more</li>}
    </ul>
  );
}

function Pill({ done, children }: { done: boolean; children: string }) {
  return <span className={`g3d-pill ${done ? "good" : ""}`}>{done ? "✓ " : ""}{children}</span>;
}

/** The two quests, as two cards. Worked out fresh from the journal every time; nothing is saved. */
export default function QuestLog({
  quest,
  reviews,
  demo,
  standing,
  wires,
  onLook,
  onClose,
}: {
  quest: QuestState;
  reviews: ReviewQuestState;
  demo: boolean;
  /** The courtyard Standing in words; left out, the panel looks as it did before. */
  standing?: StandingWords;
  /** Fired wires nobody has looked at yet (Standing 3). Left out or empty, no wires card is drawn. */
  wires?: readonly StandingWire[];
  /** Marks one wire seen. Left out, the wires are listed without a button. */
  onLook?: (wire: StandingWire) => Promise<LookResult>;
  onClose?: () => void;
}) {
  // Which wire is being marked right now, and the words if one could not be marked. Nothing is stored.
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; message: string } | null>(null);
  const look = async (w: StandingWire) => {
    if (!onLook || busy !== null) return;
    setBusy(w.id);
    setProblem(null);
    const out = await onLook(w);
    if (!out.ok) setProblem({ id: w.id, message: out.message });
    setBusy(null);
  };
  const questDone = quest.status === "done";
  const reviewsClear = reviews.status === "clear";
  const counted = quest.status === "open" || quest.status === "done";
  const pct = counted && quest.total > 0 ? Math.round((quest.written / quest.total) * 100) : 0;
  return (
    <aside aria-label="Quest log" className="g3d-panel g3d-slide absolute left-3 top-14 z-20 max-h-[calc(100%-4.5rem)] w-72 max-w-[40%] overflow-y-auto p-3 text-sm">
      <header className="g3d-head">
        <h2>📜 Quests</h2>
        {onClose && (
          <button type="button" className="g3d-x" aria-label="Close quests" onClick={onClose}>×</button>
        )}
      </header>
      {demo && <p className="g3d-demo">Sample journal, not yours.</p>}

      {standing && (
        <section className="g3d-card" aria-label="Standing">
          <p className="g3d-tag">Standing</p>
          <h3>
            <span aria-hidden>{"🔥".repeat(standing.lit) || "·"} </span>
            {standing.headline}
          </h3>
          {standing.next && <p className="g3d-muted">{standing.next}</p>}
        </section>
      )}

      {wires && wires.length > 0 && (
        <section className="g3d-card" aria-label={WIRE_TITLE}>
          <p className="g3d-tag">{WIRE_TITLE}</p>
          <ul className="mt-1 space-y-2">
            {wires.map((w) => (
              <li key={w.id}>
                <p>{wireLine(w)}</p>
                <p className="g3d-muted">{w.label}</p>
                {onLook && (
                  <button type="button" className="g3d-btn mt-1" disabled={busy !== null} onClick={() => void look(w)}>
                    {WIRE_BUTTON}
                  </button>
                )}
                {problem?.id === w.id && <p role="alert" className="g3d-muted mt-1">{problem.message}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="g3d-card">
        <p className="g3d-tag">Quest</p>
        <h3>{QUEST_TITLE}</h3>
        <p className="g3d-muted">{QUEST_V2_GOAL}</p>
        <p className="mt-2"><Pill done={questDone}>{STATUS_WORDS[quest.status]}</Pill></p>
        {counted && (
          <>
            <div className="g3d-bar" role="progressbar" aria-label={QUEST_V2_BAR_LABEL} aria-valuemin={0} aria-valuemax={quest.total} aria-valuenow={quest.written}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="g3d-muted mt-1">{quest.written} of {quest.total} written</p>
          </>
        )}
        {quest.status === "open" && (
          <>
            <p className="g3d-muted mt-2">Still missing:</p>
            <Chips items={quest.missing.map((m) => m.name)} max={6} />
            <p className="g3d-muted mt-2">Write them at the desk by the keep door.</p>
          </>
        )}
      </section>

      <section className="g3d-card">
        <p className="g3d-tag">Quest</p>
        <h3>{REVIEW_QUEST_TITLE}</h3>
        <p className="g3d-muted">{REVIEW_QUEST_GOAL}</p>
        <p className="mt-2"><Pill done={reviewsClear}>{REVIEW_STATUS_WORDS[reviews.status]}</Pill></p>
        {reviews.status === "open" && (
          <>
            <p className="g3d-muted mt-2">{reviews.due.length} waiting:</p>
            <Chips items={reviews.due.map((d) => `${d.name} (${whichWords(d.which)})`)} max={4} />
          </>
        )}
        <Link to="/journal" className="g3d-btn mt-3 inline-block">Old entries: the journal</Link>
      </section>

      <p className="g3d-muted mt-3">
        Walk up to {NPCS.map((n) => n.name).join(" or ")} and press E.
      </p>
    </aside>
  );
}
