import { NPCS } from "./npcs";
import type { NpcId } from "./npcs";
import { IMPORT_PATH, pointsToImport, talk } from "./dialogueV2";
import type { QuestState, ReviewQuestState } from "./quest";

interface Props {
  npc: NpcId;
  quest: QuestState;
  reviews: ReviewQuestState;
  onClose: () => void;
  onRetry: () => void;
}

/** What the person you are talking to says. A speech scroll over the scene, not in it. */
export default function DialoguePanel({ npc, quest, reviews, onClose, onRetry }: Props) {
  const who = NPCS.find((n) => n.id === npc);
  return (
    <section
      role="dialog"
      aria-label={`Talking to ${who?.name ?? "someone"}`}
      className="g3d-panel g3d-slide absolute bottom-16 left-1/2 z-20 w-[30rem] max-w-[55%] -translate-x-1/2 p-4 text-sm"
    >
      <header className="flex items-center gap-3">
        <span aria-hidden className="g3d-portrait">{who?.name.charAt(0)}</span>
        <div>
          <h2 className="g3d-name">{who?.name}</h2>
          {who && <p className="g3d-muted">{who.tagline}</p>}
        </div>
      </header>
      <div className="mt-3 space-y-2 border-t border-[#5a4220] pt-3 text-[0.95rem] leading-relaxed">
        {talk(npc, quest, reviews).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {pointsToImport(npc, quest) && (
          <a href={IMPORT_PATH} className="g3d-btn">Bring in my holdings</a>
        )}
        {quest.status === "unreadable" && (
          <button type="button" onClick={onRetry} className="g3d-btn">Try again</button>
        )}
        <button type="button" onClick={onClose} className="g3d-btn">Close (E)</button>
      </div>
    </section>
  );
}
