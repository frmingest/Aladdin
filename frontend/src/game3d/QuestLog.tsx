import { Link } from "react-router-dom";
import { QUEST_GOAL, QUEST_TITLE, nameList } from "./quest";
import type { QuestState } from "./quest";

const STATUS_WORDS: Record<QuestState["status"], string> = {
  loading: "Reading your journal...",
  unreadable: "Can't read your journal right now.",
  empty: "No holdings yet, so nothing to write.",
  open: "Open",
  done: "Done: every holding has a written reason.",
};

/** The one quest, in words. Worked out fresh from the journal every time; nothing is saved. */
export default function QuestLog({ quest, demo }: { quest: QuestState; demo: boolean }) {
  return (
    <aside
      aria-label="Quest log"
      className="absolute left-3 top-14 w-64 max-w-[30%] rounded border border-border bg-surface/95 p-3 text-sm text-ink"
    >
      <h2 className="text-sm font-semibold">Quest: {QUEST_TITLE}</h2>
      {demo && <p className="mt-1 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Sample journal, not yours.</p>}
      <p className="mt-1 text-xs text-ink-muted">{QUEST_GOAL}</p>
      <p className="mt-2 text-xs">{STATUS_WORDS[quest.status]}</p>
      {(quest.status === "open" || quest.status === "done") && (
        <p className="mt-1 text-xs text-ink-muted">
          {quest.written} of {quest.total} written
        </p>
      )}
      {quest.status === "open" && (
        <p className="mt-1 text-xs text-ink-muted">Missing: {nameList(quest.missing.map((m) => m.name), 6)}</p>
      )}
      <Link to="/journal" className="mt-2 inline-block rounded border border-border px-2 py-1 text-xs hover:opacity-80">
        Open the journal
      </Link>
      <p className="mt-2 text-xs text-ink-muted">Talk to the Oracle or the Partner: walk close, press E.</p>
    </aside>
  );
}
