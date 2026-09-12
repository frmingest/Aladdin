# Aladdin

Investment-grade portfolio analyzer — an evidence-first system for reasoning about a personal
portfolio through a Buffett/Munger value-investing lens, with deterministic financial calculations,
external macro/sector research, and full provenance on every material claim.

This is decision support, not a trading engine — no order execution, no automated financial advice.

## Status

Architecture and solution design phase. See [`docs/architecture.md`](docs/architecture.md) for the
full design document (data model, service boundaries, scoring methodology, risk model, build phasing).

## Core principles

- **Evidence first, AI second.** The LLM interprets; it is never the system of record.
- **Deterministic code does the arithmetic.** The LLM is reserved for qualitative judgment.
- **Every analysis is reproducible** — snapshotted inputs, versioned prompts/scoring/schemas.
- **Confidence and uncertainty are explicit**, never converted into false precision.
- **Free/low-cost first**, with clear upgrade paths rather than architectural rewrites.

## Repository layout

```text
backend/    FastAPI application (services, domain, providers, tests)
frontend/   React + Vite dashboard
prompts/    Versioned persona/extraction/synthesis prompt templates
scoring/    Versioned scoring configuration
schemas/    Versioned extraction/output schemas
docs/       Architecture and design decisions
docker/     Container/deployment config
```

## Local development (Phase 0)

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                 # fill in ANTHROPIC_API_KEY when you reach Phase 3
docker compose -f ../docker/docker-compose.yml up -d  # starts local Postgres
uvicorn app.main:app --reload                         # http://localhost:8000/health
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                                           # http://localhost:5173
```

**Tests**

```bash
cd backend
pytest
```

**Migrations** (once the first models exist in `app/models/`)

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Build phasing

See §26 of the architecture doc. Summary: Foundation → Portfolio & document ingestion
(no AI dependency) → Deterministic financial/market data → AI analysis → External research →
Thesis & portfolio intelligence → Visualization.

## License

TBD.
