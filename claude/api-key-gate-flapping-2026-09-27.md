# API-key gate: inconsistent enforcement in production — 2026-09-27

Faiz reported seeing "Missing or invalid API key" (the `ApiKeyMiddleware` 401 message) "all over" the
live app right after the gate shipped. Checked directly against production rather than guessing.

## What was found

Three back-to-back checks against `https://aladdin-production-bd25.up.railway.app`, **all with no
`X-API-Key` header**:

| Endpoint | Result |
|---|---|
| `/holdings` | **200 OK** — full data, no auth required |
| `/portfolio/overview` | **200 OK** — full data, no auth required |
| `/macro/indicators` | **401** `{"detail":"Missing or invalid API key"}` |

`ApiKeyMiddleware` has no per-route logic — every path except `/health` and `OPTIONS` is treated
identically. Getting a 200 on some endpoints and a 401 on others, back to back, from the same
unauthenticated request pattern, is not something the code itself can produce. That points at
**more than one backend instance answering requests with different `APP_AUTH_TOKEN` state** — the
signature of a Railway rolling deploy where an old instance (built before the env var was set, or
before this middleware existed) and a new instance are both still live behind the load balancer,
each request landing on whichever one is up.

This also fits Faiz's report: from the browser, some page loads/fetches succeed and others fail
depending on which instance answers, which reads as the error being "all over."

Earlier the same day, [live-verification-2026-09-27.md](live-verification-2026-09-27.md) found the
gate **consistently** enforcing (every non-`/health` endpoint 401ing without a key, the deployed
frontend's baked-in key accepted). Something changed on the Railway backend side between that check
and this one — most likely a redeploy or an env var edit that's still mid-rollout.

## What this is not

Not a code bug in `ApiKeyMiddleware` or in the frontend's `X-API-Key` header logic — both are exactly
as shipped and tested in
[backend-auth-cors-gate-2026-09-27.md](backend-auth-cors-gate-2026-09-27.md). Nothing here required a
code change.

## What Faiz should do

1. In Railway, check the backend service's **Deployments** tab — if one is still "Building" or
   "Deploying" alongside the active one, wait for it to finish (or cancel it if it's stuck) so only
   one instance is serving traffic.
2. Once there's a single active deployment, re-check `/holdings` and `/macro/indicators` the same way
   (or just reload the app) — they should now agree.
3. If they still disagree once only one deployment is active, that means `APP_AUTH_TOKEN` itself
   is set inconsistently (e.g. edited but not yet "redeployed" so the running instance hasn't picked
   it up) — a manual redeploy of the backend service from the Railway dashboard forces every instance
   onto the current env vars.
4. Double-check `VITE_API_KEY` (frontend build) still matches `APP_AUTH_TOKEN` (backend) exactly —
   unrelated to the flapping above, but a mismatch would also produce "Missing or invalid API key"
   for every request, permanently rather than intermittently.

No "login" exists in this app — this is a lightweight bot/scanner deterrent
([see the original doc's "What this is not" section](backend-auth-cors-gate-2026-09-27.md)), not a
user-facing auth screen. Once the two settings agree and only one backend instance is live, the error
should disappear entirely for Faiz's own browser session.
