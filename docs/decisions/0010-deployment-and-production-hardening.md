# 10. Deployment & production hardening

## Status

Accepted (partial — see Consequences for what this build environment could not verify live)

## Context

PROGRESS.md's "Next phases & identified follow-up work" (reviewed 2026-09-13) named this the most
concrete, most overdue next phase after Phase 6: the app has been feature-complete since Phase 6 but
has never been deployed anywhere, and the "Deployment readiness (Railway)" checklist had sat
unaddressed since Phase 3. This phase turns that checklist into actual code: Dockerfiles, CORS,
single-user auth (§24 — never implemented despite being an explicit architecture requirement), and a
durable object-storage provider to replace `LocalObjectStorageProvider`'s ephemeral-disk storage
(§29, unresolved since Phase 1 — the settings comment has said `local | supabase | r2` from the
start, but only `local` was ever wired).

## Decisions

- **One boto3-based `S3ObjectStorageProvider` for both `r2` and `supabase`**
  (`app/providers/s3_storage_provider.py`), not two separate provider classes. Both candidates §29
  ever named expose an S3-compatible API (Cloudflare R2 natively; Supabase Storage via its
  `/storage/v1/s3` endpoint) — the only difference between them is which
  `object_storage_endpoint_url`/`object_storage_region` a deployment points at, which is exactly the
  kind of vendor difference this codebase's provider pattern (§28 rule 8) says belongs in
  configuration, not a second code path. `store()` returns the bucket key itself (not a signed/public
  URL — §24 "avoid exposing raw source files through public URLs"), matching what
  `Document.storage_path` already persists from `LocalObjectStorageProvider`.
- **Single shared bearer token, not a real user/session system.** `app/api/auth.py`'s `require_auth`
  checks one `X-API-Key` header against `Settings.app_auth_token`, applied as a FastAPI
  `dependencies=[Depends(require_auth)]` on every domain router in `main.py` — `/health` stays
  unauthenticated (an uptime check shouldn't need a secret). §25's non-goals rule out a multi-user
  SaaS platform outright, and §26's own phasing never scoped real auth (login, sessions, RBAC) as a
  build phase — a shared token is the smallest thing that satisfies §24's "authenticate application
  access" for a single-user app. Matches this codebase's existing "empty setting disables the
  feature" convention (`google_ai_studio_api_key`, `fred_api_key`) rather than inventing a new one:
  `APP_AUTH_TOKEN=""` (the default) disables auth entirely, so local dev and every existing
  `TestClient`-based test keep running unauthenticated with zero changes.
- **CORS middleware only added when `CORS_ALLOWED_ORIGINS` is set**, not unconditionally with a
  wildcard. Local dev is already same-origin (Vite's dev-server proxy — see `vite.config.ts`) and
  needs no CORS at all; a wildcard `allow_origins=["*"]` would be strictly worse than opt-in given
  `allow_credentials=True` is needed for the `X-API-Key` header pattern some browsers/proxies treat
  as credentialed.
- **Two Dockerfiles, backend built from the repository root, not `backend/`.**
  `backend/app/config/paths.py` resolves `prompts/`, `schemas/`, `scoring/`, `research/`,
  `scenarios/` as siblings of `backend/` via `Path(__file__).resolve().parents[3]` — they're
  versioned assets read as plain files at runtime (§2.4/§11.1), not packaged into the Python app.
  `backend/Dockerfile` reproduces that exact directory depth inside the image
  (`/app/backend/app/config/paths.py` → `parents[3]` → `/app`, with `/app/prompts` etc. copied
  alongside `/app/backend`) rather than changing `paths.py` to accommodate a flatter image — the
  Dockerfile adapts to the existing repository layout, not the other way around. This means the
  build context must be the repo root (`docker build -f backend/Dockerfile .`); Railway's
  "Root Directory" (build context) + "Dockerfile Path" split maps onto this directly.
  `frontend/Dockerfile` is the simpler, standard two-stage `node:20-alpine` build →
  `nginx:1.27-alpine` static serve, context is `frontend/` itself.
- **`alembic upgrade head` runs from the backend container's entrypoint** (`docker/
  backend-entrypoint.sh`), not as a separate deploy step — idempotent, so safe on every restart
  including scale-out, and removes a manual "did you remember to migrate" step from the deployment
  readiness checklist.
- **The frontend's API base URL is a build-time env var (`VITE_API_BASE_URL`), not a runtime one.**
  Vite bakes `import.meta.env.*` into the built JS at `vite build` time; there is no way to change it
  after the image is built without rebuilding. Left unset, `src/services/api.ts` keeps defaulting to
  `/api` (the existing dev-proxy-relative path) — this only needs setting once frontend and backend
  are genuinely separate origins (e.g. two Railway services), which is the deployment topology this
  phase assumes since Railway does not give two services a shared origin by default.
- **`VITE_API_KEY` is a real setting, with its limitation documented rather than left implicit.** A
  single-page app's build output is static files served to the browser — any value baked into it is
  readable by anyone who opens dev tools or the bundle itself. Sending it back as `X-API-Key` is a
  minimal gate against stray or automated requests finding a public backend URL and hitting it
  cold, not access control in any real sense. Documented explicitly in `frontend/.env.example` and
  here rather than presenting `APP_AUTH_TOKEN`+`VITE_API_KEY` as if they were real authentication —
  §21 "fail visibly rather than silently invent" applies to documentation claims about security, too.

## Consequences

- **Nothing here has actually been deployed or smoke-tested against a live Railway project,
  Supabase/R2 bucket, or Postgres instance** — this build environment has no network path to any of
  them, the same limitation every prior phase's ADR has documented for yfinance/Gemini/FRED/Norges
  Bank. The Dockerfiles were verified by: running the full backend test suite (unchanged, 248
  passing) and a fresh `npm run build` locally, and manually re-deriving `paths.py`'s
  `parents[3]`-relative path arithmetic against the exact directory depth the backend image
  produces (see the Decisions entry above) — not by an actual `docker build`, since this
  environment's Docker daemon isn't reachable either. The very first real deploy is still the
  "end-to-end smoke test on the deployed instance" item PROGRESS.md's checklist already named,
  unchanged by this phase.
- **`S3ObjectStorageProvider` is likewise untested against a real R2/Supabase bucket** — its unit
  tests (`tests/unit/test_s3_storage_provider.py`) mock the boto3 client entirely. A first real
  upload/retrieve against whichever bucket a deployment actually configures is still outstanding.
- **Single-user auth is exactly that — single-user.** One shared token with no rotation, expiry, or
  per-request audit trail. Sufficient for §24's letter and §25's explicit "not a multi-user SaaS
  platform" scope; would need real replacement before this app ever serves more than one person.
- **CORS is opt-in and permissive once enabled** (`allow_methods=["*"]`, `allow_headers=["*"]`) —
  fine for a single known frontend origin, would need tightening for anything broader.
- **No Railway-specific config file (`railway.json`/`railway.toml`) was added.** Railway's Dockerfile
  auto-detection needs only the Root Directory + Dockerfile Path settings named above per service;
  a config file would duplicate what's already expressible through the dashboard/CLI with no
  behavior this phase needs that the default doesn't already provide.
- **Everything else on PROGRESS.md's "Deployment readiness (Railway)" checklist that isn't code**
  (obtaining real API keys, creating the Railway project/services, running the first live smoke
  test) remains exactly as unchecked as before — this phase closes the code gaps, not the
  account-setup ones.
