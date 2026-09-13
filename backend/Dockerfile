# Production image for the FastAPI backend (architecture §26 "Deployment &
# production hardening" phase — see docs/decisions/0010). Not used by local
# dev, which runs `uvicorn app.main:app --reload` directly against
# docker/docker-compose.yml's Postgres — see README.
#
# Build context must be the REPOSITORY ROOT, not backend/ — prompts/,
# schemas/, scoring/, research/, scenarios/ are versioned assets that live
# as siblings of backend/ (see backend/app/config/paths.py's
# parents[3]-relative REPO_ROOT, which this image reproduces exactly), read
# as plain files at runtime rather than packaged into the Python app. E.g.:
#   docker build -f backend/Dockerfile -t aladdin-backend .
# Railway: set the service's Root Directory to the repo root and its
# Dockerfile Path to backend/Dockerfile.

FROM python:3.12-slim AS base

# psycopg2-binary and pymupdf ship prebuilt wheels for this base image, so no
# build-essential/libpq-dev is needed here.
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app
COPY backend/alembic backend/alembic
COPY backend/alembic.ini backend/alembic.ini
COPY prompts prompts
COPY schemas schemas
COPY scoring scoring
COPY research research
COPY scenarios scenarios

RUN useradd --create-home --uid 1000 aladdin && chown -R aladdin:aladdin /app
USER aladdin

WORKDIR /app/backend

# Railway (and most PaaS targets) inject PORT; default to 8000 to match
# local dev (see docker/docker-compose.yml and README).
ENV PORT=8000
EXPOSE 8000

COPY --chown=aladdin:aladdin docker/backend-entrypoint.sh /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
