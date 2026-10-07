import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  acceptScopeText,
  checkLabel,
  checkTone,
  pendingHoldings,
  reextractSummary,
  ruleScopeLabel,
  ruleStatusLabel,
  scopeLabel,
  secondConfirmationText,
} from "../lib/tagReview";
import type { TagCandidate, TagGap, TagReview, TagReviewHolding, TagRule } from "../lib/types";
import { Button, Card, EmptyState, PageHeader } from "../components/ui";

/** Tag review inbox. After a Newsweb fetch, lists the inputs the ESEF extractor
 * could not fill and the tagged lines that look closest. PR 2: a suggestion can
 * be saved as a mapping rule (a standard tag for all companies, a company's own
 * tag for that company only) or rejected; a suggestion that failed its own check
 * needs a second confirmation. A rule changes no figure until the company is
 * re-extracted. Backend: app/services/tag_rules.py. */

const TONE_STYLE = {
  good: "bg-positive-subtle text-positive",
  warn: "bg-negative-subtle text-negative",
  plain: "bg-border-subtle text-ink-muted",
} as const;

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed";
}

interface Actions {
  busy: boolean;
  accept: (gap: TagGap, c: TagCandidate, confirmFailedCheck: boolean) => Promise<void>;
  reject: (gap: TagGap, c: TagCandidate) => Promise<void>;
}

function CandidateRow({ c, gap, company, actions }: { c: TagCandidate; gap: TagGap; company: string; actions: Actions }) {
  const [confirming, setConfirming] = useState(false);
  const accepted = c.decision === "accepted";
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

      {accepted ? (
        <p className="mt-2 text-xs font-medium text-positive">
          Rule saved. The figure appears after you re-extract {company}.
        </p>
      ) : confirming ? (
        <div className="mt-2 rounded-md border border-negative bg-negative-subtle p-2 text-xs text-negative">
          <p>{secondConfirmationText(c)}</p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="danger"
              disabled={actions.busy}
              onClick={() => actions.accept(gap, c, true).finally(() => setConfirming(false))}
            >
              Yes, accept anyway
            </Button>
            <Button variant="secondary" disabled={actions.busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={actions.busy}
            title={acceptScopeText(c, company)}
            onClick={() => (c.needs_second_confirmation ? setConfirming(true) : actions.accept(gap, c, false))}
          >
            Use this tag
          </Button>
          <Button variant="secondary" disabled={actions.busy} onClick={() => actions.reject(gap, c)}>
            Not this one
          </Button>
          <span className="text-xs text-ink-faint">{acceptScopeText(c, company)}</span>
        </div>
      )}
    </li>
  );
}

function GapBlock({ gap, company, actions }: { gap: TagGap; company: string; actions: Actions }) {
  const [first, rest] = [gap.candidates.slice(0, 2), gap.candidates.slice(2)];
  const row = (c: TagCandidate) => <CandidateRow key={c.concept} c={c} gap={gap} company={company} actions={actions} />;
  return (
    <div className="border-t border-border pt-3">
      <h4 className="text-sm font-semibold text-ink">
        {gap.metric} <span className="font-normal text-ink-faint">not extracted</span>
      </h4>
      {gap.candidates.length === 0 ? (
        <p className="mt-1 text-xs text-ink-muted">
          {gap.rejected_hidden > 0
            ? `${gap.rejected_hidden} suggestion${gap.rejected_hidden === 1 ? "" : "s"} rejected; none left. `
            : "No tagged line looks close. "}
          The filing may not tag it on the face of the statements; a statement CSV upload would be the route.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border">{first.map(row)}</ul>
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-accent">Show {rest.length} more</summary>
              <ul className="divide-y divide-border">{rest.map(row)}</ul>
            </details>
          )}
          {gap.rejected_hidden > 0 && (
            <p className="mt-1 text-xs text-ink-faint">
              {gap.rejected_hidden} rejected suggestion{gap.rejected_hidden === 1 ? "" : "s"} hidden (bring back under
              Saved rules).
            </p>
          )}
        </>
      )}
    </div>
  );
}

