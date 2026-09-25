# Ollama timeouts, dark theme, readable analysis — 2026-09-25

Commit `787cf53` · not pushed · not deployed

## 1. "blind pass failed: Ollama timed out generating"

| | |
|---|---|
| **Cause** | Each pass was one non-streaming `/api/chat` request. The whole generation had to finish inside one HTTP read timeout (900 s). A 14B model on a 12GB card that is partly on the CPU runs at a few tokens/s, so a healthy-but-slow pass died while tokens were still coming. |
| **Fix** | Passes now **stream**. The read timeout only covers the gap between two chunks. |
| **New setting** | `OLLAMA_STALL_TIMEOUT_SECONDS=600`: the longest wait for the next token (model load + reading a 16k prompt) |
| **Changed setting** | `OLLAMA_TIMEOUT_SECONDS` is now the wall-clock cap for one whole pass: 900 → **1800** (default, `.env.example` and your local `backend/.env`) |
| **Better errors** | A timeout says how far it got (`~N tokens in Xm, ~Y tokens/s`) and how much of the model is on the GPU (from `/api/ps`), with advice |
| **Loop guard** | A model stuck emitting whitespace inside the JSON is stopped after 600 blank characters, so it doesn't use the whole budget |
| **Readiness / worker** | "Local LLM" turns **warn** when the loaded model is under 99% on the GPU. The worker status shows the same |
| **Guide** | `OLLAMA_NUM_PARALLEL=1` added to the Windows setup, plus 4 troubleshooting rows |

Likely root cause on the PC: model partly on the CPU. Run `ollama ps` while a pass runs; the PROCESSOR column should say `100% GPU`.

## 2. Dark theme

| | |
|---|---|
| Tokens | Tailwind colours are now CSS variables (`src/index.css`); class names unchanged |
| Default | Dark (deep blue-grey, `#0B0E13` page / `#14181F` cards) |
| Light | The warm-grey palette from 2026-09-23, behind **Dark theme / Light theme** at the bottom of the nav (remembered per browser) |
| Details | `text-white` on fills → `text-onfill`; inputs, native controls and scrollbars follow the theme; charts use the tokens |

## 3. Less "dull paper"

| Change | Where |
|---|---|
| Fonts: Inter (reading), Space Grotesk (headings, big numbers), JetBrains Mono (figures) | `index.html`, `tailwind.config.js` |
| Section headings: accent bar + display face instead of small grey capitals | `.section-title` |
| Analysis narratives: bold lead sentence, 2-sentence paragraphs, 72-char line length | `components/Prose.tsx` |
| Figures (88.8%, 10.61, 1,787m) highlighted in mono; years and EV IDs are not | `lib/prose.ts` |
| Sentences saying data was missing are highlighted; card header shows "N data gaps" | `lib/prose.ts` |
| Long sections clamp after 3 paragraphs with **Read more** | `Prose` |
| Icons per section, card shadow, bigger verdict, dot bullets | `AnalysisPanel.tsx`, `ui.tsx` |

All still plain text. Nothing from the model is rendered as HTML (CLAUDE.md Rule 5).

## 4. Tests

| Suite | Result |
|---|---|
| Backend | 683 passed; the 2 known `test_factory` failures remain (local `.env` selects Ollama) |
| Ollama provider | 22 (8 new: streaming join, wall-clock cap + GPU share, whitespace loop, mid-stream error, stream ends early, GPU warning) |
| Frontend | tsc, eslint, 13 vitest (7 new), `vite build` all clean |
| Visual | Analysis panel rendered with mock data in both themes |

## 5. Not changed

The narrative **text** itself is repetitive: the same ratios appear in 3 of 4 sections. That comes from the prompt, not the UI. Fixing it needs a new prompt version (`v3`, CLAUDE.md Rule 3). Not scheduled.
