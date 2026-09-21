# Production image for the FastAPI backend (Sprint 0 skeleton — see
# claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md). Not used by local
# dev, which runs `uvicorn app.main:app --reload` directly against
# docker/docker-compose.yml's Postgres — see README.
#
# Build context must be the REPOSITORY ROOT, not backend/:
#   docker build -f backend/Dockerfile -t aladdin-backend .
# Railway: set the service's Root Directory to the repo root and its
# Dockerfile Path to backend/Dockerfile.
#
# NOTE: the pre-rebuild image also COPY'd top-level prompts/, schemas/,
# scoring/, research/, scenarios/, discount_rate/ directories (versioned
# prompt/schema assets read as plain files at runtime). Those directories
# were deleted in the 2026-09-21 clean-slate reset and are recreated
# per-sprint as their domains are rebuilt (prompts/schemas first appear in
# Sprint 4). Add their COPY lines back here when they exist again.

FROM python:3.12-slim AS base

# psycopg2-binary ships a prebuilt wheel for this base image, so no
# build-essential/libpq-dev is needed here.
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app
COPY backend/alembic backend/alembic
COPY backend/alembic.ini backend/alembic.ini

RUN useradd --create-home --uid 1000 aladdin && chown -R aladdin:aladdin /app
USER aladdin

WORKDIR /app/backend

# Railway (and most PaaS targets) inject PORT; default to 8000 to match
# local dev (see docker/docker-compose.yml and README).
ENV PORT=8000
EXPOSE 8000

COPY --chown=aladdin:aladdin docker/backend-entrypoint.sh /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
