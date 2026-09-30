/** How a stored filing can be shown back in the browser. Mirrors
 * backend/app/services/documents/viewing.py (decided by file extension). */
export type DocumentViewKind = "pdf" | "html" | "download";

export function viewKindOf(filename: string): DocumentViewKind {
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  return "download";
}
