import { useEffect, useRef } from "react";
import { PAGES } from "./starterPlanV2";
import type { PageId } from "./starterPlanV2";
import { STARTER_WORDS } from "./starterWordsV1";

const svg = { width: 44, height: 36, viewBox: "0 0 44 36", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round" as const };

/** The look each page taught, drawn small. Only the pages this build unlocks have one; the rest are never shown unlocked yet. */
function PageDrawing({ id }: { id: PageId }) {
  if (id === "walls") {
    return (
      <svg {...svg} aria-hidden>
        <path d="M6 32 V10 H10 V6 H14 V10 H18 V6 H22 V10 H26 V6 H30 V10 H34 V6 H38 V32 Z" />
        <path d="M6 18 H38 M6 25 H38 M16 10 V18 M28 10 V18 M12 18 V25 M22 18 V25 M32 18 V25 M16 25 V32 M28 25 V32" />
      </svg>
    );
  }
  if (id === "moat") {
    return (
      <svg {...svg} aria-hidden>
        <path d="M17 26 V8 H20 V5 H24 V8 H27 V26" />
        <path d="M3 30 Q8 26 13 30 T23 30 T33 30 T43 30" />
        <path d="M3 34 Q8 30 13 34 T23 34 T33 34 T43 34" />
      </svg>
    );
  }
  return null;
}

/** A closed clasp over a fogged page: shape and words say "not learned yet", never the fog alone. */
function Clasp() {
  return (
    <svg {...svg} aria-hidden>
      <rect x="12" y="15" width="20" height="16" rx="2" />
      <path d="M16 15 V10 a6 6 0 0 1 12 0 V15" />
      <path d="M22 21 V25" />
    </svg>
  );
}

/** A ribbon down the corner of a learned page. */
function Ribbon() {
  return (
    <svg width="14" height="26" viewBox="0 0 14 26" aria-hidden fill="currentColor">
      <path d="M1 0 H13 V25 L7 19 L1 25 Z" />
    </svg>
  );
}

/**
 * The Book of Wisdom (#494, spec section 4): one page per idea checked in practice, and a cover that is always open. A
 * learned page shows the look it taught, the one sentence, the Pip's fact behind it, the grown-up word and where to see it on
 * real towers. A locked page shows its title, a clasp and "Not learned yet". No number anywhere: no "3 of 5", no bar.
 * Opened as a dialog from the lectern in the yard, or from the Quests panel outside; the same keyboard path as the other
 * panels (focus moves in, Escape closes, focus goes back).
 */
export default function BookOfWisdom({ pages, blocked, onClose }: { pages: readonly PageId[]; blocked: boolean; onClose: () => void }) {
  const b = STARTER_WORDS.book;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <section
      role="dialog"
      aria-label={b.title}
      // Below the practice tag (on a phone it sits lower, under the toolbar), so a screenshot of the yard always says practice.
      className="g3d-panel g3d-slide absolute bottom-3 left-1/2 top-[12rem] z-40 w-[30rem] max-w-[94%] -translate-x-1/2 overflow-y-auto p-3 text-sm sm:top-[8rem]"
    >
      <header className="g3d-head">
        <h2>{b.title}</h2>
        <button ref={close} type="button" className="g3d-x" aria-label={b.close} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="g3d-card mt-2 text-center">
        {b.cover.map((l) => (
          <p key={l} className="leading-snug">
            {l}
          </p>
        ))}
      </div>
      {blocked && <p className="g3d-muted mt-2">{b.blocked}</p>}
      <ol className="mt-2 space-y-2">
        {PAGES.map((id) => {
          const p = b.pages[id];
          const learned = pages.includes(id) && !!p.lines;
          return (
            <li key={id} className="g3d-card relative flex gap-3">
              {/* Only the drawing is dimmed on a locked page: its words keep full contrast. */}
              <span className={`shrink-0 pt-1 text-[#fff1cf] ${learned ? "" : "opacity-60"}`}>{learned ? <PageDrawing id={id} /> : <Clasp />}</span>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {p.title}
                  {learned && <span className="sr-only"> ({b.learned})</span>}
                </h3>
                {learned ? (
                  <>
                    {p.lines?.map((l) => (
                      <p key={l} className="leading-snug">
                        {l}
                      </p>
                    ))}
                    {p.fact && <p className="g3d-muted mt-1">{p.fact}</p>}
                    {p.grownUp && <p className="g3d-muted italic">{p.grownUp}</p>}
                    {p.real && <p className="g3d-muted mt-1">{p.real}</p>}
                  </>
                ) : (
                  <p className="g3d-muted italic">{b.locked}</p>
                )}
              </div>
              {learned && (
                <span className="absolute right-2 top-0 text-[#f2d27a]">
                  <Ribbon />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
