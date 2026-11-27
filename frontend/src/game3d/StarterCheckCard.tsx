import { useCallback, useEffect, useRef } from "react";
import { SPEAKERS, STARTER_WORDS } from "./starterWordsV3";
import type { Line } from "./starterWordsV3";
import { SETTLE_MS, choiceForKey } from "./checkCardLogic";
import type { CheckChoice } from "./checkCardLogic";

export type { CheckChoice } from "./checkCardLogic";

/**
 * A check card (beats 3 and 4, #494): a small parchment plate at the bottom of the screen, so the tower stays in view. The
 * header is the person speaking (the taught line, or Marlie's hint after a miss), then the question, then the choices.
 * Selecting acts: no Save, Next or Confirm.
 *
 * Every choice keeps its slot and its key number for the whole check. A tried choice becomes a blank slot with no words, so
 * the right answer never slides up into the slot just tapped (with the slots moving, "Enter, Enter" or a double tap won the
 * page without reading; game-designer review, #494). After a miss focus goes to the hint, not to a choice; a held key
 * repeats nothing, and for a moment after a miss no pick lands.
 *
 * Keyboard: focus lands on the speaker's line (#495), so Enter alone picks nothing; Tab reaches the choices; 1 to 3 pick by slot; Escape closes the card, and E (or a tap) at the tower opens
 * it again. While it is open the page's own hotkeys stay quiet. The hint is read once by the page's live region, not here.
 */
export default function StarterCheckCard({
  title,
  line,
  missed,
  choices,
  onPick,
  onClose,
}: {
  title: string;
  line: Line;
  /** The header is Marlie's hint after a miss: focus moves there. */
  missed: boolean;
  choices: readonly CheckChoice[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const hint = useRef<HTMLParagraphElement>(null);
  const settledAt = useRef(0);
  const tried = choices.filter((c) => c.tried).map((c) => c.id).join(" ");
  useEffect(() => {
    settledAt.current = performance.now() + (tried ? SETTLE_MS : 0);
    // Focus goes to the speaker's line, on open and after a miss, never to a choice: Enter alone picks nothing, and a screen
    // reader hears the line first. Tab reaches the choices; 1 to 3 pick by slot (#495 review: with focus on the first
    // choice, the right answer could never be first, and "2, then 3" won every card).
    hint.current?.focus();
  }, [tried, missed]);
  const pick = useCallback(
    (c: CheckChoice | undefined) => {
      if (!c || c.tried || performance.now() < settledAt.current) return;
      onPick(c.id);
    },
    [onPick],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(?:Digit|Numpad)[1-9]$/.test(e.code)) {
        e.preventDefault();
        const c = choiceForKey(choices, e.code, { repeat: e.repeat, now: performance.now(), settledAt: settledAt.current });
        if (c) onPick(c.id);
      } else if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onPick, onClose]);
  return (
    <section role="dialog" aria-label={title} className="g3d-panel g3d-slide absolute bottom-16 left-1/2 z-30 w-[24rem] max-w-[92%] -translate-x-1/2 p-3 text-sm">
      <header className="g3d-head">
        <div>
          <p className="g3d-tag">{SPEAKERS[line.who]}</p>
          <p ref={hint} tabIndex={-1} className="text-[0.95rem] leading-snug outline-none">
            {line.text}
          </p>
        </div>
        <button type="button" className="g3d-x [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]" aria-label={STARTER_WORDS.checks.close} onClick={onClose}>
          ×
        </button>
      </header>
      <h2 className="mt-2 font-semibold text-[#fff1cf]">{title}</h2>
      <ul className="mt-2 space-y-1">
        {choices.map((c, i) =>
          c.tried ? (
            // The slot stays, empty: a dashed outline, no words, nothing to pick, hidden from screen readers.
            <li key={c.id} aria-hidden className="min-h-[44px] rounded border border-dashed border-white/20" />
          ) : (
            <li key={c.id}>
              <button
                type="button"
                onClick={(e) => {
                  if (!e.detail || e.detail === 1) pick(c);
                }}
                className="g3d-card flex min-h-[44px] w-full items-center gap-3 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2d27a]"
              >
                {c.icon && (
                  <span aria-hidden className="shrink-0 text-[#fff1cf]">
                    {c.icon}
                  </span>
                )}
                <span className="flex-1 font-semibold">{c.label}</span>
                <kbd aria-hidden className="g3d-keycap [@media(pointer:coarse)]:hidden">
                  {i + 1}
                </kbd>
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

/** The walls check's three drawings: squared blocks (granite), planks with cracks (timber), broken stumps (rotted). */
export function WallIcon({ wall }: { wall: "granite" | "timber" | "rotted" }) {
  const common = { width: 36, height: 28, viewBox: "0 0 36 28", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round" as const };
  if (wall === "granite") {
    return (
      <svg {...common}>
        <rect x="2" y="4" width="15" height="9" />
        <rect x="19" y="4" width="15" height="9" />
        <rect x="2" y="15" width="9" height="9" />
        <rect x="13" y="15" width="10" height="9" />
        <rect x="25" y="15" width="9" height="9" />
      </svg>
    );
  }
  if (wall === "timber") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="22" />
        <rect x="14" y="3" width="8" height="22" />
        <rect x="25" y="3" width="8" height="22" />
        <path d="M6 8 L8 12 L6 15" />
        <path d="M28 14 L30 18 L28 21" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 25 V14 L6 11 L9 15 V25" />
      <path d="M14 25 V19 L17 16 L20 20 V25" />
      <path d="M25 25 V9 L28 13 L31 10 V25" />
      <path d="M1 25 H35" />
    </svg>
  );
}
