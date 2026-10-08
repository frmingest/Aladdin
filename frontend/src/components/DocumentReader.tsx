import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ApiError, api, fetchDocumentFile } from "../lib/api";
import { factFragment, pageFragment, viewKindOf } from "../lib/documents";
import { useGameMode } from "../lib/gameMode";
import {
  SCROLL_MS,
  defaultTint,
  initialPhase,
  isOpening,
  nextPhase,
  phaseDelay,
  scrollHeading,
  skipToOpen,
  type ScrollPhase,
} from "../lib/scroll";
import { factKey, jumpablePage } from "../lib/statements";
import type { DocumentFact } from "../lib/types";
import { ScrollRollers, ScrollSeal } from "./ScrollStage";
import { StatementsPane } from "./StatementsPane";

/** Minimum a stored-document reference has to carry to be readable. */
export interface ReadableDocument {
  id: string;
  original_filename: string;
  type?: string;
  reporting_period?: string | null;
  /** When known to be 0 the figures pane is skipped without asking the API. */
  fact_count?: number;
}

const PANE_MIN = 300;
const PANE_MAX = 760;
const PANE_DEFAULT = 440;

const EXIT_MS = 200;

function EyeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Eye button that opens a stored filing in an animated full-screen reader.
 * Drop it next to any reference to an uploaded document. */
export function DocumentReadButton({
  document,
  label = "Read",
  className = "",
  initialPage,
  focusMetric,
  focusPeriod,
}: {
  document: ReadableDocument;
  label?: string | null;
  className?: string;
  /** Open the filing at this page (the page a figure was taken from). */
  initialPage?: number | null;
  /** Emphasise this metric's row in the figures pane — and, with
   * `focusPeriod` and `initialPage`, open the filing at that exact number. */
  focusMetric?: string;
  focusPeriod?: string;
}) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  return (
    <>
      <button
        type="button"
        title={`Read ${document.original_filename}`}
        aria-label={`Read ${document.original_filename}`}
        onClick={(e) => {
          // The reader grows out of the button that was clicked.
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${r.left + r.width / 2}px ${r.top + r.height / 2}px`);
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-subtle ${className}`}
      >
        <EyeIcon />
        {label && <span>{label}</span>}
      </button>
      {open && <DocumentReader
          document={document}
          origin={origin}
          initialPage={initialPage}
          focusMetric={focusMetric}
          focusPeriod={focusPeriod}
          onClosed={() => setOpen(false)}
        />}
    </>
  );
}

