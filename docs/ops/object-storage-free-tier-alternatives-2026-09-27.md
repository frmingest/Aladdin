# Object storage: free-tier alternatives to Supabase Storage (2026-09-27)

Faiz's Supabase Storage free tier (1 GB) is close to its limit. Investigated what stores the
uploaded filings for free without cutting into it. **Research only — no code changed.**

## 1. The good news: this is a config change, not a code change

`backend/app/providers/object_storage.py` / `object_storage_s3.py` already define storage as one
S3-compatible interface. `app/providers/factory.py::get_object_storage()` already accepts
`OBJECT_STORAGE_PROVIDER` = `local`, `s3`, `r2`, or `supabase` and builds the **same** boto3 client
for any of them — only `OBJECT_STORAGE_ENDPOINT_URL`/`REGION`/keys differ. Switching vendor is
4 Railway environment variables, not a code change (`backend/.env.example` already documents the
R2 values to use).

Confirmed live in `backend/.env`: currently `OBJECT_STORAGE_PROVIDER=supabase`, bucket
`aladdin-documents`, with a Supabase storage S3 endpoint. These are the same Supabase storage S3
keys already flagged for rotation in progress.md — moving off Supabase Storage and rotating are
naturally the same step.

## 2. Free tiers compared

| | Supabase Storage (current) | **Cloudflare R2** | Backblaze B2 |
|---|---|---|---|
| Free storage | **1 GB** | **10 GB** | 10 GB |
| Free egress (downloading a stored filing back out) | Counts against Supabase's shared free bandwidth pool | **Unlimited, always free** — R2's defining feature, no cap even past free tier | Free up to ~3× your average stored data/month, then $0.01/GB |
| Free API calls | Shared free-tier quota | 1M "Class A" (writes/lists) + 10M "Class B" (reads) per month | Class A/B/C free; Class D 2,500/day free |
| S3-compatible | Yes (what Aladdin already uses) | Yes | Yes |
| Already wired into Aladdin | `OBJECT_STORAGE_PROVIDER=supabase` (current) | `OBJECT_STORAGE_PROVIDER=r2` (already accepted, just unused) | Would use `OBJECT_STORAGE_PROVIDER=s3` with B2's S3-compatible endpoint (not yet named in `.env.example`, but the same `S3ObjectStorageProvider` class works — B2's S3 endpoint is `https://s3.<region>.backblazeb2.com`) |

Sources: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing),
[Supabase pricing](https://supabase.com/pricing).

## 3. Recommendation: move file storage to Cloudflare R2

10× Supabase's free storage, and R2 never bills egress at all (Backblaze's free egress is capped
at ~3× what you store, which is generous but conditional; R2 has no condition). Aladdin already
strips embedded images out of ESEF uploads before storing (Sprint 10 — a report like Orkla's went
from 98.6 MB to 3.2 MB), so at a few MB per filing × a handful of holdings × a few years of annual
reports, 10 GB gives a lot of headroom. The Postgres database itself stays on Supabase — this is
about the *file* storage limit specifically, nothing else moves.

### Migration path (config + a one-off copy, no app code change)

1. Cloudflare account → R2 → create a bucket (e.g. `aladdin-documents`) → create an API token
   scoped to it (Access Key ID + Secret Access Key).
2. **Copy existing objects** from the Supabase bucket to the new R2 bucket before switching —
   `storage_path` values already saved on `Document` rows point at Supabase keys, so old filings
   need to exist at the same keys in R2 or they 404 on next retrieve. A short boto3 script (list
   from the Supabase S3 endpoint, `get_object`, `put_object` to the R2 endpoint under the same key)
   or `rclone sync` between the two S3-compatible endpoints does this in one pass — likely well
   under 1 GB, so it's fast.
3. Update Railway env vars: `OBJECT_STORAGE_PROVIDER=r2`,
   `OBJECT_STORAGE_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com`,
   `OBJECT_STORAGE_REGION=auto`, plus the new access key/secret. Redeploy.
4. Spot-check: open a holding with an uploaded filing and confirm the document still downloads.
5. Rotate out the old Supabase storage S3 keys (folds into the credential-rotation item already
   open in progress.md).

Not yet done — this doc is the investigation; say the word and this can be built as the next
session's task.

## 4. What this doesn't change

No code touched this session. Postgres/database usage on Supabase is unaffected — only the
*Storage* (file) product has a 1 GB free cap; the database free tier is a separate, larger quota.
