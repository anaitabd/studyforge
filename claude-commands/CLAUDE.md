# StudyForge — Project Context

## What this project is
AI-powered educational platform for Morocco. Students upload course materials (PDF, DOCX, PPTX, TXT), chat with them via RAG, auto-generate exams and flashcards, and follow AI-curated learning paths. Teachers get real-time analytics and cohort management. Target users: Moroccan students at all levels (Primaire → Collège → Lycée → Université).

## Backend stack
- Python 3.11, FastAPI 0.111, SQLAlchemy 2.0 async, Pydantic v2, Alembic
- PostgreSQL 16 + TimescaleDB, Redis 5, Celery 5.4, ChromaDB 0.5 (HTTP client mode)
- AI default: Google Gemini (gemini-2.5-flash + text-multilingual-embedding-002)
- AI alternates: claude_vertex / bedrock / nvidia / ollama — all implement BaseAIProvider ABC in app/services/ai_service.py
- Storage: GCS (prod), MinIO (local)
- Auth: Clerk JWT — verified in app/core/security.py via get_current_user()
- RBAC: require_permission(resource_type, path_param, min_role) in app/core/permissions.py
- Celery queues: files, notifications, slides, analytics
- Notifications: SendGrid (email), Twilio (WhatsApp + SMS)
- Payments: Stripe + PayPal (Stripe primary)

## Frontend stack
- Next.js 15 App Router, TypeScript 5, Tailwind CSS 3.4
- Auth: Clerk 7 — useUser(), useAuth() hooks
- Server state: TanStack Query v5 — all hooks in apps/web/lib/hooks/
- UI state: Zustand 5 — apps/web/store/useAppStore.ts
- HTTP: Axios instance in apps/web/lib/api.ts — Clerk JWT attached via request interceptor
- Streaming: native fetch + ReadableStream SSE in lib/hooks/use-streaming-chat.ts
- Charts: Recharts 3.8

## Key conventions
- All authenticated routes use Depends(get_current_user)
- New models MUST be added to app/models/__init__.py for Alembic autogenerate
- Heavy work goes to Celery — choose the appropriate queue (files/notifications/slides/analytics)
- API prefix: /api/v1/
- All frontend API calls go through lib/api.ts (never fetch directly)
- 401 → redirect to sign-in | 402 → redirect to pricing | 429 → toast error

## Project structure
- apps/api/ — FastAPI backend
- apps/web/ — Next.js frontend
- apps/api/app/api/v1/ — Route handlers (19 modules)
- apps/api/app/models/ — SQLAlchemy ORM models (22 modules)
- apps/api/app/services/ — Business logic
- apps/api/app/tasks/ — Celery task definitions
- apps/api/app/core/ — Config, DB, security, RBAC, middleware
- apps/web/app/(app)/ — Protected frontend routes
- apps/web/components/ — Feature-scoped UI components
- apps/web/lib/hooks/ — TanStack Query hooks per feature

## RAG pipeline
Query rewrite → embed (Gemini) → ChromaDB search (top-8, min_score=0.4) → cross-encoder rerank (top-5) → LLM stream → SSE response

## Current subscription plans
- Free: 1 group, 20 chats/day, 5 exam generations/month
- Personal: unlimited groups, 500 chats/day, unlimited exams
- School: everything + org features, cohort management, bulk invite
