import { useState } from "react";
import { formatTag, groupScrolls, scrollLabel, loadOpened, saveOpened, unopenedCount, withOpened } from "../lib/scrolls";
import type { DocumentSummary } from "../lib/types";
import { DocumentReader } from "./DocumentReader";

/** Game mode G30: a holding's documents as a library. Three shelves (annual reports, quarterly and
 * half-year reports, miscellaneous); each document is a rolled scroll with a wax seal that breaks
 * when it is opened (per browser, and it says "opened", not "understood"). Pressing a scroll opens
 * it in the reader. Read-only apart from Delete, which is the same call the table used. */

function ScrollTile({
  doc,
  opened,
  onOpen,
  onDelete,
  deleting,
}: {
  doc: DocumentSummary;
  opened: boolean;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [reading, setReading] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const period = scrollLabel(doc);
  return (
    <li className="library-tile">
      <button
        type="button"
        className="library-scroll"
        data-opened={opened}
        aria-label={`Open ${doc.original_filename}${opened ? "" : ", sealed"}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${r.left + r.width / 2}px ${r.top + r.height / 2}px`);
          setReading(true);
          onOpen();
        }}
      >
        <span className="library-roller" aria-hidden="true" />
        <span className="library-paper">
          <span className="library-period">{period}</span>
          <span className="library-tag">{formatTag(doc.original_filename)}</span>
        </span>
        <span className="library-roller" aria-hidden="true" />
        <span className="library-seal" data-opened={opened} aria-hidden="true" />
      </button>
      {(doc.fact_count > 0 || doc.status !== "processed") && (
        <p className="library-facts">
          {[doc.fact_count > 0 ? `${doc.fact_count} figures` : "", doc.status !== "processed" ? doc.status : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <button type="button" className="library-delete" disabled={deleting} onClick={onDelete}>
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {reading && <DocumentReader document={doc} origin={origin} onClosed={() => setReading(false)} />}
    </li>
  );
}

export default function ScrollsLibrary({
  documents,
  deletingId,
  onDelete,
}: {
  documents: DocumentSummary[];
  deletingId: string | null;
  onDelete: (doc: DocumentSummary) => void;
}) {
  const [opened, setOpened] = useState<Set<string>>(() => loadOpened());
  const shelves = groupScrolls(documents);
  const sealed = unopenedCount(documents, opened);

  function markOpened(id: string) {
    setOpened((prev) => {
      const next = withOpened(prev, id);
      saveOpened(next);
      return next;
    });
  }

  return (
    <div className="library" aria-label="Scrolls">
      <p className="library-lead">
        {documents.length === 0
          ? "The shelves are empty."
          : sealed === 0
            ? "Every scroll has been opened. Opened is not the same as understood."
            : `${sealed} of ${documents.length} scroll${documents.length === 1 ? "" : "s"} still sealed in this browser.`}
      </p>
      {shelves.map((shelf) => (
        <section key={shelf.id} className="library-shelf" aria-label={shelf.title}>
          <h4 className="library-plaque">
            {shelf.title} <span className="library-count">{shelf.documents.length}</span>
          </h4>
          {shelf.documents.length === 0 ? (
            <p className="library-empty">{shelf.empty}</p>
          ) : (
            <ul className="library-row">
              {shelf.documents.map((d) => (
                <ScrollTile
                  key={d.id}
                  doc={d}
                  opened={opened.has(d.id)}
                  onOpen={() => markOpened(d.id)}
                  onDelete={() => onDelete(d)}
                  deleting={deletingId === d.id}
                />
              ))}
            </ul>
          )}
          <div className="library-plank" aria-hidden="true" />
        </section>
      ))}
    </div>
  );
}
