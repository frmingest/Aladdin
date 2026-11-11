import { Link } from "react-router-dom";
import { withStop } from "./voiceV2";
import { whichWords } from "./quest";
import {
  DRILL_CARD_STATUS,
  DRILL_CARD_WHERE,
  LOOKBACK_GOAL,
  LOOKBACK_JOURNAL,
  LOOKBACK_STATUS,
  LOOKBACK_TITLE,
  QUEST_SAMPLE,
  WHYS_BAR_LABEL,
  WHYS_GOAL,
  WHYS_STATUS,
  WHYS_STILL,
  WHYS_TITLE,
  WHYS_WHERE,
  drillCardDone,
  lookbackCount,
  talkHint,
  whysCount,
} from "./questWordsV3";
import type { QuestState, ReviewQuestState } from "./quest";
import { NPCS } from "./npcs";
import type { StandingWords } from "./standingWordsV1";
import { GUIDE_STEPS } from "./guideQuests";
import type { GuideSaved, GuideStatus } from "./guideQuests";
import {
  GUIDE_ALL_DONE,
  GUIDE_DONE_PILL,
  GUIDE_REPLAY,
  GUIDE_SAMPLE,
  GUIDE_STEP_GOAL,
  GUIDE_STEP_TITLE,
  GUIDE_TAG,
  GUIDE_TODO_PILL,
  guideTitle,
  guideWhere,
} from "./guideWordsV1";

type ShownStanding = StandingWords & { watch?: string | null; ledger?: string | null };
import type { StandingWire } from "../lib/types";
import WireList from "./WireList";
import { fallPercent } from "./stormDrill";
import type { DrillQuestState } from "./stormDrill";
import { DRILL_GOAL, DRILL_TITLE } from "./stormDrillWordsV1";

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
  onLookAtWire,
  onRefreshStanding,
  drill,
  guide,
  onClose,
}: {
  quest: QuestState;
  reviews: ReviewQuestState;
  demo: boolean;
  /** The courtyard Standing in words; left out, the panel looks as it did before. */
  standing?: ShownStanding;
  /** Fired wires nobody has looked at (Standing 3). Left out, no wire list is shown. */
  wires?: readonly StandingWire[];
  onLookAtWire?: (id: string) => Promise<unknown>;
  onRefreshStanding?: () => Promise<unknown>;
  /** Storm Drill state; left out, the third card is not shown. */
  drill?: DrillQuestState;
  /** The Guide (First Steps); left out, the card is not shown. */
  guide?: { status: GuideStatus; saved: GuideSaved; onReplay: () => void };
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
      {demo && <p className="g3d-demo">{QUEST_SAMPLE}</p>}

      {guide && (
        <section className="g3d-card" aria-label="First Steps">
          <p className="g3d-tag">{GUIDE_TAG}</p>
          <h3>{guideTitle(guide.status.level)}</h3>
          <ol className="mt-2 space-y-1">
            {GUIDE_STEPS.map((s) => (
              <li key={s} className={s === guide.status.current ? "font-semibold" : "g3d-muted"}>
                <span aria-hidden>{guide.status.done[s] ? "✓ " : s === guide.status.current ? "→ " : "· "}</span>
                {GUIDE_STEP_TITLE[s]}
                <span className="sr-only">{guide.status.done[s] ? ` (${GUIDE_DONE_PILL})` : s === guide.status.current ? ` (${GUIDE_TODO_PILL})` : ""}</span>
              </li>
            ))}
          </ol>
          {guide.status.current ? (
            <>
              <p className="mt-2">{GUIDE_STEP_GOAL[guide.status.current]}</p>
              <p className="g3d-muted">{guideWhere(guide.status.current, guide.saved.taken.includes(guide.status.current))}</p>
              {demo && (guide.status.current === "stall" || guide.status.current === "why") && <p className="g3d-muted">{GUIDE_SAMPLE}</p>}
            </>
          ) : (
            <p className="g3d-muted mt-2">{GUIDE_ALL_DONE}</p>
          )}
          <button type="button" className="g3d-btn mt-2" onClick={guide.onReplay}>{GUIDE_REPLAY}</button>
        </section>
      )}

      {standing && (
        <section className="g3d-card" aria-label="Standing">
          <p className="g3d-tag">Standing</p>
          <h3>
            <span aria-hidden>{"🔥".repeat(standing.lit) || "·"} </span>
            {standing.headline}
          </h3>
          {standing.next && <p className="g3d-muted">{withStop(standing.next)}</p>}
          {standing.watch && <p className="g3d-muted">{withStop(standing.watch)}</p>}
          {standing.ledger && <p className="g3d-muted">{withStop(standing.ledger)}</p>}
        </section>
      )}

      {wires && onLookAtWire && onRefreshStanding && (
        <WireList wires={wires} demo={demo} onLook={onLookAtWire} onRefresh={onRefreshStanding} />
      )}

      <section className="g3d-card">
        <p className="g3d-tag">Quest</p>
        <h3>{WHYS_TITLE}</h3>
        <p className="g3d-muted">{WHYS_GOAL}</p>
        <p className="mt-2"><Pill done={questDone}>{WHYS_STATUS[quest.status]}</Pill></p>
        {counted && (
          <>
            <div className="g3d-bar" role="progressbar" aria-label={WHYS_BAR_LABEL} aria-valuemin={0} aria-valuemax={quest.total} aria-valuenow={quest.written}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="g3d-muted mt-1">{whysCount(quest.written, quest.total)}</p>
          </>
        )}
        {quest.status === "open" && (
          <>
            <p className="g3d-muted mt-2">{WHYS_STILL}</p>
            <Chips items={quest.missing.map((m) => m.name)} max={6} />
            <p className="g3d-muted mt-2">{WHYS_WHERE}</p>
          </>
        )}
      </section>

      <section className="g3d-card">
        <p className="g3d-tag">Quest</p>
        <h3>{LOOKBACK_TITLE}</h3>
        <p className="g3d-muted">{LOOKBACK_GOAL}</p>
        <p className="mt-2"><Pill done={reviewsClear}>{LOOKBACK_STATUS[reviews.status]}</Pill></p>
        {reviews.status === "open" && (
          <>
            <p className="g3d-muted mt-2">{lookbackCount(reviews.due.length)}</p>
            <Chips items={reviews.due.map((d) => `${d.name} (${whichWords(d.which)})`)} max={4} />
          </>
        )}
        <Link to="/journal" className="g3d-btn mt-3 inline-block">{LOOKBACK_JOURNAL}</Link>
      </section>

      {drill && (
        <section className="g3d-card">
          <p className="g3d-tag">Quest</p>
          <h3>{DRILL_TITLE}</h3>
          <p className="g3d-muted">{DRILL_GOAL}</p>
          <p className="mt-2"><Pill done={drill.status === "done"}>{DRILL_CARD_STATUS[drill.status]}</Pill></p>
          {drill.status === "done" && (
            <p className="g3d-muted mt-1">
              {drillCardDone(drill.count, drill.latestFall !== null ? fallPercent(drill.latestFall) : null)}
            </p>
          )}
          {drill.status === "open" && <p className="g3d-muted mt-2">{DRILL_CARD_WHERE}</p>}
        </section>
      )}

      <p className="g3d-muted mt-3">
        {talkHint(NPCS.map((n) => n.name))}
      </p>
    </aside>
  );
}
