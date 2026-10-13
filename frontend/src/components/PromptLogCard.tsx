import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { providerLabel } from "../lib/promptLog";
import type { PromptLogDetail, PromptLogItem, PromptLogList } from "../lib/types";
import { Button, Card, SectionTitle } from "./ui";

/** System status > Prompt log. Shows the exact text the app sent to Gemini or
 * the local model, and the raw reply (GET /system/prompt-log, database only —
 * opening it never calls a provider). Rows hold real portfolio evidence, so
 * the backend hides them in demo mode and purges them after the retention
 * window. */

const PAGE = 25;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" }) : iso;
}

function kb(chars: number): string {
  return chars >= 1000 ? `${(chars / 1000).toFixed(1)}k chars` : `${chars} chars`;
}

export function PromptLogRows({
  items,
  selectedId,
  onSelect,
}: {
  items: PromptLogItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect?.(item.id)}
            className={`flex w-full flex-col gap-0.5 px-1 py-2.5 text-left text-sm hover:bg-border-subtle ${
              selectedId === item.id ? "bg-border-subtle" : ""
            }`}
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
              <span className="tabular">{when(item.occurred_at)}</span>
              <span className="text-ink">{providerLabel(item.provider)}</span>
              <span>{item.model_name}</span>
              <span>{item.schema_name ?? item.call_type}</span>
              <span className={item.outcome === "success" ? "text-positive" : "text-negative"}>
                {item.outcome === "success" ? "OK" : "Failed"}
              </span>
              <span className="tabular">{kb(item.prompt_chars)}</span>
            </span>
            <span className="truncate text-ink">{item.preview}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CopyBlock({ title, text }: { title: string; text: string | null }) {
  const [copied, setCopied] = useState(false);
  if (text === null || text === "") return null;
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{title}</p>
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-canvas p-3 text-xs text-ink">
        {text}
      </pre>
    </div>
  );
}

export function PromptDetail({ detail }: { detail: PromptLogDetail }) {
  return (
    <div className="mt-4 border-t border-border-subtle pt-4">
      <p className="text-xs text-ink-muted">
        {when(detail.occurred_at)} · {providerLabel(detail.provider)} · {detail.model_name} · {detail.call_type}
        {detail.input_tokens != null && ` · ${detail.input_tokens} tokens in`}
        {detail.output_tokens != null && ` / ${detail.output_tokens} out`}
        {detail.latency_ms != null && ` · ${(detail.latency_ms / 1000).toFixed(1)} s`}
      </p>
      {detail.error_detail && <p className="mt-2 text-sm text-negative">{detail.error_detail}</p>}
      <CopyBlock title="System prompt" text={detail.system_prompt} />
      <CopyBlock title="User prompt (what the model was given)" text={detail.user_prompt} />
      <CopyBlock title="Model reply" text={detail.response_text} />
    </div>
  );
}

export default function PromptLogCard() {
  const [list, setList] = useState<PromptLogList | null>(null);
  const [provider, setProvider] = useState("");
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<PromptLogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getPromptLog({ provider, outcome, search: search.trim(), limit: PAGE, offset })
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch(() => setError("Could not load the prompt log."));
  }, [provider, outcome, search, offset]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api
      .getPromptLogDetail(selected)
      .then(setDetail)
      .catch((e) => {
        setDetail(null);
        setError(e instanceof ApiError ? e.message : "Could not open that entry.");
      });
  }, [selected]);

  const resetPaging = () => {
    setOffset(0);
    setSelected(null);
  };

  return (
    <Card>
      <SectionTitle hint="The exact prompts sent to Gemini and the local model, with the raw reply. Stored in your database and deleted automatically after the retention window. Hidden in demo mode.">
        Prompt log
      </SectionTitle>
      {error && <p className="mb-2 text-sm text-negative">{error}</p>}
      {list && !list.enabled && (
        <p className="mb-2 text-sm text-caution">Prompt logging is switched off (LLM_PROMPT_LOG_ENABLED). Existing entries are still shown.</p>
      )}
      {list?.demo_mode && <p className="text-sm text-ink-muted">Hidden while demo mode is on.</p>}
      {list && !list.demo_mode && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                resetPaging();
              }}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
            >
              <option value="">All providers</option>
              {list.providers.map((p) => (
                <option key={p} value={p}>
                  {providerLabel(p)}
                </option>
              ))}
            </select>
            <select
              aria-label="Outcome"
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                resetPaging();
              }}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
            >
              <option value="">Any outcome</option>
              <option value="success">Succeeded</option>
              <option value="error">Failed</option>
            </select>
            <input
              type="search"
              aria-label="Search prompts"
              placeholder="Search prompt text…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPaging();
              }}
              className="min-w-[12rem] flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
            />
          </div>
          {list.items.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No prompts logged{provider || outcome || search ? " for these filters" : " yet"}. New LLM calls appear here
              as they happen (kept {list.retention_days > 0 ? `${list.retention_days} days` : "forever"}).
            </p>
          ) : (
            <>
              <PromptLogRows items={list.items} selectedId={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
              <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                <span className="tabular">
                  {offset + 1}–{Math.min(offset + PAGE, list.total)} of {list.total}
                </span>
                <span className="flex gap-2">
                  <Button variant="secondary" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - PAGE)); setSelected(null); }}>
                    Newer
                  </Button>
                  <Button variant="secondary" disabled={offset + PAGE >= list.total} onClick={() => { setOffset(offset + PAGE); setSelected(null); }}>
                    Older
                  </Button>
                </span>
              </div>
            </>
          )}
          {detail && <PromptDetail detail={detail} />}
        </>
      )}
    </Card>
  );
}
