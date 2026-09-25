# Local LLM setup — Ollama on the RTX 3060 12GB

**Date:** 2026-09-23 · **Status:** ✅ verified on Faiz's PC — readiness shows "Ollama reachable, model 'qwen3:14b' available"

## How the work is split

| Work | Runs on | Why |
|---|---|---|
| Buffett/Munger analysis (blind pass + reconciliation pass) | **Ollama on your PC** | The heavy part: long evidence packets, big JSON outputs, 2 calls per holding. No daily cap locally. |
| Macro / sector / company research | **Gemini (Google AI Studio)** | Needs Google Search grounding — no local equivalent. Light: ~1 call per item per day, cached 24h. |
| All numbers (ROE, DCF, FX, …) | Python code | Unchanged — the LLM never calculates (CLAUDE.md Rule 1). |

**Topology:** you run the backend + frontend **on your PC** when you want to run analyses. They talk
to the same Supabase database as Railway, so results show up in the deployed app too. Railway can't
reach `localhost` on your PC, so an analysis started from the Railway site still uses Gemini.
(Same decision as 2026-09-17: no tunnel, no port exposed to the internet.)

---

## Step 1 — Check Ollama and the GPU

Open **PowerShell**:

```powershell
ollama --version        # anything from 2025 or newer is fine
nvidia-smi              # should list "NVIDIA GeForce RTX 3060" with 12288MiB
```

If `ollama` isn't found, reinstall from https://ollama.com/download (Windows installer).

## Step 2 — Tune Ollama for a 12GB card (one time)

These two settings roughly halve the memory the context window needs, so a 14B model plus a
16k-token evidence packet fits on the card instead of spilling to (slow) system RAM.

1. Start menu → **"Edit the system environment variables"** → **Environment Variables…**
2. Under **User variables** → **New…**, add:

   | Variable | Value |
   |---|---|
   | `OLLAMA_FLASH_ATTENTION` | `1` |
   | `OLLAMA_KV_CACHE_TYPE` | `q8_0` |
   | `OLLAMA_NUM_PARALLEL` | `1` (each parallel slot reserves its own context; on a 12GB card a second one pushes the model onto the CPU) |

3. **Quit Ollama** from the system-tray icon (right-click → Quit) and start it again, so it picks
   the variables up.

Leave `OLLAMA_HOST` unset — Ollama then only listens on `127.0.0.1`, which is what we want. Plain
Ollama has no password; never open port 11434 to the internet.

## Step 3 — Pull the model

```powershell
ollama pull qwen3:14b
```

About 9.3 GB. Why this one: strongest reasoning/structured-output model that fits comfortably on
12 GB, Apache-2.0 licence.

| Model | Size | When to use |
|---|---|---|
| `qwen3:14b` | 9.3 GB | **Default.** Best quality that fits. |
| `qwen3:8b` | 5.2 GB | If 14B feels too slow. |
| `gemma3:12b` | ~8 GB | Worth comparing on the same holding. |

Check what's newest for 12 GB at https://ollama.com/library before pulling — models move fast.

## Step 4 — Smoke-test the GPU

```powershell
ollama run qwen3:14b "Reply with one word: ready" --verbose
ollama ps
```

In `ollama ps`, the **PROCESSOR** column should say **`100% GPU`**. If it says something like
`30%/70% CPU/GPU`, the model is spilling to RAM — close other GPU-heavy apps (games, browsers with
hardware acceleration) or lower `OLLAMA_NUM_CTX` in Step 5 to `12288`.

The `--verbose` output shows `eval rate` — expect roughly 25–35 tokens/s for 14B on a 3060.

## Step 5 — Point the backend at Ollama

Edit `E:\Aladdin\backend\.env` (never committed). Change/add:

