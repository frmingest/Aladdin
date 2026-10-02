import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useDemoMode } from "../../lib/demoMode";
import {
  CONJURING_LINE,
  DEMO_LINE,
  GENIE_DISCLAIMER,
  WISHES,
  errorOutcome,
  greeting,
  summariseWish,
  type WishOutcome,
} from "../../lib/genie";
import type { QueueScope } from "../../lib/types";
import LampLogo from "../LampLogo";
import { GenieFigure, WishIcon } from "./GenieArt";

/**
 * Game mode G11: the magic lamp in the corner of the Fortress, and the Genie who lives in it.
 *
 *   idle (lamp, "Rub me!") → rubbing (≈2 s of polish, sparkles, smoke) → asking (genie + 3 wishes)
 *   → conjuring (request in flight) → done (his report; make another wish or close)
 *
 * The three wishes are the Analysis queue's three scopes and make the same single call
 * (`queueReadyHoldings`). A wish only adds rows to the queue; the analysis runs later on the worker on
 * Faiz's PC, and the genie says so (CLAUDE.md status honesty). Nothing is bought or sold and nothing is
 * scored: no points, streaks or rewards for making a wish. Demo mode disables the wishes (writes are
 * blocked there). Under reduced motion the polish animation is skipped and the typing is instant.
 */

type Phase = "idle" | "rubbing" | "asking" | "conjuring" | "done";

const RUB_MS = 2000;

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Types a line out like a speech bubble. Instant under reduced motion; press the bubble to finish. */
function useTypewriter(text: string): { shown: string; finish: () => void } {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 2;
      });
    }, 18);
    return () => window.clearInterval(id);
  }, [text]);
  return { shown: text.slice(0, n), finish: () => setN(text.length) };
}

function Bubble({ text }: { text: string }) {
  const { shown, finish } = useTypewriter(text);
  return (
    <div className="genie-bubble" onClick={finish} role="presentation">
      {/* Announced once in full; the typed copy is for the eyes. */}
      <p className="sr-only" aria-live="polite">
        {text}
      </p>
      <p aria-hidden className="text-[0.95rem] leading-relaxed">
        {shown}
        {shown.length < text.length && <span className="genie-caret">▍</span>}
      </p>
    </div>
  );
}

function Sparkles() {
  // Fixed positions so the burst looks the same every time; the animation does the rest.
  const spots = [
    [6, 30], [78, 12], [92, 52], [20, 70], [60, 4], [40, 86], [88, 80], [2, 54],
  ];
  return (
    <>
      {spots.map(([x, y], i) => (
        <span key={i} className="lamp-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.18}s` }} aria-hidden>
          ✦
        </span>
      ))}
    </>
  );
}

