# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StudyForge is an AI-powered educational RAG platform. Students upload course materials (PDF, DOCX, PPTX, TXT), chat with them via RAG, and auto-generate exams, flashcards, and learning paths. Teachers get analytics dashboards.

**Monorepo layout:**
```
apps/api/    # FastAPI backend (Python 3.11+)
apps/web/    # Next.js 15 frontend (TypeScript)
packages/shared-types/  # Shared TS interfaces (future)
```

---

## Backend (apps/api)

### Common commands

```bash
# From apps/api with virtualenv active
cd apps/api && source .venv/bin/activate

uvicorn app.main:app --reload --port 8000          # dev server (Swagger at :8000/docs)
celery -A app.tasks.celery_app worker --loglevel=info -Q files,notifications,slides,analytics  # worker
celery -A app.tasks.celery_app beat --loglevel=info   # beat scheduler

alembic upgrade head                               # apply migrations
alembic revision --autogenerate -m "description"  # generate migration

pytest                                             # run all tests
pytest tests/test_rag_service.py                  # single test file
```

### Architecture

**Request flow:**
1. Clerk JWT arrives → `app.core.security.get_current_user()` verifies via JWKS, auto-provisions user in DB if missing
2. RBAC enforced via `app.core.permissions.require_permission()` — role hierarchy: `super_admin > admin > teacher > student > viewer`
3. Route handlers in `app/api/v1/` delegate to service layer in `app/services/`
4. Celery tasks (async) handle file ingestion, notifications, slide generation, analytics

**RAG pipeline** (`app/services/rag_service.py`):
1. Query rewriting via LLM
2. Embedding via AI provider
3. ChromaDB vector search (top-8, min_score=0.4)
4. Cross-encoder reranking → top-5 (`app/services/reranker.py`)
5. LLM streaming with SSE (`app/api/v1/chat.py`)

**AI providers** (`app/services/ai_service.py`): controlled by `AI_PROVIDER` env var — `openai` (default, OpenAI-compat including AWS Bedrock), `nvidia`, `bedrock`, `ollama`. All share `BaseAIProvider` ABC.

**Celery queues:** `files`, `notifications`, `slides`, `analytics`. Beat schedules: exam deadline checks (hourly), streak records (23:55 UTC), at-risk student flagging (06:00 UTC).

**Key models:** `User`, `Group`, `File`, `ChatMessage`, `Exam`, `FlashcardSet`, `Room`, `Organization`, `Cohort`, `SlidesDeck`, `LearningPath`

**Storage:** `app/services/storage_service.py` — S3-compatible. Use `S3_*` vars; `R2_*` vars are legacy compat only.

**Vector store:** `app/services/vector_store.py` wraps ChromaDB HTTP client (host/port configurable via `CHROMA_HOST`/`CHROMA_PORT`).

### Testing

Tests live in `apps/api/tests/`. Run with `pytest` (asyncio mode is `auto` per `pytest.ini`). Tests cover AI provider selection, RAG pipeline, file processor, storage service, and slide service.

---

## Frontend (apps/web)

### Common commands

```bash
cd apps/web
npm install
npm run dev    # Next.js dev server at :3000
npm run build  # production build
npm run lint   # ESLint
```

### Architecture

**Next.js App Router** with two route groups:
- `(auth)/` — sign-in, sign-up (Clerk)
- `(app)/` — authenticated app; middleware at `middleware.ts` protects all non-public routes via `clerkMiddleware`

**Key route structure under `(app)/`:**
- `/groups/[groupId]/` — tabs: Chat, Files, Learning Paths, Slides, Exams, Flashcards, Members, Generate (teacher only)
- `/org/[slug]/dashboard/` — organization admin dashboard
- `/admin/` — super admin
- `/dashboard/` — user home

**Data fetching:** TanStack Query v5. API hooks in `lib/hooks/useApi.ts` (group-level data) and individual hook files per feature in `lib/hooks/`. API calls go through `lib/api.ts` (Axios), which attaches Clerk JWT via request interceptor and handles 401/402/429 errors globally.

**Streaming chat:** `lib/hooks/use-streaming-chat.ts` uses native `fetch` with `ReadableStream` to consume SSE from the backend chat endpoint.

**Auth pattern:** `registerTokenGetter()` in `lib/api.ts` wires Clerk's `useAuth().getToken()` into the Axios interceptor. Done once in the app providers.

**State:** TanStack Query for server state; Zustand for local UI state where needed.

---

## Infrastructure

### Local dev stack

```bash
docker compose up postgres redis minio -d   # infrastructure only
docker compose up --build                   # full stack (all 6 services)
docker compose exec api alembic upgrade head
```

Services: `postgres` (5432), `redis` (6379), `minio` (9000/9001), `api` (8000), `celery_worker`, `celery_beat`.

### Health endpoints

- `GET /health` — liveness
- `GET /health/ready` — readiness (true after reranker warmup)

### Environment profiles (`APP_ENV`)

`local` | `dev` | `staging` | `prod` — controls CORS origin defaults. Override with `FRONTEND_URLS` (comma-separated).

### Task execution modes

`TASK_EXECUTION_MODE`: `celery` (default) | `hybrid` | `lambda` — controls whether background tasks go to Celery or SQS/Lambda.

---

## Key conventions

- All API routes are prefixed `/api/v1/`
- Every authenticated backend route uses `Depends(get_current_user)` from `app.core.security`
- Resource-level RBAC uses `require_permission(resource_type, path_param, min_role)` from `app.core.permissions`
- DB sessions are always async (`AsyncSession`); use `Depends(get_db)` in routes
- Migrations are Alembic autogenerate — import new models in `app/models/__init__.py` so they're registered with SQLAlchemy metadata (see `app/main.py` line 13)
- Frontend hooks poll automatically when file status is `uploading`/`processing` (3s interval), using TanStack Query's `refetchInterval`
- The `unwrap()` helper in `useApi.ts` handles API responses that wrap data in a key (e.g. `{ groups: [...] }`) vs. bare arrays
