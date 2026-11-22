import { SPEAKERS, STARTER_WORDS } from "./starterWordsV1";
import type { Line } from "./starterWordsV1";

/**
 * The practice yard's heads-up line (#493): the goal strip and the practice tag, under the toolbar (lower on a phone, clear of
 * the Back button). The tag is on screen for
 * the whole starter, so a screenshot of the yard always says it is practice. The live region reads the goal and each result
 * line once, when it changes.
 */
export function StarterGoal({ goal, hidden = false, reopen }: { goal: string; hidden?: boolean; reopen?: { label: string; onPress: () => void } }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 z-20 flex flex-col items-center gap-1 px-2 sm:top-16">
      {/* Sal's card was closed while the pick still waits: the goal becomes the way back, so a phone is never stuck. */}
      {!hidden && reopen ? (
        <button type="button" onClick={reopen.onPress} className="g3d-panel pointer-events-auto min-h-[44px] px-3 py-1 text-sm font-semibold">
          {reopen.label}
        </button>
      ) : (
        !hidden && (
          <p className="g3d-panel px-3 py-1 text-sm font-semibold" aria-hidden>
            {goal}
          </p>
        )
      )}
      <p className="g3d-worldtag" data-testid="practice-tag">
        <span aria-hidden>🍋 </span>
        {STARTER_WORDS.tag}
      </p>
    </div>
  );
}

/** One speech plate: who speaks, and their line. Several plates stack; there is no button, they go by themselves. */
export function StarterPlate({ lines, label }: { lines: readonly Line[]; label: string }) {
  return (
    <section
      aria-label={label}
      className="g3d-panel g3d-slide pointer-events-none absolute bottom-16 left-1/2 z-20 w-[28rem] max-w-[92%] -translate-x-1/2 space-y-2 p-3 text-sm"
    >
      {lines.map((l) => (
        <div key={l.text}>
          <p className="g3d-tag">{SPEAKERS[l.who]}</p>
          <p className="text-[0.95rem] leading-snug">{l.text}</p>
        </div>
      ))}
    </section>
  );
}

/** Read once by screen readers when it changes: the goal, then the latest result line. */
export function StarterLive({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}
