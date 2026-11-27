import { useEffect, useRef } from "react";
import { SPEAKERS, STARTER_WORDS } from "./starterWordsV2";

/**
 * Sal's practice counter (beat 2, #493). Its own small card, never the flat Marketplace's `SalesRepDialog` (which writes to
 * the watchlist and imports reports). One company, and the whole company card is the tap target: selecting acts, so there is
 * no Save, Next or Confirm. Keyboard: focus lands on the company card; 1 or Enter picks it; Escape closes the card, and E (or
 * a tap) at the counter opens it again. While it is open the page's own hotkeys stay quiet.
 */
export default function PracticeCounterCard({ onPick, onClose }: { onPick: () => void; onClose: () => void }) {
  const w = STARTER_WORDS.counter;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        onPick();
      } else if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPick, onClose]);
  return (
    <section
      role="dialog"
      aria-label={w.title}
      className="g3d-panel g3d-slide absolute bottom-16 left-1/2 z-30 w-[24rem] max-w-[92%] -translate-x-1/2 p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>{w.title}</h2>
        <button type="button" className="g3d-x" aria-label={w.close} onClick={onClose}>
          ×
        </button>
      </header>
      <p className="g3d-tag mt-2">{SPEAKERS[w.lead.who]}</p>
      <p className="text-[0.95rem] leading-snug">{w.lead.text}</p>
      <button
        ref={first}
        type="button"
        onClick={onPick}
        className="g3d-card flex w-full items-center gap-3 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2d27a]"
      >
        <span aria-hidden className="text-3xl">🍋</span>
        <span className="flex-1">
          <span className="block font-semibold text-[#fff1cf]">{w.company.name}</span>
          <span className="g3d-muted block">{w.company.what}</span>
        </span>
        {/* The key only means something with a keyboard: no keycap on a touch screen. */}
        <kbd aria-hidden className="g3d-keycap [@media(pointer:coarse)]:hidden">1</kbd>
      </button>
    </section>
  );
}