export function DocumentReader({
  document: doc,
  origin,
  initialPage,
  focusMetric,
  focusPeriod,
  onClosed,
}: {
  document: ReadableDocument;
  origin: string;
  initialPage?: number | null;
  focusMetric?: string;
  focusPeriod?: string;
  onClosed: () => void;
}) {
  const kind = viewKindOf(doc.original_filename);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  // Game mode G28: the report opens as a parchment scroll. Off = this reader exactly as before.
  const { gameMode } = useGameMode();
  const [scrollOff, setScrollOff] = useState(false); // "Plain reader": back to the ordinary reader
  const scroll = gameMode && !scrollOff;
  const reducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const [phase, setPhase] = useState<ScrollPhase>(() => (scroll ? initialPhase(reducedMotion) : "open"));
  const [tint, setTint] = useState(() => defaultTint(kind));

  // Figures stored from this file, shown beside it. null = still loading.
  const expectsFigures = kind !== "download" && (doc.fact_count === undefined || doc.fact_count > 0);
  const [facts, setFacts] = useState<DocumentFact[] | null>(null);
  const [factsError, setFactsError] = useState(false);
  const [paneOpen, setPaneOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"document" | "figures">("document");
  const [paneWidth, setPaneWidth] = useState(PANE_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!expectsFigures) return;
    let cancelled = false;
    api
      .getDocument(doc.id)
      .then((detail) => {
        if (cancelled) return;
        setFacts(detail.facts);
        // Opened from one figure: mark it as the one the filing is showing.
        const opened = initialPage
          ? detail.facts.find(
              (f) =>
                f.metric === focusMetric &&
                f.source_page === initialPage &&
                (focusPeriod === undefined || f.period === focusPeriod),
            )
          : undefined;
        if (opened) setActiveKey(factKey(opened));
      })
      .catch(() => {
        if (!cancelled) setFactsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.id, expectsFigures, initialPage, focusMetric, focusPeriod]);

  // Opened from one figure (Metrics): land on that exact number when we know
  // which figure it is, otherwise on its page.
  const initialFragment =
    initialPage && focusMetric && focusPeriod
      ? factFragment(kind, { metric: focusMetric, period: focusPeriod, source_page: initialPage })
      : pageFragment(kind, initialPage);

  const paneVisible =
    expectsFigures && paneOpen && !error && (facts === null ? !factsError : facts.length > 0 || factsError);

  /** Scroll the filing to a figure — the number itself in XHTML (highlighted
   * by CSS `:target`), the page in a PDF. The iframe has no scripts, so this
   * is a plain fragment navigation on the same blob (no reload). Assigning
   * `src` imperatively also works when the same figure is pressed twice. */
  function jumpTo(fact: DocumentFact) {
    const frame = frameRef.current;
    if (!jumpablePage(fact) || !frame || !blobUrl) return;
    frame.src = `${blobUrl}${factFragment(kind, fact)}`;
    setActiveKey(factKey(fact));
    setMobileTab("document"); // on a narrow screen, show what was asked for
  }

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function drag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging || !splitRef.current) return;
    const rect = splitRef.current.getBoundingClientRect();
    const max = Math.min(PANE_MAX, rect.width - 360); // always leave the filing readable
    setPaneWidth(Math.round(Math.max(PANE_MIN, Math.min(max, rect.right - e.clientX))));
  }
  function dragKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") setPaneWidth((w) => Math.min(PANE_MAX, w + 24));
    else if (e.key === "ArrowRight") setPaneWidth((w) => Math.max(PANE_MIN, w - 24));
    else return;
    e.preventDefault();
  }

  const close = useCallback(() => {
    setClosing(true);
    if (scroll && !reducedMotion) setPhase("rolling");
    closeTimer.current = window.setTimeout(onClosed, scroll && !reducedMotion ? SCROLL_MS.roll : EXIT_MS);
  }, [onClosed, scroll, reducedMotion]);

  // The scroll opens by itself: seal, crack, unroll. It never blocks reading (any key skips it).
  useEffect(() => {
    if (!scroll) return;
    const delay = phaseDelay(phase);
    if (delay === null || phase === "rolling") return;
    const t = window.setTimeout(() => setPhase((p) => nextPhase(p)), delay);
    return () => window.clearTimeout(t);
  }, [scroll, phase]);

  useEffect(() => {
    if (!scroll || !isOpening(phase)) return;
    const onAnyKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") setPhase((p) => skipToOpen(p));
    };
    window.addEventListener("keydown", onAnyKey);
    return () => window.removeEventListener("keydown", onAnyKey);
  }, [scroll, phase]);

  // Fetch with the API key (a bare link can't send the header) and show it
  // from a blob. Nothing loads for download-only types.
  useEffect(() => {
    if (kind === "download") return;
    const controller = new AbortController();
    let url: string | null = null;
    fetchDocumentFile(doc.id, controller.signal)
      .then((blob) => {
        const typed =
          kind === "pdf" ? new Blob([blob], { type: "application/pdf" }) : new Blob([blob], { type: "text/html" });
        url = URL.createObjectURL(typed);
        setBlobUrl(url);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Could not load the file.");
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden"; // read mode: page behind doesn't scroll
    return () => {
      window.removeEventListener("keydown", onKey);
      window.document.body.style.overflow = previousOverflow;
      window.clearTimeout(closeTimer.current);
    };
  }, [close]);

  async function download() {
    try {
      const blob = await fetchDocumentFile(doc.id);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download the file.");
    }
  }

  const heading = scrollHeading(doc);
  const subtitle = [doc.type?.replace(/_/g, " "), doc.reporting_period].filter(Boolean).join(" · ");

  return createPortal(
    <div className="fixed inset-0 z-50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Reading ${doc.original_filename}`}>
      <button
        type="button"
        aria-label="Close reader"
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm motion-reduce:animate-none ${
          closing ? "animate-reader-backdrop-out" : "animate-reader-backdrop-in"
        }`}
      />
      <div className={`relative mx-auto h-full w-full ${paneVisible ? "max-w-[96rem]" : "max-w-6xl"}`}>
      <div
        style={{ transformOrigin: origin }}
        data-phase={scroll ? phase : undefined}
        className={`relative flex h-full w-full flex-col overflow-hidden motion-reduce:animate-none ${
          scroll
            ? "scroll-paper rounded-lg pt-7 pb-7"
            : `rounded-xl border border-border bg-surface shadow-card ${
                closing ? "animate-reader-panel-out" : scrollOff ? "" : "animate-reader-panel-in"
              }`
        }`}
      >
        <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <EyeIcon className="h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-semibold tracking-tight text-ink">{doc.original_filename}</h2>
            {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {/* New tab only for PDFs: an HTML filing in its own tab would run
              with this app's origin, and filings are untrusted input. */}
          {kind === "pdf" && blobUrl && (
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-subtle"
            >
              Open in new tab ↗
            </a>
          )}
          {scroll && kind !== "download" && (
            <button
              type="button"
              onClick={() => setTint((v) => !v)}
              aria-pressed={tint}
              title="Show the page on parchment (multiplies the page onto the paper)"
              className="hidden rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-subtle sm:inline-block"
            >
              Parchment tint
            </button>
          )}
          {scroll && (
            <button
              type="button"
              onClick={() => {
                setScrollOff(true);
                setPhase("open");
              }}
              className="hidden rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-border-subtle hover:text-ink sm:inline-block"
            >
              Plain reader
            </button>
          )}
          {expectsFigures && (facts === null || facts.length > 0) && (
            <button
              type="button"
              onClick={() => setPaneOpen((v) => !v)}
              aria-pressed={paneOpen}
              className="hidden rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-subtle lg:inline-block"
            >
              {paneOpen ? "Hide figures" : "Show figures"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void download()}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-border-subtle hover:text-ink"
          >
            Download
          </button>
          <button
            type="button"
            aria-label="Close reader"
            onClick={close}
            className="rounded-md p-1 text-ink-faint hover:bg-border-subtle hover:text-ink"
          >
            ✕
          </button>
        </header>

        {paneVisible && (
          <div role="tablist" aria-label="Reader view" className="flex border-b border-border-subtle lg:hidden">
            {(["document", "figures"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mobileTab === tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  mobileTab === tab ? "border-b-2 border-accent text-ink" : "text-ink-muted"
                }`}
              >
                {tab === "document" ? "Filing" : "Figures"}
              </button>
            ))}
          </div>
        )}

        <div
          ref={splitRef}
          style={{ "--pane-w": `${paneWidth}px` } as CSSProperties}
          className={`relative flex min-h-0 flex-1 flex-col motion-reduce:animate-none lg:flex-row ${
            scroll ? "" : "bg-background animate-reader-content-in"
          }`}
        >
          <div className={`relative min-h-0 min-w-0 flex-1 ${paneVisible && mobileTab === "figures" ? "hidden lg:block" : ""}`}>
            {kind === "download" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-ink">This file type can&apos;t be shown in the browser.</p>
                <p className="text-xs text-ink-muted">Download it to open in Excel, PowerPoint or a text editor.</p>
                <button
                  type="button"
                  onClick={() => void download()}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-onfill hover:bg-accent-hover"
                >
                  Download {doc.original_filename}
                </button>
              </div>
            ) : error ? (
              <p className="p-6 text-sm text-negative">{error}</p>
            ) : !blobUrl ? (
              <p className="p-6 text-sm text-ink-muted">Opening report…</p>
            ) : kind === "pdf" ? (
              <iframe
                ref={frameRef}
                title={doc.original_filename}
                src={`${blobUrl}${initialFragment}`}
                className={`h-full w-full border-0 ${scroll && tint ? "mix-blend-multiply" : ""} ${dragging ? "pointer-events-none" : ""}`}
              />
            ) : (
              // Empty sandbox: no scripts, forms, popups or same-origin access.
              // White page — filings are styled for paper, not the dark theme.
              <iframe
                ref={frameRef}
                title={doc.original_filename}
                src={`${blobUrl}${initialFragment}`}
                sandbox=""
                className={`h-full w-full border-0 bg-white ${scroll && tint ? "mix-blend-multiply" : ""} ${dragging ? "pointer-events-none" : ""}`}
              />
            )}
          </div>

          {paneVisible && (
            <>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize figures pane"
                aria-valuenow={paneWidth}
                aria-valuemin={PANE_MIN}
                aria-valuemax={PANE_MAX}
                tabIndex={0}
                onPointerDown={startDrag}
                onPointerMove={drag}
                onPointerUp={() => setDragging(false)}
                onPointerCancel={() => setDragging(false)}
                onKeyDown={dragKey}
                className={`hidden w-1.5 shrink-0 cursor-col-resize touch-none transition-colors hover:bg-accent focus-visible:bg-accent lg:block ${
                  dragging ? "bg-accent" : "bg-border-subtle"
                }`}
              />
              <aside
                aria-label="Figures from this filing"
                className={`min-h-0 lg:w-[var(--pane-w)] lg:shrink-0 ${scroll ? "scroll-paper-margin" : "bg-surface"} ${
                  mobileTab === "figures" ? "block flex-1 lg:flex-none" : "hidden lg:block"
                }`}
              >
                {factsError ? (
                  <p className="p-4 text-sm text-negative">Could not load the figures for this file.</p>
                ) : facts === null ? (
                  <p className="p-4 text-sm text-ink-muted">Loading figures…</p>
                ) : (
                  <StatementsPane
                    facts={facts}
                    activeKey={activeKey}
                    focusMetric={focusMetric}
                    canJump={blobUrl !== null}
                    onJump={jumpTo}
                  />
                )}
              </aside>
            </>
          )}
        </div>
      </div>
      {scroll && <ScrollRollers phase={phase} />}
      {scroll && (
        <ScrollSeal
          phase={phase}
          kicker={heading.kicker}
          title={heading.title}
          onBreak={() => setPhase((p) => nextPhase(p))}
        />
      )}
      </div>
    </div>,
    window.document.body,
  );
}
