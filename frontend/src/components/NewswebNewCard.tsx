import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import { formatDate } from "../lib/format";
import { categoryOf, headline, isReport, sortItems } from "../lib/newswebNew";
import type { NewswebNew } from "../lib/types";
import { Button, Card, SectionTitle } from "./ui";

const SHOWN = 6;

/** Dashboard card: announcements the hourly Newsweb watch found for the Oslo holdings you own or watch,
 * until you mark them seen. Reads the database only (GET /sources/newsweb/new). Renders nothing when
 * there is nothing new, in demo mode, or when the call fails: it is a hint, never a blocker. A new
 * report is also fetched on its own by the backend, so it lands as a raven and a scroll in game mode. */
export function NewswebNewCard() {
  const query = useCachedQuery<NewswebNew>("newsweb-new", () => api.getNewswebNew());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = query.data;
  if (!data || data.count === 0) return null;
  const items = sortItems(data.items);

  const markSeen = () => {
    setBusy(true);
    setError(null);
    api
      .acknowledgeNewsweb()
      .then(() => query.reload())
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not mark them as seen."))
      .finally(() => setBusy(false));
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <SectionTitle hint="Found by the hourly Newsweb check. Titles are the issuers' own words.">
          New on Newsweb
        </SectionTitle>
        <Button variant="secondary" onClick={markSeen} disabled={busy}>
          {busy ? "Saving…" : "Mark all as seen"}
        </Button>
      </div>
      <p className="mb-2 text-sm text-ink-muted">{headline(items)}</p>
      <ul className="space-y-1.5">
        {items.slice(0, SHOWN).map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="tabular shrink-0 text-xs text-ink-muted">{item.ticker}</span>
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate text-accent hover:text-accent-hover"
            >
              {item.title}
            </a>
            <span className="shrink-0 text-xs text-ink-muted">
              {isReport(item) ? "Report" : (categoryOf(item) ?? "Announcement")}
              {item.published_at ? ` · ${formatDate(item.published_at)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {items.length > SHOWN && (
        <p className="mt-2 text-xs text-ink-muted">and {items.length - SHOWN} more</p>
      )}
      {error && <p className="mt-2 text-xs text-negative">{error}</p>}
    </Card>
  );
}
