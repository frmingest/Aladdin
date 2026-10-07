import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { checkLabel, checkTone, scopeLabel } from "../lib/tagReview";
import type { TagCandidate, TagGap, TagReview, TagReviewHolding } from "../lib/types";
import { Button, Card, EmptyState, PageHeader } from "../components/ui";

/** Tag review inbox (PR 1, read-only). After a Newsweb fetch, lists the inputs
 * the ESEF extractor could not fill and the tagged lines that look closest,
 * so a mapping fix can be decided without feeding the .xhtml into a chat.
 * Nothing here changes any figure. Backend: app/services/tag_review.py. */

const TONE_STYLE = {
  good: "bg-positive-subtle text-positive",
  warn: "bg-negative-subtle text-negative",
  plain: "bg-border-subtle text-ink-muted",
} as const;

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed";
}

function CandidateRow({ c }: { c: TagCandidate }) {
  return (
    <li className="py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="break-all text-xs text-ink">{c.concept}</code>
        <span className="tabular-nums text-ink">
          {c.value} {c.unit}
        </span>
        {c.prior_year_value && <span className="text-xs text-ink-faint">prior year {c.prior_year_value}</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_STYLE[checkTone(c.check)]}`} title={c.check_detail}>
          {checkLabel(c.check)}
        </span>
        <span className="text-ink-muted">{scopeLabel(c.suggested_scope)}</span>
        {c.warning && <span className="text-caution">{c.warning}</span>}
      </div>
      {c.check !== "no_check" && <p className="mt-1 text-xs text-ink-faint">{c.check_detail}</p>}
    </li>
  );
}

function GapBlock({ gap }: { gap: TagGap }) {
  const [first, rest] = [gap.candidates.slice(0, 2), gap.candidates.slice(2)];
  return (
    <div className="border-t border-border pt-3">
      <h4 className="text-sm font-semibold text-ink">
        {gap.metric} <span className="font-normal text-ink-faint">not extracted</span>
      </h4>
      {gap.candidates.length === 0 ? (
        <p className="mt-1 text-xs text-ink-muted">
          No tagged line looks close. The filing may not tag it on the face of the statements; a statement CSV upload
          would be the route.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border">{first.map((c) => <CandidateRow key={c.concept} c={c} />)}</ul>
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-accent">Show {rest.length} more</summary>
              <ul className="divide-y divide-border">{rest.map((c) => <CandidateRow key={c.concept} c={c} />)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function HoldingCard({ row }: { row: TagReviewHolding }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.chat_summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">
            <Link to={`/holdings/${row.holding_id}`} className="hover:underline">
              {row.name}
            </Link>{" "}
            <span className="text-sm font-normal text-ink-faint">{row.ticker}</span>
          </h3>
          <p className="text-xs text-ink-faint">
            {row.fiscal_year} · {row.filename}
          </p>
        </div>
        <Button variant="secondary" onClick={copy} title="Copies a short text block to paste into a chat">
          {copied ? "Copied" : "Copy for chat"}
        </Button>
      </div>

      {row.gaps.map((gap) => (
        <GapBlock key={gap.metric} gap={gap} />
      ))}

      {row.unused.length > 0 && (
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Large tagged numbers nothing reads ({row.unused.length})
          </summary>
          <p className="mt-1 text-xs text-ink-faint">
            Monetary lines on the statements above 2% of revenue (or total assets) that no metric uses. These are
            where a one-off such as a sold business hides.
          </p>
          <ul className="mt-1 divide-y divide-border">
            {row.unused.map((u) => (
              <li key={u.concept} className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm">
                <code className="break-all text-xs text-ink">{u.concept}</code>
                <span className="tabular-nums text-ink">
                  {u.value} {u.unit}
                </span>
                <span className="text-xs text-ink-faint">
                  {u.share_of_base} · {u.statement}
                  {u.extension ? " · company's own tag" : ""}
                  {u.prior_year_value ? ` · prior year ${u.prior_year_value}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export default function TagReviewPage() {
  const [review, setReview] = useState<TagReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTagReview().then(setReview).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div>
      <PageHeader
        title="Tag review"
        subtitle="Inputs the annual-report tags did not fill, and the tagged lines that look closest. Read-only: nothing here changes a figure."
      />
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {!review && !error && <p className="text-sm text-ink-muted">Loading…</p>}
      {review && review.holdings.length === 0 && (
        <EmptyState>
          Nothing to review. Run <strong>Fetch all reports</strong> on a holding and any gaps will show up here.
        </EmptyState>
      )}
      {review && review.holdings.length > 0 && (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            {review.holdings_needing_review} holding{review.holdings_needing_review === 1 ? "" : "s"} with a gap,{" "}
            {review.total_gaps} input{review.total_gaps === 1 ? "" : "s"} in total. Newest report per company.
          </p>
          <div className="space-y-4">
            {review.holdings.map((row) => (
              <HoldingCard key={row.holding_id} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
