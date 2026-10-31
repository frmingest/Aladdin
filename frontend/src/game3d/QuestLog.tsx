import { Link } from "react-router-dom";
import { QUEST_GOAL, QUEST_TITLE, REVIEW_QUEST_GOAL, REVIEW_QUEST_TITLE, whichWords } from "./quest";
import type { QuestState, ReviewQuestState } from "./quest";
import { NPCS } from "./npcs";

const STATUS_WORDS: Record<QuestState["status"], string> = {
  loading: "Reading your journal...",
  unreadable: "Can't read your journal right now.",
  empty: "No holdings yet, so nothing to write.",
  open: "Open",
  done: "Done! Every holding has a written reason.",
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
  onClose,
}: {
  quest: QuestState;
  reviews: ReviewQuestState;
  demo: boolean;
  onClose?: () => void;
}) {
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

      <section className="g3d-card">
        <p className="g3d-tag">Quest</p>
        <h3>{QUEST_TITLE}</h3>
        <p className="g3d-muted">{QUEST_GOAL}</p>
        <p className="mt-2"><Pill done={questDone}>{STATUS_WORDS[quest.status]}</Pill></p>
        {counted && (
          <>
            <div className="g3d-bar" role="progressbar" aria-label="Holdings with a written reason" aria-valuemin={0} aria-valuemax={quest.total} aria-valuenow={quest.written}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="g3d-muted mt-1">{quest.written} of {quest.total} written</p>
          </>
        )}
        {quest.status === "open" && (
          <>
            <p className="g3d-muted mt-2">Still missing:</p>
            <Chips items={quest.missing.map((m) => m.name)} max={6} />
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
        <Link to="/journal" className="g3d-btn mt-3 inline-block">Open the journal</Link>
      </section>

      <p className="g3d-muted mt-3">
        Walk up to {NPCS.map((n) => n.name).join(" or ")} and press E.
      </p>
    </aside>
  );
}
