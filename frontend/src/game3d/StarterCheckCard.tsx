import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SPEAKERS, STARTER_WORDS } from "./starterWordsV1";
import type { Line } from "./starterWordsV1";

export interface CheckChoice {
  id: string;
  label: string;
  /** A small drawing beside the word (the walls check): shape and word carry the meaning, never colour alone. */
  icon?: ReactNode;
}

/**
 * A check card (beats 3 and 4, #494): a small parchment plate at the bottom of the screen, so the tower stays in view. The
 * header is the person speaking (the taught line, or Marlie's hint after a miss), then the question, then the choices still
 * on the card. Selecting acts: no Save, Next or Confirm. Keyboard: focus lands on the first choice; 1 to 3 pick the visible
 * choices only; Escape closes the card, and E (or a tap) at the tower opens it again. While it is open the page's own hotkeys
 * stay quiet. The hint is read once by the page's live region, not here, so it is never read twice.
 */
export default function StarterCheckCard({
  title,
  line,
  choices,
  onPick,
  onClose,
}: {
  title: string;
  line: Line;
  choices: readonly CheckChoice[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  // After a miss the card keeps its place and focus goes back to its first choice (the tried one has left the card).
  const ids = choices.map((c) => c.id).join(" ");
  useEffect(() => {
    first.current?.focus();
  }, [ids]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (n) {
        const c = choices[Number(n[1]) - 1];
        e.preventDefault();
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
          <p className="text-[0.95rem] leading-snug">{line.text}</p>
        </div>
        <button type="button" className="g3d-x" aria-label={STARTER_WORDS.checks.close} onClick={onClose}>
          ×
        </button>
      </header>
      <h2 className="mt-2 font-semibold text-[#fff1cf]">{title}</h2>
      <ul className="mt-2 space-y-1">
        {choices.map((c, i) => (
          <li key={c.id}>
            <button
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onPick(c.id)}
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
        ))}
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