function HoldingCard({
  row,
  actions,
  onReextract,
  reextracting,
}: {
  row: TagReviewHolding;
  actions: Actions;
  onReextract: (row: TagReviewHolding) => void;
  reextracting: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const pending = row.gaps.some((g) => g.rule_pending);

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
        <div className="flex flex-wrap gap-2">
          <Button
            variant={pending ? "primary" : "secondary"}
            disabled={reextracting || actions.busy}
            onClick={() => onReextract(row)}
            title="Reads this company's stored reports again with the saved rules. Text and pages are not touched."
          >
            {reextracting ? "Re-extracting…" : `Re-extract ${row.ticker}`}
          </Button>
          <Button variant="secondary" onClick={copy} title="Copies a short text block to paste into a chat">
            {copied ? "Copied" : "Copy for chat"}
          </Button>
        </div>
      </div>

      {row.gaps.map((gap) => (
        <GapBlock key={gap.metric} gap={gap} company={row.name} actions={actions} />
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

function RulesCard({ rules, busy, onRemove }: { rules: TagRule[]; busy: boolean; onRemove: (r: TagRule) => void }) {
  if (rules.length === 0) return null;
  return (
    <Card className="mt-6 space-y-2">
      <h3 className="text-base font-semibold text-ink">Saved rules</h3>
      <p className="text-xs text-ink-faint">
        A rule is read only when the built-in mapping finds nothing for that input, and its figures show their source as
        &quot;rule: …&quot;. Removing one changes nothing until the company is re-extracted.
      </p>
      <ul className="divide-y divide-border">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <code className="break-all text-xs text-ink">{r.concept}</code>{" "}
              <span className="text-ink">→ {r.metric_label}</span>
              <p className="text-xs text-ink-faint">
                {ruleStatusLabel(r)} · {ruleScopeLabel(r)}
                {r.fiscal_year ? ` · from ${r.fiscal_year}` : ""}
                {r.check_overridden && r.check_detail ? ` · ${r.check_detail}` : ""}
              </p>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => onRemove(r)}>
              {r.status === "rejected" ? "Bring back" : "Remove rule"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function TagReviewPage() {
  const [review, setReview] = useState<TagReview | null>(null);
  const [rules, setRules] = useState<TagRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reextracting, setReextracting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, rl] = await Promise.all([api.getTagReview(), api.getTagRules()]);
    setReview(r);
    setRules(rl.rules);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const actions: Actions = {
    busy,
    accept: (gap, c, confirm) => {
      const row = review?.holdings.find((h) => h.gaps.includes(gap));
      if (!row) return Promise.resolve();
      return run(() =>
        api.acceptTagRule({ holding_id: row.holding_id, metric: gap.metric, concept: c.concept, confirm_failed_check: confirm }),
      );
    },
    reject: (gap, c) => {
      const row = review?.holdings.find((h) => h.gaps.includes(gap));
      if (!row) return Promise.resolve();
      return run(() => api.rejectTagSuggestion({ holding_id: row.holding_id, metric: gap.metric, concept: c.concept }));
    },
  };

  async function reextract(rows: TagReviewHolding[]) {
    setError(null);
    setNotice([]);
    const lines: string[] = [];
    try {
      for (const row of rows) {
        setReextracting(row.holding_id);
        lines.push(reextractSummary(await api.reextractHolding(row.holding_id)));
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setReextracting(null);
      setNotice(lines);
      await load().catch((e) => setError(errorText(e)));
    }
  }

  const pending = review ? pendingHoldings(review) : [];

  return (
    <div>
      <PageHeader
        title="Tag review"
        subtitle="Inputs the annual-report tags did not fill, and the tagged lines that look closest. Use a tag to save it as a rule; nothing changes a figure until you re-extract."
      />
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {notice.length > 0 && (
        <div className="mb-3 rounded-md bg-positive-subtle px-3 py-2 text-xs text-positive">
          {notice.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {!review && !error && <p className="text-sm text-ink-muted">Loading…</p>}
      {review && review.holdings.length === 0 && (
        <EmptyState>
          Nothing to review. Run <strong>Fetch all reports</strong> on a holding and any gaps will show up here.
        </EmptyState>
      )}
      {review && review.holdings.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {review.holdings_needing_review} holding{review.holdings_needing_review === 1 ? "" : "s"} with a gap,{" "}
              {review.total_gaps} input{review.total_gaps === 1 ? "" : "s"} in total. Newest report per company.
            </p>
            {pending.length > 1 && (
              <Button disabled={busy || reextracting !== null} onClick={() => reextract(pending)}>
                Re-extract the {pending.length} companies with a saved rule
              </Button>
            )}
          </div>
          <div className="space-y-4">
            {review.holdings.map((row) => (
              <HoldingCard
                key={row.holding_id}
                row={row}
                actions={actions}
                reextracting={reextracting === row.holding_id}
                onReextract={(r) => reextract([r])}
              />
            ))}
          </div>
        </>
      )}
      <RulesCard rules={rules} busy={busy} onRemove={(r) => run(() => api.removeTagRule(r.id))} />
    </div>
  );
}