```ini
# Analysis passes -> local GPU
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_NAME=qwen3:14b
OLLAMA_NUM_CTX=16384
OLLAMA_KEEP_ALIVE=30m
OLLAMA_TIMEOUT_SECONDS=1800        # cap for one whole pass
OLLAMA_STALL_TIMEOUT_SECONDS=600   # longest wait for the next token (model load + reading the prompt)
OLLAMA_THINK=false

# Optional: if Ollama is off, fall back to Gemini (spends the 20/day budget).
# Use "none" if you'd rather the run just stop.
LLM_FALLBACK_PROVIDER=none

# Research stays on Gemini — keep your existing key
RESEARCH_PROVIDER=gemini_search
MARKET_DATA_PROVIDER=yfinance
```

> Your current `.env` has `LLM_PROVIDER=anthropic` and `LLM_FALLBACK_PROVIDER=mistral`.
> `anthropic` is **not** a value the code accepts (only `google_ai_studio`, `mistral`, `ollama`),
> so replace both lines as above.

Keep `DATABASE_URL` (Supabase session pooler) and the `OBJECT_STORAGE_*` values the same as on
Railway, so local runs read/write the same data and documents.

## Step 6 — Start the backend locally

```powershell
cd E:\Aladdin\backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt      # only needed after a pull that changed requirements
uvicorn app.main:app --port 8000
```

Don't run `alembic upgrade` locally — Railway runs migrations on deploy.

## Step 7 — Start the frontend locally

Second PowerShell window:

```powershell
cd E:\Aladdin\frontend
npm install        # first time only
npm run dev
```

Open http://localhost:5173 — the dev server forwards API calls to your local backend on :8000.
(Make sure `frontend/.env` doesn't set `VITE_API_BASE_URL` to the Railway URL, or the local
frontend would talk to Railway instead.)

## Step 8 — Run an analysis

1. Open a holding (e.g. Vår Energi) → **Buffett/Munger analysis**.
2. The readiness checklist now has a **"Local LLM (Ollama)"** row:
   - ✅ *Ollama reachable, model available* — good to go.
   - ⛔ *Can't reach Ollama* → start the Ollama app.
   - ⛔ *model isn't pulled* → run the `ollama pull` it names.
3. The Gemini-quota row now only counts research refreshes — the two analysis passes no longer
   touch the 20/day budget.
4. Run it. Expect **a few minutes** per holding (two passes). Watch `ollama ps` if curious.

## Day-to-day: what must be running

| Window | Command | Keep open |
|---|---|---|
| Ollama | Tray app | ✅ |
| PowerShell 1 | `cd E:\Aladdin\backend`, `.\.venv\Scripts\Activate.ps1`, `uvicorn app.main:app --port 8000` | ✅ |
| PowerShell 2 | `cd E:\Aladdin\frontend`, `npm run dev` | ✅ |

Then use **http://localhost:5173** (not the Railway URL) for analysis runs.

## Run analyses queued from Railway (Sprint 5B)

The Railway site can't reach your PC, so it doesn't try. **Run on my PC** on a holding (or **Queue all
ready holdings** on the *Analysis queue* page) only puts the run in the shared database. A small worker
on your PC picks it up, does the research (Gemini) and both passes (Ollama) here, and writes the result
back. Nothing on the PC listens for connections; if the PC is off, the run waits.

**One-time setup**

1. `backend\.env` on the PC must have the **same `DATABASE_URL` as Railway** (plus the Gemini, FRED
   keys and `MARKET_DATA_PROVIDER=yfinance`, `RESEARCH_PROVIDER=gemini_search`). `LLM_PROVIDER` doesn't
   matter to the worker: it always uses `WORKER_LLM_PROVIDER` (default `ollama`).
2. Railway must be on the migration that adds the queue (`e6f7a8b9c0d1`) — it runs on deploy.

**Start it**

```powershell
cd E:\Aladdin\backend
.\.venv\Scripts\Activate.ps1
python -m app.worker
```

