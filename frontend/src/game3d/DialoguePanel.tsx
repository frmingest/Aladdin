import { NPCS } from "./npcs";
import type { NpcId } from "./npcs";
import { IMPORT_PATH, closeLabel, guideTalk, pointsToImport, talk } from "./dialogueV7";
import type { GuideTalk } from "./dialogueV7";
import type { QuestState, ReviewQuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";

interface Props {
  npc: NpcId;
  quest: QuestState;
  reviews: ReviewQuestState;
  /** The Storm Drill quest; left out, the person never points at the drill post. */
  drill?: DrillQuestState;
  /** The Guide as it stood when you walked up; left out, the advisors speak as before. */
  guide?: GuideTalk | null;
  onClose: () => void;
  onRetry: () => void;
}

/** What the person you are talking to says. A speech scroll over the scene, not in it. */
export default function DialoguePanel({ npc, quest, reviews, drill, guide, onClose, onRetry }: Props) {
  const who = NPCS.find((n) => n.id === npc);
  // While the Guide is speaking, the only button is the close one: the import and retry buttons belong to the journal talk.
  const guided = guideTalk(npc, guide) !== null;
  return (
    <section
      role="dialog"
      aria-label={`Talking to ${who?.name ?? "someone"}`}
      className="g3d-panel g3d-slide absolute bottom-16 left-1/2 z-20 w-[30rem] max-w-[92%] sm:max-w-[55%] -translate-x-1/2 p-4 text-sm"
    >
      <header className="flex items-center gap-3">
        <span aria-hidden className="g3d-portrait">{who?.name.charAt(0)}</span>
        <div>
          <h2 className="g3d-name">{who?.name}</h2>
          {who && <p className="g3d-muted">{who.tagline}</p>}
        </div>
      </header>
      <div className="mt-3 space-y-2 border-t border-[#5a4220] pt-3 text-[0.95rem] leading-relaxed">
        {talk(npc, quest, reviews, drill, guide).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {!guided && pointsToImport(npc, quest) && (
          <a href={IMPORT_PATH} className="g3d-btn">Bring in my holdings</a>
        )}
        {!guided && quest.status === "unreadable" && (
          <button type="button" onClick={onRetry} className="g3d-btn">Try again</button>
        )}
        <button type="button" onClick={onClose} className="g3d-btn">{guided ? "Got it (E)" : closeLabel(npc, quest)}</button>
      </div>
    </section>
  );
}
