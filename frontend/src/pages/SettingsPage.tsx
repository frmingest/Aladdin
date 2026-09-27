import { useState } from "react";
import { ApiError } from "../lib/api";
import { useDemoMode } from "../lib/demoMode";
import { useAnalystMode } from "../lib/analystMode";
import { MODE_OPTIONS } from "../lib/analystTypes";
import { Card, PageHeader, SectionTitle } from "../components/ui";

/**
 * Settings page (2026-09-26) — currently just the demo-mode toggle. See
 * backend/app/api/settings.py / app/services/settings/demo_mode.py.
 *
 * The safety guarantee below is load-bearing copy, not marketing: it is
 * what app/services/settings/demo_guard.py and the demo checks at the top
 * of every real-data endpoint in app/api/*.py actually enforce — the real
 * code path never runs while this is on, not just its output swapped.
 */
export default function SettingsPage() {
  const { demoMode, setDemoMode } = useDemoMode();
  const analyst = useAnalystMode();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (demoMode === null) return;
    setPending(true);
    setError(null);
    try {
      await setDemoMode(!demoMode);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the backend.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader title="Settings" subtitle="App-wide settings for this deployment." />

      <Card>
        <SectionTitle hint="Show a fixed, fabricated portfolio instead of real data">
          Demo mode
        </SectionTitle>

        <div className="flex items-start justify-between gap-6">
          <div className="max-w-md space-y-2 text-sm text-ink-muted">
            <p>
              Turns every page into a fixed set of fabricated US large-cap holdings — accounts,
              prices, valuations, verdicts, thesis tripwires, risk, performance, precious metals,
              journal, watchlist and macro data are all made up.
            </p>
            <p className="font-medium text-ink">
              Real portfolio data, documents and research are never read while this is on. Every
              real-data endpoint checks demo mode first and returns fabricated data (or a 403 for
              anything that would touch a real upload or a live provider) before its normal code
              runs at all — not just a swapped-out response.
            </p>
            <p>Turning this off restores the app to exactly today&apos;s behaviour.</p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={demoMode === true}
            disabled={demoMode === null || pending}
            onClick={toggle}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              demoMode ? "bg-accent" : "bg-border"
            }`}
            title={demoMode ? "Turn demo mode off" : "Turn demo mode on"}
          >
            <span
              aria-hidden
              className={`inline-block h-5 w-5 rounded-full bg-onfill shadow transition-transform ${
                demoMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-ink-faint">
          Currently{" "}
          <span className={demoMode ? "text-caution" : "text-positive"}>
            {demoMode === null ? "checking…" : demoMode ? "ON" : "OFF"}
          </span>
        </p>

        {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      </Card>

      <Card className="mt-6">
        <SectionTitle hint="Epic F22 — the same switch as the top bar; applies to every page">
          Analyst modes
        </SectionTitle>
        <div className="space-y-2">
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                analyst.mode === opt.value ? "border-accent bg-accent-subtle" : "border-border hover:bg-border-subtle"
              }`}
            >
              <input
                type="radio"
                name="analyst-mode"
                checked={analyst.mode === opt.value}
                onChange={() => void analyst.setMode(opt.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{opt.label}</span>
                <span className="block text-xs text-ink-muted">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          In side-by-side mode, a holding missing the other analyst&apos;s run (or with one more than 30 days
          older than its partner) gets it queued automatically on your PC&apos;s local LLM — never on Gemini —
          at most 20 automatic runs per 24 hours. Automatic runs are marked &ldquo;auto&rdquo; on the Analysis
          queue page.
        </p>

        <div className="mt-5 flex items-start justify-between gap-6 border-t border-border-subtle pt-4">
          <div className="max-w-md space-y-1 text-sm text-ink-muted">
            <p className="font-medium text-ink">&ldquo;Where they&apos;d argue&rdquo; synthesis</p>
            <p>
              Adds a button in side-by-side mode for an optional, clearly labelled model pass that reads both
              analyses and lays out where they agree and disagree. It never changes either verdict. Off by
              default; each run spends one call on the server&apos;s LLM.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={analyst.synthesisEnabled}
            disabled={!analyst.loaded}
            onClick={() => void analyst.setSynthesisEnabled(!analyst.synthesisEnabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              analyst.synthesisEnabled ? "bg-accent" : "bg-border"
            }`}
            title={analyst.synthesisEnabled ? "Turn the synthesis off" : "Turn the synthesis on"}
          >
            <span
              aria-hidden
              className={`inline-block h-5 w-5 rounded-full bg-onfill shadow transition-transform ${
                analyst.synthesisEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {analyst.error && <p className="mt-3 text-sm text-negative">{analyst.error}</p>}
      </Card>
    </div>
  );
}
