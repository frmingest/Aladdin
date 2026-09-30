import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, fetchDocumentFile } from "../lib/api";
import { viewKindOf } from "../lib/documents";

/** Minimum a stored-document reference has to carry to be readable. */
export interface ReadableDocument {
  id: string;
  original_filename: string;
  type?: string;
  reporting_period?: string | null;
}

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
}: {
  document: ReadableDocument;
  label?: string | null;
  className?: string;
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
      {open && <DocumentReader document={document} origin={origin} onClosed={() => setOpen(false)} />}
    </>
  );
}

function DocumentReader({
  document: doc,
  origin,
  onClosed,
}: {
  document: ReadableDocument;
  origin: string;
  onClosed: () => void;
}) {
  const kind = viewKindOf(doc.original_filename);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setClosing(true);
    closeTimer.current = window.setTimeout(onClosed, EXIT_MS);
  }, [onClosed]);

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
      <div
        style={{ transformOrigin: origin }}
        className={`relative mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card motion-reduce:animate-none ${
          closing ? "animate-reader-panel-out" : "animate-reader-panel-in"
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

        <div className="relative min-h-0 flex-1 bg-background motion-reduce:animate-none animate-reader-content-in">
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
            <iframe title={doc.original_filename} src={blobUrl} className="h-full w-full border-0" />
          ) : (
            // Empty sandbox: no scripts, forms, popups or same-origin access.
            // White page — filings are styled for paper, not the dark theme.
            <iframe title={doc.original_filename} src={blobUrl} sandbox="" className="h-full w-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>,
    window.document.body,
  );
}