Or `powershell -ExecutionPolicy Bypass -File E:\Aladdin\backend\scripts\start-worker.ps1`, which
restarts the worker if it crashes. To start it at log-on: Task Scheduler → *Create Task* → trigger
*At log on* → action *Start a program* `powershell.exe`, arguments
`-ExecutionPolicy Bypass -WindowStyle Minimized -File E:\Aladdin\backend\scripts\start-worker.ps1`.

**What it does, every 30 s**

| Step | Detail |
|---|---|
| Heartbeat | Tells the site it's online (model, what it's doing). Shown on *Analysis queue*, *System status* and the readiness card. |
| Checks Ollama | If Ollama is stopped, it waits — the run stays queued, nothing is spent. |
| Checks Gemini budget | If today's research budget can't cover the next run, it waits until 00:00 UTC (the overnight queue). |
| Runs the oldest queued run | Research → evidence packet → blind pass → reconciliation. A few minutes per holding. |
| Recovers | A run whose worker went silent for 30 min is re-queued; after 2 tries it's marked failed. Ctrl+C mid-run puts the run back in the queue. |

## Troubleshooting

| Message | Fix |
|---|---|
| "filled Ollama's context window" | The evidence packet is bigger than `OLLAMA_NUM_CTX`. Raise it to `24576`, re-check `ollama ps` says 100% GPU. The app refuses rather than let Ollama silently cut evidence. |
| "stopped at the output limit" | Raise `LLM_MAX_OUTPUT_TOKENS` (e.g. `12288`). |
| "timed out generating … no new output for 600s" | Nothing came back at all: the model was still loading or reading the prompt. Check `ollama ps`; raise `OLLAMA_STALL_TIMEOUT_SECONDS` if the PC is just slow. |
| "timed out generating … passed the 1800s limit … ~N tokens/s" | Tokens were coming, just slowly. Under ~10 tokens/s means the model is partly on the CPU (the message says how much is on the GPU): close GPU-heavy apps, set `OLLAMA_NUM_PARALLEL=1`, lower `OLLAMA_NUM_CTX`, or use `qwen3:8b`. |
| "got stuck emitting blank output" | The model looped on whitespace inside the JSON; the app stops it early. Run again; if it repeats, try another model. |
| Readiness shows "only N% of it is on the GPU" | Same cause as a slow pass — fix before running. |
| Very slow, `ollama ps` shows CPU | Model spilling to RAM — see Step 4. |
| Output quality looks weak | Try `gemma3:12b` on the same holding and compare side by side. |
| `No module named 'click'` (or any module) when starting uvicorn | The venv is incomplete. `python -m pip install -r requirements.txt` inside the venv. |
| `No module named pip` | The venv is broken — delete and recreate it: `Remove-Item -Recurse -Force .venv`, `py -3.11 -m venv .venv`, activate, `python -m pip install -r requirements.txt`. |
| Readiness says "Can't reach Ollama … would fall back to 'mistral'" but `curl.exe http://localhost:11434` works | You're on the **Railway** site, not the local one. Railway can never reach your PC. Use http://localhost:5173, and keep Railway on `LLM_PROVIDER=google_ai_studio`. |
| `localhost:5173` refuses to connect | The frontend dev server isn't running — Step 7 (`npm run dev`, keep the window open). |
| A run stays **Queued** on the Railway site | The worker isn't running, or is waiting. Open *Analysis queue*: it shows the worker's state (offline, *LLM unavailable*, *waiting for quota*) and the reason. |
| Worker log: `DATABASE_URL is not set` | Put Railway's `DATABASE_URL` in `backend\.env` on the PC. |
| A `.env` change has no effect | Restart uvicorn (it reads `.env` only at start), and check no Windows environment variable of the same name overrides it (`echo $env:LLM_PROVIDER`). Also make sure a key isn't listed twice in `.env`. |

## Later, if needed

A tunnel from Railway to Ollama is no longer needed: runs started on the Railway site reach the PC
through the queue above (Sprint 5B).
