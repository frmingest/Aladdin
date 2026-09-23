# Local LLM engine, ticker convention, UI tweaks — 2026-09-23

**Status:** written and tested, not yet deployed. Setup guide: [local-llm-ollama-setup.md](local-llm-ollama-setup.md).

## 1. Local LLM engine (Ollama)

| What | Detail |
|---|---|
| New provider | `app/providers/ollama_provider.py` — third `LLMProvider` next to Gemini/Mistral. Calls Ollama's `/api/chat` via httpx (no new dependency) with `format=<JSON schema>`, so output is schema-constrained like Gemini's. |
| Split | `LLM_PROVIDER=ollama` moves the two analysis passes to the local GPU. Research stays on Gemini + Google Search (no local equivalent). Numbers stay in Python. |
| Safety guards | Refuses a prompt that fills the context window (Ollama would silently cut evidence — CLAUDE.md Rule 2), refuses truncated output, clear messages for "not running" / "model not pulled" / timeout. Retries connection errors only. |
| Fallback | `LLM_FALLBACK_PROVIDER` now also accepts `google_ai_studio` — Gemini only when Ollama is down. Default `none`. |
| Readiness | New "Local LLM (Ollama)" check (only when `LLM_PROVIDER=ollama`): reachable + model pulled. Blocks without a fallback, warns with one. Analysis passes no longer counted against the Gemini quota. |
| Settings | `OLLAMA_BASE_URL`, `OLLAMA_MODEL_NAME` (`qwen3:14b`), `OLLAMA_NUM_CTX` (16384), `OLLAMA_KEEP_ALIVE`, `OLLAMA_TIMEOUT_SECONDS`, `OLLAMA_THINK`, `OLLAMA_API_KEY` (only for an auth proxy). |
| Topology | Backend + frontend run on Faiz's PC against the same Supabase DB when analysing; Railway keeps serving the app. No tunnel, nothing exposed (same call as 2026-09-17). |
| Tests | 20 new (provider, factory, readiness). 423/423 backend, ruff clean. Not run against a real Ollama server. |

## 2. Ticker convention — decision

**Rule: the holding's ticker is the Yahoo Finance symbol of the home-exchange listing you actually own.**

| Holding | Use | Not |
|---|---|---|
| Vår Energi | **`VAR.OL`** | `VARRY` |
| Salmon Evolution | `SALME.OL` ✅ | |
| Xetra-Gold / L&G Gold Mining / Xtrackers Defence | `4GLD.DE` / `ETLX.DE` / `XDEF.DE` ✅ | |
| Norwegian funds | `0P0001VJ4B.IR` / `0P0001XFYV.IR` ✅ (Yahoo's Morningstar IDs) | |

**Why not `VARRY`:** it's an **unsponsored** OTC ADR in USD — a bank created it without Vår Energi.
Vår Energi is not an SEC filer, so EDGAR has **no 10-K/20-F financials** for it under any ticker.
Using `VARRY` in Aladdin actively breaks things:

| Feature | With `VARRY` | With `VAR.OL` |
|---|---|---|
| Price (yfinance) | USD, thin OTC trading — mismatches the NOK position | NOK, the real Oslo price |
| Newsweb announcements | Looks up issuer "VARRY" — no match | Works (Oslo symbol `VAR`) |
| SEC EDGAR import | No financials either way | Not applicable — upload the annual report instead |

**When SEC EDGAR applies:** only companies that actually file with the SEC (US companies, and
foreign companies with a sponsored, exchange-listed ADR — e.g. Equinor's `EQNR` files a 20-F). For a
dual-listed SEC filer owned on Oslo, a separate optional "SEC ticker" field would be the clean
solution — **not built**; none of today's holdings need it.

**Also spotted in the Holdings screenshot (sector tags):** Xetra-Gold and L&G Gold Mining are tagged
*Consumer Discretionary* → should be **Materials**; Salmon Evolution → **Consumer Staples**. Fix
inline on the Holdings page.

## 3. UI tweaks

| What | Detail |
|---|---|
| Primary sources | Moved to the bottom of the holding page, **collapsed by default** (click to expand). New shared `CollapsibleSection` in `components/ui.tsx`; the panel only loads when opened. |
| Darker background | Palette in `tailwind.config.js`: page `#FAFAF9` → `#E4E2DD` (warm gray), cards `#FFFFFF` → `#F2F1ED`, borders and muted text darkened to keep contrast. All pages use tokens, so it applies app-wide. |

tsc / eslint / vite build clean; checked with a screenshot against mocked data.
