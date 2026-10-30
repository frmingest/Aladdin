import { NPCS } from "./npcs";
import type { NpcId } from "./npcs";
import { lines } from "./dialogueV1";
import type { QuestState } from "./quest";

interface Props {
  npc: NpcId;
  quest: QuestState;
  onClose: () => void;
  onRetry: () => void;
}

/** What the person you are talking to says. Plain text over the scene, not in it. */
export default function DialoguePanel({ npc, quest, onClose, onRetry }: Props) {
  const who = NPCS.find((n) => n.id === npc);
  return (
    <section
      role="dialog"
      aria-label={`Talking to ${who?.name ?? "someone"}`}
      className="absolute bottom-16 left-1/2 w-[34rem] max-w-[60%] -translate-x-1/2 rounded border border-border bg-surface/95 p-4 text-sm text-ink"
    >
      <h2 className="text-sm font-semibold">{who?.name}</h2>
      {lines(npc, quest).map((p, i) => (
        <p key={i} className="mt-2">
          {p}
        </p>
      ))}
      <div className="mt-3 flex gap-2">
        {quest.status === "unreadable" && (
          <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-xs hover:opacity-80">
            Try again
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded border border-border px-2 py-1 text-xs hover:opacity-80">
          Close (E)
        </button>
      </div>
    </section>
  );
}
