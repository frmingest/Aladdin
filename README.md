# Aladdin

A personal equity analysis app in the Buffett/Munger style: FastAPI + Postgres backend, React/Vite
frontend, an evidence-first LLM pipeline. Code computes every number; the LLM only researches and
writes judgement, citing evidence IDs.

| Read | For |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System diagram, analysis flow, deployment, jobs, data model |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Current status, what needs your attention, history |
| [docs/llm-and-technology-overview.md](docs/llm-and-technology-overview.md) | Where an LLM is used and which technology does what |
| [CLAUDE.md](CLAUDE.md) | The rules every AI agent working in this repo follows |

## Run it locally

```bash
# 1. Database (Postgres 16)
docker compose -f docker/docker-compose.yml up -d

# 2. Backend (Python 3.12), from backend/
cp .env.example .env            # then fill in keys; .env is gitignored
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload   # http://localhost:8000

# 3. Frontend (Node 20), from frontend/
npm ci
npm run dev                     # http://localhost:5173 (proxies to :8000)

# 4. Optional: the local LLM worker (needs Ollama), from backend/
python -m app.worker
```

## Checks (the same ones CI runs)

```bash
cd backend  && ruff check . && pytest -q          # set MACRO_DATA_PROVIDER=none, LLM_PROVIDER=google_ai_studio
cd frontend && npx tsc --noEmit -p . && npm run lint && npm test && npm run build
```

Every change goes through a branch and a pull request into `main`; Railway deploys `main`.
