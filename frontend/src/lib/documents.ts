/** How a stored filing can be shown back in the browser. Mirrors
 * backend/app/services/documents/viewing.py (decided by file extension). */
export type DocumentViewKind = "pdf" | "html" | "download";

export function viewKindOf(filename: string): DocumentViewKind {
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  return "download";
}

/** URL fragment that opens a document at a page. PDFs use the browser
 * viewer's `#page=N`; XHTML filings use the `aladdin-page-N` anchors the
 * backend adds when it serves the file (backend/app/services/documents/
 * anchoring.py). Returns "" when there is nothing to jump to. */
export function pageFragment(kind: DocumentViewKind, page: number | null | undefined): string {
  if (!page || page < 1 || !Number.isInteger(page)) return "";
  if (kind === "pdf") return `#page=${page}`;
  if (kind === "html") return `#aladdin-page-${page}`;
  return "";
}
