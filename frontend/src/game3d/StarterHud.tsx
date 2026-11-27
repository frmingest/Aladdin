import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { SPEAKERS, STARTER_WORDS } from "./starterWordsV3";
import type { Line } from "./starterWordsV3";

/**
 * The practice yard's heads-up line (#493): the goal strip and the practice tag, under the toolbar (lower on a phone, clear of
 * the Back button). The tag is on screen for
 * the whole starter, so a screenshot of the yard always says it is practice. The live region reads the goal and each result
 * line once, when it changes.
 */
export function StarterGoal({ goal, hidden = false, reopen }: { goal: string; hidden?: boolean; reopen?: { label: string; onPress: () => void } }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[9.5rem] z-20 flex flex-col items-center gap-1 px-2 sm:top-16">
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

/**
 * A check's result (#494): the result line, with its reason, and under it what the Book did ("New page: Walls", "Already in
 * your book." or "Play again to earn this page."). No button: it goes by itself and the next station's card opens.
 */
export function StarterResult({ label, result, said, page, isNew }: { label: string; result: string; said?: Line | null; page: string; isNew: boolean }) {
  return (
    <section
      aria-label={label}
      className="g3d-panel g3d-slide pointer-events-none absolute bottom-16 left-1/2 z-20 w-[24rem] max-w-[92%] -translate-x-1/2 space-y-1 p-3 text-sm"
    >
      <p className="text-[0.95rem] font-semibold leading-snug">{result}</p>
      {/* The storm's result (#495) carries Marlie's line too: who says it, then the line. */}
      {said && (
        <div>
          <p className="g3d-tag">{SPEAKERS[said.who]}</p>
          <p className="leading-snug">{said.text}</p>
        </div>
      )}
      <p className={isNew ? "g3d-tag" : "g3d-muted"} data-testid="starter-page-line">
        {isNew && <span aria-hidden>📖 </span>}
        {page}
      </p>
    </section>
  );
}

/**
 * A short plate with no speaker and no button (#495): "Storm coming", and under reduced motion "Prices fell 30%" where the
 * tower would shake. It goes by itself; the card opens after it. Hidden from screen readers: the live region says it once.
 */
export function StarterNote({ text }: { text: string }) {
  return (
    <p
      aria-hidden
      data-testid="starter-note"
      className="g3d-panel g3d-slide pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2 px-4 py-2 text-base font-semibold"
    >
      {text}
    </p>
  );
}

/**
 * Beat 8 (#496): Barren's last line and the two ways on, at the bottom of the screen. "Bring your real fortress" goes back to
 * the courtyard; "Play again" starts a new run in the yard (the Book is kept). Focus lands on the first button, so one key
 * or one tap chooses. Selecting acts: no Close, no Next.
 */
/** How long after the end shows an Enter or Space is ignored, so a key held from the last card does not leave the yard. */
const END_KEY_GUARD_MS = 400;

export function StarterEnd({
  line,
  realLabel,
  againLabel,
  onReal,
  onAgain,
}: {
  line: Line;
  realLabel: string;
  againLabel: string;
  onReal: () => void;
  onAgain: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
    first.current?.focus();
  }, []);
  // Focus lands on "Bring your real fortress" at once; an Enter or Space still held from the why card must not press it.
  const guardKeys = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && performance.now() - shownAt.current < END_KEY_GUARD_MS) e.preventDefault();
  };
  return (
    <section
      aria-label={realLabel}
      data-testid="starter-end"
      onKeyDown={guardKeys}
      onKeyUp={guardKeys}
      className="g3d-panel g3d-slide absolute bottom-16 left-1/2 z-20 w-[26rem] max-w-[92%] -translate-x-1/2 space-y-2 p-3 text-sm"
    >
      <div>
        <p className="g3d-tag">{SPEAKERS[line.who]}</p>
        <p className="text-[0.95rem] leading-snug">{line.text}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button ref={first} type="button" onClick={onReal} className="g3d-btn min-h-[44px] flex-1 px-3 font-semibold">
          {realLabel}
        </button>
        <button type="button" onClick={onAgain} className="g3d-btn min-h-[44px] flex-1 px-3">
          {againLabel}
        </button>
      </div>
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
