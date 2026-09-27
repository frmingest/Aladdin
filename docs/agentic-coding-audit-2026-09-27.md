# Agentic-coding audit — 2026-09-27

Full sweep of the Aladdin codebase (backend + frontend + CI/hooks/prompts), looking specifically
for the failure modes common to LLM-assisted development: eroded guardrails, spaghetti/god files,
prompt-injection exposure, and security gaps an agent might introduce without noticing. This is a
review, not a code change — nothing in the repo was touched to produce it.

**Bottom line:** this repo is unusually well-guardrailed for an LLM-assisted project. CLAUDE.md's
rules are actually enforced in code, not just written down. The findings below are narrower than a
typical sweep turns up, and mostly config/process gaps rather than logic bugs.

## Findings, by severity

### 1. No authentication on any endpoint, and CORS is wide open — deployed publicly
`app/main.py` mounts every router (holdings, portfolio, documents, analysis, …) with no auth
dependency, and:
```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```
The comment reads *"Permissive for now… tighten once the frontend has a fixed deployed origin."*
Both Railway URLs (`exciting-gratitude-production-71b5…`, `aladdin-production-bd25…`) already exist
and `smoke.yml` hits the backend on a schedule, so that origin has been fixed for a while — the
tightening never happened. Given this handles real brokerage holdings and real financial documents,
this is the one item here worth a decision regardless of anything else: either lock CORS to the real
frontend origin and add a minimal auth gate, or explicitly accept the risk (e.g. because Railway/
network-level access is otherwise restricted) and say so in CLAUDE.md so it reads as a decision, not
an oversight.

### 2. A documented auth mechanism that was never built — design/code drift
`frontend/.env.example` describes an `APP_AUTH_TOKEN` / `VITE_API_KEY` scheme: *"Must match the
backend's `APP_AUTH_TOKEN`… a minimal gate against stray/automated requests hitting a public backend
URL… see docs/decisions/0010's Consequences."* Checked all three places this should show up:
- `backend/app` — no `APP_AUTH_TOKEN` reference anywhere.
- `backend/.env.example` — no such setting.
- `frontend/src/lib/api.ts` — never sends any `VITE_API_KEY` / `Authorization` header.
- `docs/decisions/` — the folder doesn't exist.

So the comment describes a safeguard that reads as reassuring ("we thought about this, here's the
mitigation") but isn't there on either side. This is the more general risk worth flagging: a
comment/doc describing a guardrail is not the same as the guardrail existing, and a future session
(agent or human) citing that comment as "we have a gate" would be wrong. Either build the token
check for real (small: one `Depends()` + one header check) or delete the comment so it stops
implying protection that isn't there.

### 3. `docs/PROGRESS.md` (repo) has drifted from the Claude project's `progress.md`
CLAUDE.md's own "Documentation sync" rule says every real change gets mirrored into both places in
the same change. Comparing them 2026-09-27: the project doc (§1, §5) is current through the
LLM-output-limit fix and the queue-scope-picker/UI-polish batch being **confirmed committed and
pushed**, while `docs/PROGRESS.md` still shows those same two items as **"uncommitted"** and the
local clone as **"fallen behind `origin/main`."** Both of those were corrected in the project doc
after a `git status`/`git log` check but the correction never made it into the repo copy. Low
stakes (it's a progress tracker, not app logic) but it's the exact stale-assumption failure mode
CLAUDE.md was written to prevent, now happening to the guardrail doc itself.

### 4. Leftover Vite crash artifacts in the repo root
19 `vite.config.ts.timestamp-*.mjs` files from interrupted dev-server runs, spanning Sept 20–27.
`.gitignore` already excludes the pattern going forward so this isn't a git-hygiene risk, just disk
clutter from repeated crashed/killed dev-server sessions — worth checking why the dev server keeps
dying if this recurs.

### 5. Two large files worth a second look before they grow further
`backend/app/services/settings/synthetic_data.py` (1,055 lines) and `frontend/src/lib/types.ts`
(1,671 lines) are the two biggest files by a wide margin (next-largest backend file is 896 lines,
next-largest frontend file is 1,096). Neither looked disorganized on inspection, but files this size
are exactly where an agent tends to keep bolting on cases rather than refactoring — worth a look the
next time either is touched.

### 6. Stale git lock file found in the local clone
`E:\Aladdin\.git\index.lock` (0 bytes) was sitting in the working copy — normally left behind by a
git process that was killed mid-operation. `git status`/`git log` still worked, but it can make the
*next* `git commit` from that machine fail with "Unable to create index.lock… File exists" until
it's removed. Worth deleting by hand next time you're at that PC if a commit there refuses to run.

## What's notably *not* wrong

Worth naming since it's the opposite of what this kind of sweep usually turns up:

- **Prompt injection (CLAUDE.md Rule 5) is real, not decorative.** `document_excerpts.py` actually
  neutralizes evidence-ID-like strings (`EV-001`) found in issuer text so a document can't impersonate
  a real evidence item, and the v2 prompts tell the model to treat excerpt text as claims to weigh,
  not instructions.
- **Destructive operations (CLAUDE.md's "Destructive operations" rule) are consistently guarded.**
  Every delete/wipe endpoint across accounts, holdings, portfolio, journal, thesis and watchlist
  requires `confirm=true`, with no exceptions found.
- **Secrets discipline holds up in practice, not just in config.** `.gitignore`, `.gitleaks.toml`,
  pre-commit hooks (`no-env-files`, `no-real-documents`, `detect-private-key`) and a CI secrets job
  (gitleaks over full git history) all agree with each other; no hardcoded keys, no committed `.env`,
  no committed real documents found.
- **No `eval`/`exec`/`os.system`, no bare `except:`, no string-formatted SQL** anywhere in
  `backend/app`. The only two `except Exception: pass`-shaped blocks found are narrow and explicitly
  commented (a progress-callback that must never break the analysis run; a migration-status probe
  against a table that may not exist yet on a fresh DB).
- **CI is real, not cosmetic.** ruff + pytest, migration up/down/up on a real Postgres 16 service,
  tsc/eslint/vitest/build, gitleaks over full history, and a dependency audit — plus a genuinely
  read-only post-deploy Playwright smoke test that's structurally barred from non-GET requests and
  LLM-quota-spending endpoints.
- **CLAUDE.md Rule 1 (deterministic math, never LLM) held up everywhere sampled** — valuation and
  metrics code (`services/valuation/`, `services/metrics.py`, `services/performance/`) is plain
  arithmetic; the LLM only ever receives already-computed numbers.
- **Dependencies are pinned**, with comments explaining *why* each one is there (e.g. `lxml` "was
  only a transitive dependency… until 2026-09-23").

## Method

Read via the linked-computer shell (`E:\Aladdin`, no changes made): directory/file-size survey,
grep sweeps for `eval`/`exec`/`os.system`/bare-`except`/hardcoded-secret patterns/string-built SQL,
manual read of `CLAUDE.md`, `.gitignore`, `.gitleaks.toml`, `.pre-commit-config.yaml`, both CI
workflow files, `app/main.py`, `app/config/settings.py`, `document_excerpts.py`, the prompt files
under `backend/prompts/`, both `.env.example` files, and `frontend/src/lib/api.ts`; `git status`/
`git log` at the end to confirm current repo state per CLAUDE.md's own status-honesty rule.