export default function MagicLamp() {
  const { demoMode } = useDemoMode();
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<WishOutcome | null>(null);
  const [chosen, setChosen] = useState<QueueScope | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000));
  const [used, setUsed] = useState(false);
  const timer = useRef<number | null>(null);
  const mounted = useRef(true);
  const firstWish = useRef<HTMLButtonElement | null>(null);
  const lampBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const rub = useCallback(() => {
    if (phase !== "idle") return;
    setSeed(Math.floor(Math.random() * 1000));
    setOutcome(null);
    setChosen(null);
    setUsed(true);
    if (reducedMotion()) {
      setPhase("asking");
      return;
    }
    setPhase("rubbing");
    timer.current = window.setTimeout(() => {
      if (mounted.current) setPhase("asking");
    }, RUB_MS);
  }, [phase]);

  const close = useCallback(() => {
    if (phase === "conjuring") return;
    setPhase("idle");
    // Hand the focus back to the lamp so keyboard users are not lost.
    window.setTimeout(() => lampBtn.current?.focus(), 0);
  }, [phase]);

  useEffect(() => {
    if (phase !== "asking" && phase !== "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  useEffect(() => {
    if (phase === "asking") firstWish.current?.focus();
  }, [phase]);

  const wish = useCallback(
    async (scope: QueueScope) => {
      if (demoMode === true || phase !== "asking") return;
      setChosen(scope);
      setPhase("conjuring");
      let result: WishOutcome;
      try {
        const queued = await api.queueReadyHoldings(scope);
        // Best effort: is a worker awake to pick the scrolls up? Unknown stays unknown.
        const online = await api
          .getAnalysisQueue()
          .then((q) => q.any_worker_online)
          .catch(() => null);
        result = summariseWish(queued, scope, online);
      } catch (e) {
        result = errorOutcome(e instanceof ApiError || e instanceof Error ? e.message : "The request failed.");
      }
      if (!mounted.current) return;
      setOutcome(result);
      setPhase("done");
    },
    [demoMode, phase],
  );

  const line = useMemo(() => {
    if (phase === "conjuring") return CONJURING_LINE;
    if (phase === "done" && outcome) return outcome.headline;
    return demoMode === true ? DEMO_LINE : greeting(seed);
  }, [phase, outcome, demoMode, seed]);

  const rubbing = phase === "rubbing";
  const open = phase === "asking" || phase === "conjuring" || phase === "done";

  return (
    <>
      {!open && (
        <div className="lamp-fab-wrap">
          {phase === "idle" && !used && <span className="lamp-hint" aria-hidden>Rub me!</span>}
          <button
            ref={lampBtn}
            type="button"
            className="lamp-fab"
            data-rubbing={rubbing ? "true" : undefined}
            onClick={rub}
            disabled={rubbing}
            aria-label="Rub the magic lamp to summon the Genie"
            title="Rub the magic lamp"
          >
            <span className="lamp-body">
              <LampLogo className="h-16 w-16 sm:h-20 sm:w-20" />
            </span>
            {rubbing && (
              <>
                <span className="lamp-cloth" aria-hidden />
                <Sparkles />
                <span className="lamp-puff" aria-hidden />
              </>
            )}
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={close} disabled={phase === "conjuring"} />
          <div role="dialog" aria-modal="true" aria-label="The Genie of the Lamp" className="genie-panel relative w-full max-w-xl">
            <div className="sal-panel-head">
              <p className="text-sm font-semibold tracking-wide text-[#f6d77a]">The Genie of the Lamp</p>
              <button type="button" className="sal-x" onClick={close} disabled={phase === "conjuring"} aria-label="Close the Genie">
                ✕
              </button>
            </div>

            <div className="flex items-start gap-3 p-4 sm:gap-4">
              <div className={`genie-rise shrink-0 ${phase === "conjuring" ? "genie-conjuring" : ""}`}>
                <GenieFigure mood={phase === "conjuring" ? "wow" : outcome?.mood === "error" ? "sorry" : "happy"} className="h-36 w-28 sm:h-44 sm:w-36" />
              </div>
              <div className="min-w-0 flex-1">
                <Bubble text={line} />

                {(phase === "asking" || phase === "conjuring") && (
                  <ul className="mt-3 space-y-2" aria-label="Your three wishes">
                    {WISHES.map((w, i) => (
                      <li key={w.scope}>
                        <button
                          ref={i === 0 ? firstWish : undefined}
                          type="button"
                          className="genie-wish"
                          data-chosen={chosen === w.scope ? "true" : undefined}
                          onClick={() => void wish(w.scope)}
                          disabled={demoMode === true || phase === "conjuring"}
                        >
                          <WishIcon kind={w.icon} />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold text-[#f8ecd0]">{w.title}</span>
                            <span className="block text-xs text-[#cdbb97]">{w.blurb}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {phase === "done" && outcome && (
                  <div className="mt-3">
                    <ul className="space-y-1.5 text-sm text-[#f3e4bf]">
                      {outcome.lines.map((l, i) => (
                        <li key={i} className="flex gap-2">
                          <span aria-hidden className="text-[#f6d77a]">✦</span>
                          <span>{l}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to="/analysis-queue" className="sal-btn">
                        Watch the queue
                      </Link>
                      <button type="button" className="sal-btn-ghost" onClick={() => { setOutcome(null); setChosen(null); setSeed((s) => s + 1); setPhase("asking"); }}>
                        Make another wish
                      </button>
                      <button type="button" className="sal-btn-ghost" onClick={close}>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="border-t border-[#3b2a16] px-4 py-2 text-[0.7rem] leading-snug text-[#a8977a]">{GENIE_DISCLAIMER}</p>
          </div>
        </div>
      )}
    </>
  );
}
