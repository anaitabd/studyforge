# StudyForge

AI-powered educational RAG platform. Students upload course materials (PDF, DOCX, PPTX, TXT), chat with them, auto-generate exams and flashcards, and follow AI-curated learning paths. Teachers get real-time analytics and cohort management. Organizations manage multi-tenant deployments with full RBAC.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Monorepo Layout](#monorepo-layout)
4. [Features](#features)
5. [Local Development](#local-development)
6. [Backend (apps/api)](#backend-appsapi)
7. [Frontend (apps/web)](#frontend-appsweb)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Background Jobs (Celery)](#background-jobs-celery)
11. [Authentication & RBAC](#authentication--rbac)
12. [Subscription Plans](#subscription-plans)
13. [AI Providers](#ai-providers)
14. [Infrastructure & Deployment](#infrastructure--deployment)
15. [Environment Variables](#environment-variables)
16. [Testing](#testing)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser / Mobile                                                  │
│  Next.js 15 (App Router) · Clerk auth · TanStack Query · Zustand  │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTPS (JWT)
┌──────────────────────────▼─────────────────────────────────────────┐
│  FastAPI  /api/v1/*                                                │
│  • Clerk JWT verification                                          │
│  • RBAC (require_permission)                                       │
│  • Rate limiting (SlowAPI, plan-based)                             │
│  • SSE streaming for chat                                          │
└──┬──────────────┬────────────────────────┬──────────────────────┬──┘
   │              │                        │                      │
   ▼              ▼                        ▼                      ▼
PostgreSQL     Redis               Celery Workers           ChromaDB
(TimescaleDB)  (cache/broker)      files | notifications    (vector store)
                                   slides | analytics
                                          │
                                    GCS / S3
                                  (file storage)
                                          │
                                  AI Provider
                            Gemini | Claude Vertex | Bedrock
```

**Request lifecycle:**

1. Clerk JWT arrives → `get_current_user()` verifies via JWKS, auto-provisions user in DB if new
2. RBAC checked via `require_permission(resource_type, path_param, min_role)`
3. Route handler in `app/api/v1/` delegates to a service in `app/services/`
4. Heavy work (file ingestion, generation, notifications) dispatched to Celery

**RAG pipeline** (`app/services/rag_service.py`):

1. Query rewriting via LLM
2. Embedding via AI provider
3. ChromaDB vector search (top-8, min_score=0.4)
4. Cross-encoder reranking → top-5 (`app/services/reranker.py`)
5. LLM streaming returned as SSE

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4 |
| Auth | Clerk 7 (JWT, webhooks, MFA) |
| State | TanStack Query v5 (server), Zustand 5 (UI) |
| HTTP client | Axios 1.15 |
| Charts | Recharts 3.8 |
| Backend | Python 3.11, FastAPI 0.111, SQLAlchemy 2.0 async, Pydantic v2 |
| Database | PostgreSQL 16 + TimescaleDB |
| ORM/migrations | SQLAlchemy 2 + Alembic |
| Task queue | Celery 5.4 + Redis 5 |
| Vector store | ChromaDB 0.5 (HTTP client mode) |
| AI (default) | Google Gemini (gemini-2.5-flash + text-multilingual-embedding-002) |
| AI (alts) | Claude on Vertex AI, AWS Bedrock, NVIDIA NIM, Ollama |
| Storage | Google Cloud Storage (primary), S3-compatible (MinIO local) |
| Notifications | SendGrid (email), Twilio (WhatsApp) |
| Payments | Stripe + PayPal |
| Observability | Sentry |
| CI/CD | Google Cloud Build → Cloud Run |
| IaC | Terraform (AWS + GCP modules) |

---

## Monorepo Layout

```
studyforge/
├── apps/
│   ├── api/                  # FastAPI backend
│   └── web/                  # Next.js 15 frontend
├── packages/
│   └── shared-types/         # Shared TypeScript interfaces
├── infra/
│   └── terraform/
│       ├── modules/          # network, rds, elasticache, s3, ecr, ecs_api,
│       │                     # alb, iam, secrets, security, sqs, eventbridge,
│       │                     # observability
│       └── environments/     # dev, staging, prod
├── scripts/
│   ├── aws-preflight.sh
│   └── gcp-setup.sh
├── prompts/                  # Documented AI feature prompts
├── docs/                     # Architecture blueprint, AWS ops runbook
├── audit/                    # Audit reports and master maps
├── docker-compose.yml        # Full local dev stack (10 services)
├── cloudbuild.yaml           # GCP Cloud Build pipeline
├── .env.example
├── CLAUDE.md
└── README.md
```

---

## Features

### Core Learning

| Feature | Description |
|---|---|
| **RAG Chat** | Ask questions about uploaded materials; citations point to source files |
| **Exam Generation** | AI creates MCQ / open-ended / Moroccan-bac-style questions from documents |
| **Flashcards** | AI generates cards; SM-2 algorithm schedules reviews (Again / Hard / Good / Easy) |
| **Live Quiz** | Teacher hosts real-time quiz sessions with PIN join and live leaderboard |
| **Learning Paths** | AI scaffolds a curriculum from documents; module-by-module progress tracking |
| **Slide Decks** | Documents converted to slide presentations, downloadable as PPTX |
| **Study Rooms** | Collaborative spaces with invite codes |
| **Concept Map** | Knowledge graph extracted from content; prerequisite relationships |

### Document Processing

- **PDF** — pdfplumber full extraction
- **DOCX** — python-docx
- **PPTX** — python-pptx
- **TXT** — plain text
- **OCR** — image-based text extraction
- **Photo Solve** — submit a photo of a math problem; AI solves it

### Teacher & Organization

- Per-group analytics: student count, chat activity, exam scores, flashcard reviews
- Cohort management with bulk CSV invite
- Assignment creation with due dates and submission tracking
- Per-student drill-down: weak areas, XP, streaks
- At-risk student flagging (scheduled 06:00 UTC)

### Gamification

- XP and leveling system
- Badge achievements
- Learning streaks (reset detection at 23:55 UTC)
- Group leaderboards

### Admin Panel

- System health overview: stuck files, AI cost tracking
- User search, plan override, account suspension
- Feature flags (per-key toggle)
- School management

---

## Local Development

### Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js 20+
- A [Clerk](https://clerk.com) account (free tier)
- A Google Cloud or NVIDIA NIM API key (for AI features)

### 1. Clone and copy env files

```bash
git clone <repo-url> studyforge && cd studyforge
cp apps/api/.env.example apps/api/.env
# create apps/web/.env.local — see Environment Variables section below
```

### 2. Start infrastructure

```bash
# Postgres, Redis, MinIO, ChromaDB only
docker compose up postgres redis minio chroma_server -d

# Or full stack (all 10 services including API and web)
docker compose up --build
```

### 3. Run database migrations

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

### 4. Start the API

```bash
# From apps/api with virtualenv active
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### 5. Start Celery workers

```bash
# File ingestion, notifications, slide generation
celery -A app.tasks.celery_app worker --loglevel=info -Q files,notifications,slides

# Analytics (separate worker)
celery -A app.tasks.celery_app worker --loglevel=info -Q analytics

# Beat scheduler (exam deadlines, streaks, at-risk flagging)
celery -A app.tasks.celery_app beat --loglevel=info
```

### 6. Start the frontend

```bash
cd apps/web
npm install
npm run dev
# App: http://localhost:3000
```

### Docker Compose services reference

| Service | Port | Description |
|---|---|---|
| postgres | 5432 | TimescaleDB (PostgreSQL 16) |
| redis | 6379 | Cache + Celery broker |
| minio | 9000 / 9001 | S3-compatible storage (console on 9001) |
| chroma_server | 8001 | ChromaDB vector database |
| migrate | — | One-shot Alembic upgrade head |
| api | 8000 | FastAPI application |
| celery_worker | — | files / notifications / slides queues |
| celery_beat | — | Scheduled tasks |
| celery_analytics | — | Analytics queue (isolated worker) |
| web | 3000 | Next.js frontend |

---

## Backend (apps/api)

### Directory Structure

```
apps/api/
├── app/
│   ├── main.py               # App init, lifespan, logging, model import
│   ├── api/v1/               # Route handlers (19 modules)
│   ├── models/               # SQLAlchemy ORM models (22 modules)
│   ├── services/             # Business logic (15+ services)
│   ├── tasks/                # Celery task definitions
│   └── core/                 # Config, DB, security, RBAC, middleware
├── alembic/
│   ├── versions/             # 17 migration files
│   └── env.py
├── tests/                    # pytest async tests
├── requirements.txt
├── .env.example
└── Dockerfile
```

### Key services

| Service | File | Responsibility |
|---|---|---|
| AIService | `ai_service.py` | Provider abstraction (Gemini / Claude / Bedrock / NVIDIA / Ollama) |
| RAGService | `rag_service.py` | Query rewrite → embed → ChromaDB → rerank → stream |
| GraphRAGService | `graph_rag_service.py` | Knowledge-graph-aware retrieval |
| FileProcessor | `file_processor.py` | PDF / DOCX / PPTX text extraction and chunking |
| VectorStore | `vector_store.py` | ChromaDB HTTP client wrapper |
| ExamService | `exam_service.py` | AI exam generation, auto-grading, rubrics |
| FlashcardService | `flashcard_service.py` | AI card generation, SM-2 scheduling |
| LearningPathService | `learning_path_service.py` | Curriculum scaffolding |
| SlideService | `slide_service.py` | Document-to-slide conversion, PPTX export |
| LiveQuizService | `live_quiz_service.py` | Real-time quiz session management |
| GradingService | `grading_service.py` | Answer grading and corrections |
| AnalyticsService | `analytics_service.py` | KPI aggregation |
| GamificationService | `gamification_service.py` | Badges, XP, streaks, leaderboards |
| NotificationService | `notification_service.py` | Email (SendGrid), WhatsApp (Twilio), in-app |
| StorageService | `storage_service.py` | GCS / S3-compatible upload/download/delete |
| CurriculumService | `curriculum_service.py` | Moroccan curriculum parsing |
| PaymentService | `payment_service.py` | Stripe + PayPal integration |

### Core modules

| Module | Description |
|---|---|
| `core/config.py` | Pydantic Settings — `AppEnv`: local / dev / staging / prod |
| `core/database.py` | Async SQLAlchemy engine + `get_db` dependency |
| `core/security.py` | Clerk JWT verify, `get_current_user`, webhook handler |
| `core/permissions.py` | `require_permission(resource, path_param, min_role)` |
| `core/rate_limiter.py` | SlowAPI wrapper |
| `core/limits.py` | Per-plan rate limit rules |
| `core/plans.py` | Plan feature definitions |
| `core/cache.py` | Redis caching decorators |
| `core/middleware.py` | RequestID header, structured access logging |
| `core/sanitize.py` | Input sanitisation helpers |

### Health endpoints

```
GET /health        → liveness
GET /health/ready  → readiness (true after reranker warmup)
```

### Common commands

```bash
# From apps/api with virtualenv active

uvicorn app.main:app --reload --port 8000          # dev server
alembic upgrade head                               # apply all migrations
alembic revision --autogenerate -m "description"  # generate migration
pytest                                             # all tests
pytest tests/test_rag_service.py                  # single file
```

---

## Frontend (apps/web)

### Directory Structure

```
apps/web/
├── app/
│   ├── (auth)/               # Sign-in, sign-up, verify (Clerk)
│   ├── (app)/                # Protected routes
│   │   ├── dashboard/        # Home — groups overview
│   │   ├── groups/[groupId]/ # Chat, files, exams, flashcards, learning paths,
│   │   │                     # slides, live quiz, members, rooms, concepts,
│   │   │                     # assignments, generate, teacher analytics
│   │   ├── analytics/        # Personal + group analytics
│   │   ├── admin/            # Health, plans, orgs (super_admin only)
│   │   ├── org/[slug]/       # Org dashboard, members, cohorts, billing
│   │   ├── account/          # User settings
│   │   ├── pricing/          # Plans
│   │   ├── goals/            # Learning goals
│   │   └── live/[pin]/       # Live quiz join
│   ├── (org)/                # Public org routes
│   └── join/[token]/         # Group invite redeem
├── components/               # Feature-scoped UI components
│   ├── ui/                   # Base components (buttons, inputs, modals)
│   ├── layout/               # Header, sidebar, navigation
│   ├── chat/ exams/ flashcards/ files/ groups/ learning-paths/
│   ├── slides/ rooms/ analytics/ teacher/ admin/ org/ gamification/
│   ├── billing/ marketing/ concepts/
├── lib/
│   ├── api.ts                # Axios instance; Clerk JWT interceptor
│   ├── hooks/                # TanStack Query hooks per feature
│   ├── utils.ts
│   └── i18n.ts
├── store/
│   └── useAppStore.ts        # Zustand global state
├── hooks/                    # Component-level hooks
├── types/
├── public/                   # manifest.json, sw.js (PWA)
├── next.config.js
├── tailwind.config.js
└── Dockerfile                # Multi-stage: dev → builder → runner
```

### Data fetching pattern

- All API calls go through `lib/api.ts` (Axios)
- Clerk JWT attached via request interceptor via `registerTokenGetter()`
- 401 → redirect to sign-in; 402 → redirect to pricing; 429 → toast error
- Server state in TanStack Query; UI state in Zustand
- Streaming chat via native `fetch` + `ReadableStream` (SSE) in `lib/hooks/use-streaming-chat.ts`
- File status polling: 3-second `refetchInterval` while status is `uploading` or `processing`

### Common commands

```bash
cd apps/web
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint    # ESLint
```

---

## Database Schema

### Migrations (Alembic — 17 total)

| Migration | Description |
|---|---|
| `7b2a0c02f90e` | Initial tables (users, groups, exams, flashcards, chat, files) |
| `a1b2c3d4e5f6` | RBAC, organizations, permissions foundation |
| `3c0333513b97` | Learning paths and modules |
| `68720ec8f992` | Gamification (badges, achievements, streaks) |
| `af3c96e7f0a2` | Live quiz tables |
| `b4a1c9d8e7f2` | File error message column |
| `a3e5b7c9d1f2` | Moroccan exam columns |
| `b2c3d4e5f6a7` | Cohorts, assignments, goals |
| `c3d4e5f6a7b8` | User events (TimescaleDB hypertable) |
| `d9f2a1c4b8e3` | Slide decks |
| `41e24b0a4dff` | Performance indexes |
| `f63d1396049e` | Knowledge graph nodes + edges |
| `e1f3a2b5c7d8` | Extended account fields |
| `f2c4d6e8a0b1` | Admin audit logging |
| `c4875d29c5a5` | Drop user_events, clean nullable constraints |
| `d1e2f3a4b5c6` | Restore user_events + KPI constraint |
| `14a0f1adead3` | Merge heads |

> **Convention:** import new models in `app/models/__init__.py` so SQLAlchemy metadata picks them up for autogenerate.

### Core tables

| Table | Key columns |
|---|---|
| users | clerk_id, email, role, plan, org_id, stripe_customer_id |
| groups | name, owner_user_id, color, school_id, visibility |
| group_members | group_id, user_id, role, joined_at |
| files | group_id, filename, status, size, error_message |
| exams | group_id, creator_id, title, status, grading_mode, total_points |
| questions | exam_id, type, content, options, correct_answer, difficulty, points |
| exam_sessions | user_id, exam_id, status, score, time_spent |
| flashcard_sets | group_id, title, card_count |
| flashcards | set_id, front, back, interval, ease_factor, next_review |
| chat_messages | group_id, user_id, content, is_pinned |
| slide_decks | group_id, title, slide_count |
| rooms | group_id, name, invite_code |
| learning_paths | group_id, title, module_count |
| organizations | name, slug, logo_url, plan |
| cohorts | org_id, name, teacher_id |
| assignments | cohort_id, title, due_date |
| gamification_badges | user_id, badge_type, earned_at |
| user_events | user_id, event_type, timestamp, metadata (hypertable) |
| knowledge_graph_nodes | group_id, concept_name, description |
| notifications | user_id, type, read_at |
| audit_logs | actor_id, action, resource_type, resource_id |
| feature_flags | key, enabled, description |

---

## API Reference

All routes are prefixed `/api/v1/`. Every authenticated route uses `Depends(get_current_user)`.

### Auth & Webhooks

| Method | Path | Description |
|---|---|---|
| POST | `/auth/webhook` | Clerk user sync (svix-verified) |
| POST | `/webhooks/clerk` | Alternative Clerk webhook |
| POST | `/webhooks/paypal` | PayPal IPN handler |

### Groups

| Method | Path | Description |
|---|---|---|
| GET | `/groups` | List user's groups |
| POST | `/groups` | Create group |
| GET | `/groups/{id}` | Group details |
| DELETE | `/groups/{id}` | Delete group (owner) |
| GET | `/groups/{id}/members` | List members |
| POST | `/groups/{id}/invite` | Generate invite link |
| POST | `/groups/{id}/join` | Join via invite token |
| GET | `/groups/{id}/leaderboard` | Student XP leaderboard |

### Files

| Method | Path | Description |
|---|---|---|
| GET | `/groups/{id}/files` | List files |
| POST | `/groups/{id}/files` | Upload file → triggers Celery ingestion |
| GET | `/groups/{id}/files/{fid}` | File details |
| GET | `/groups/{id}/files/{fid}/status` | Poll ingestion status |
| DELETE | `/groups/{id}/files/{fid}` | Delete file + vector embeddings |
| POST | `/files/ocr/extract` | OCR text extraction from image |
| POST | `/files/solve/photo` | Solve math problem from photo |

### Chat (RAG)

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/chat` | Send message — SSE streaming response with citations |
| GET | `/groups/{id}/chat/history` | Paginated history |
| POST | `/groups/{id}/chat/pin` | Pin a message |
| GET | `/groups/{id}/chat/pinned` | List pinned messages |

### Exams

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/exams/generate` | AI exam generation |
| GET | `/groups/{id}/exams` | List exams |
| GET | `/groups/{id}/exams/{eid}` | Exam details |
| PATCH | `/groups/{id}/exams/{eid}` | Assign to students |
| POST | `/groups/{id}/exams/{eid}/sessions` | Start exam session |
| PUT | `/groups/{id}/exams/{eid}/sessions/{sid}` | Autosave answers |
| POST | `/groups/{id}/exams/{eid}/sessions/{sid}/submit` | Submit + auto-grade |
| GET | `/groups/{id}/exams/{eid}/sessions/{sid}` | Session results & corrections |
| POST | `/groups/{id}/exams/{eid}/construction/photo` | Upload photo for construction problem |

### Flashcards

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/flashcards/generate` | AI card generation |
| GET | `/groups/{id}/flashcards` | List sets |
| GET | `/groups/{id}/flashcards/{setId}` | Set details |
| GET | `/groups/{id}/flashcards/{setId}/due` | Due cards (SM-2) |
| POST | `/groups/{id}/flashcards/{setId}/cards/{cid}/review` | Review rating |
| DELETE | `/groups/{id}/flashcards/{setId}` | Delete set |

### Learning Paths

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/learning-paths/generate` | AI curriculum generation |
| GET | `/groups/{id}/learning-paths` | List paths |
| GET | `/groups/{id}/learning-paths/{path_id}` | Path details |
| GET | `/groups/{id}/learning-paths/{path_id}/modules/{module_id}` | Module details |
| POST | `/groups/{id}/learning-paths/{path_id}/modules/{module_id}/progress` | Track progress |
| DELETE | `/groups/{id}/learning-paths/{path_id}` | Delete |

### Slide Decks

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/slide-decks` | Create deck from files |
| GET | `/groups/{id}/slide-decks` | List decks |
| GET | `/groups/{id}/slide-decks/{deck_id}` | Deck details |
| POST | `/groups/{id}/slide-decks/{deck_id}/progress` | Track viewing progress |
| POST | `/groups/{id}/slide-decks/{deck_id}/slides/{slide_id}/quiz` | Per-slide quiz |
| GET | `/groups/{id}/slide-decks/{deck_id}/pptx` | Download as PPTX |
| DELETE | `/groups/{id}/slide-decks/{deck_id}` | Delete |

### Live Quiz

| Method | Path | Description |
|---|---|---|
| POST | `/live-quiz/create` | Create session |
| POST | `/live-quiz/{quiz_id}/start` | Start |
| POST | `/live-quiz/{quiz_id}/next` | Advance question |
| POST | `/live-quiz/{quiz_id}/end` | End session |
| GET | `/live-quiz/join/{pin}` | Join by PIN |
| POST | `/live-quiz/{quiz_id}/answer` | Submit answer |
| GET | `/live-quiz/{quiz_id}/stream` | SSE stream (live scores) |
| GET | `/live-quiz/{quiz_id}/results` | Final results |

### Concepts (Knowledge Graph)

| Method | Path | Description |
|---|---|---|
| GET | `/groups/{id}/concepts` | List concepts |
| GET | `/groups/{id}/concepts/{concept_id}/prerequisites` | Prerequisite nodes |
| GET | `/groups/{id}/concepts/map` | Full dependency graph |

### Rooms & Search

| Method | Path | Description |
|---|---|---|
| POST | `/rooms` | Create study room |
| GET | `/rooms/group/{group_id}` | List rooms |
| POST | `/rooms/{id}/join` | Join by invite code |
| DELETE | `/rooms/{id}` | Leave / delete |
| GET | `/search` | Full-text search across group content |

### Teacher Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/teacher/groups/{id}/analytics` | Class KPIs |
| GET | `/teacher/groups/{id}/generate-history` | Generation activity |
| GET | `/teacher/cohorts/{cohort_id}/live` | Live cohort metrics |
| POST | `/teacher/cohorts/{cohort_id}/generate` | Bulk generate for cohort |
| GET | `/teacher/assignments/{assignment_id}/progress` | Submission tracking |
| PATCH | `/teacher/assignments/{assignment_id}/progress/{user_id}` | Grade assignment |

### Organizations

| Method | Path | Description |
|---|---|---|
| POST | `/organizations` | Create org |
| GET | `/organizations/{slug}` | Org details |
| PATCH | `/organizations/{slug}` | Update org |
| GET | `/organizations/{slug}/members` | Members list |
| POST | `/organizations/{slug}/members/invite` | Single invite |
| POST | `/organizations/{slug}/members/bulk-invite` | Bulk CSV invite |
| DELETE | `/organizations/{slug}/members/{user_id}` | Remove member |
| PATCH | `/organizations/{slug}/members/{user_id}/role` | Change role |
| GET/POST | `/organizations/{slug}/cohorts` | Manage cohorts |
| POST | `/organizations/{slug}/cohorts/{cohort_id}/members` | Add members |
| POST | `/organizations/{slug}/cohorts/{cohort_id}/assignments` | Create assignment |
| GET | `/organizations/{slug}/kpis/overview` | Org-wide analytics |
| GET | `/organizations/{slug}/kpis/cohorts` | Cohort analytics |
| GET | `/organizations/{slug}/cohorts/{cohort_id}/kpis` | Cohort KPIs |

### User (Me)

| Method | Path | Description |
|---|---|---|
| GET/PATCH | `/me/account` | Profile |
| DELETE | `/me/account` | Account deletion |
| PATCH | `/me/notifications` | Notification preferences |
| GET | `/me/kpis` | XP, badges, streaks |
| GET | `/me/streak` | Learning streak |
| GET | `/me/xp` | Experience points |
| GET | `/me/badges` | Earned badges |
| GET | `/me/challenge/today` | Daily challenge |
| POST | `/me/challenge/today/progress` | Complete challenge |
| GET | `/me/weak-areas` | Identified weak topics |
| GET | `/me/continue-learning` | Resume suggestion |
| POST | `/me/subscribe` | Start subscription |
| GET | `/me/subscription` | Subscription status |
| POST | `/me/billing-portal` | Stripe customer portal redirect |
| GET/POST | `/me/goals` | Learning goals |

### Notifications & Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List notifications |
| PUT | `/notifications/{id}/read` | Mark read |
| PUT | `/notifications/read-all` | Mark all read |
| POST | `/analytics/reading-event` | Track reading engagement (204) |

### Admin

| Method | Path | Description |
|---|---|---|
| GET | `/admin/health/overview` | System health |
| GET | `/admin/health/stuck-files` | Files stuck in processing |
| POST | `/admin/health/stuck-files/{id}/retry` | Retry stuck file |
| POST | `/admin/health/stuck-files/{id}/mark-error` | Force error state |
| GET | `/admin/health/ai-costs` | AI API cost tracking |
| GET | `/admin/users/search` | Search users |
| POST | `/admin/users/{id}/override-plan` | Override subscription |
| POST | `/admin/users/{id}/suspend` | Suspend account |
| GET | `/admin/feature-flags` | List flags |
| PATCH | `/admin/feature-flags/{key}` | Toggle flag |
| GET | `/admin/schools` | List schools |

---

## Background Jobs (Celery)

### Queues and tasks

| Queue | Task | Trigger |
|---|---|---|
| `files` | `process_file_task` | File upload — extract, chunk, embed into ChromaDB |
| `files` | `generate_exam_task` | Exam generation request |
| `slides` | `generate_slides_task` | Slide deck creation request |
| `notifications` | `send_email_task` | Any email notification event |
| `notifications` | `send_whatsapp_task` | WhatsApp notification event |
| `notifications` | `send_in_app_task` | In-app notification write |
| `analytics` | `compute_user_analytics_task` | User KPI aggregation |
| `analytics` | `compute_cohort_analytics_task` | Cohort-level metrics |

### Beat (scheduled tasks)

| Schedule | Task |
|---|---|
| Hourly | Exam deadline check — notify students |
| 23:55 UTC daily | Streak record + reset detection |
| 06:00 UTC daily | At-risk student flagging |

### File ingestion states

```
UPLOADING → PROCESSING → READY
                       ↘ ERROR (with error_message)
```

`TASK_EXECUTION_MODE` env var: `celery` (default) | `hybrid` | `lambda` — switches between Celery and SQS/Lambda for background dispatch.

---

## Authentication & RBAC

### Clerk integration

- JWTs verified via JWKS in `app/core/security.py`
- `get_current_user()` verifies token and auto-provisions missing users in DB
- Webhooks (`user.created`, `user.updated`) verified with `svix`
- MFA supported by Clerk

### Role hierarchy

```
super_admin > admin > teacher > student > viewer
```

### Permission model

```python
# Resource-level check; raises 403 if insufficient
require_permission(resource_type="group", path_param="id", min_role="teacher")
```

Group roles: `student` | `teacher` | `owner`
Org roles: `member` | `admin` | `owner`

### Rate limiting

SlowAPI enforces per-plan limits. Plan limits defined in `app/core/limits.py`.

---

## Subscription Plans

| Feature | Free | Personal | School |
|---|---|---|---|
| Groups | 1 | Unlimited | Unlimited |
| Chat messages/day | 20 | 500 | Unlimited |
| Exam generations/month | 5 | Unlimited | Unlimited |
| Flashcard generation | — | ✓ | ✓ |
| Organization features | — | — | ✓ |
| Cohort management | — | — | ✓ |
| Bulk invite | — | — | ✓ |

Payment via Stripe (primary) or PayPal. Stripe customer portal at `/me/billing-portal`.

---

## AI Providers

Controlled by the `AI_PROVIDER` environment variable. All providers implement `BaseAIProvider` ABC in `app/services/ai_service.py`.

| Value | Provider | Notes |
|---|---|---|
| `gemini` | Google Gemini (Vertex AI) | Default; `gemini-2.5-flash` + `text-multilingual-embedding-002` |
| `claude_vertex` | Anthropic Claude on Vertex | Requires `GCP_PROJECT_ID` + `GCP_LOCATION` |
| `bedrock` | AWS Bedrock | Requires AWS credentials |
| `nvidia` | NVIDIA NIM | OpenAI-compatible endpoint |
| `ollama` | Ollama (local) | For fully offline dev |

Switching providers requires only an env var change; no code changes.

---

## Infrastructure & Deployment

### Google Cloud Build (CI/CD)

Triggered on push to `main`. Builds both Docker images, pushes to Artifact Registry, deploys to Cloud Run.

**Substitution variables in `cloudbuild.yaml`:**

| Variable | Default | Description |
|---|---|---|
| `_REGION` | `europe-west9` | GCP region |
| `_AR_REPO` | `studyforge` | Artifact Registry repository |
| `_API_URL` | — | Cloud Run API service URL |
| `_WEB_URL` | — | Cloud Run web service URL |
| `_CLERK_KEY` | — | Clerk publishable key |
| `_CHROMA_HOST` | — | ChromaDB endpoint |

### Docker images

**API** (`apps/api/Dockerfile`):
- Base: `python:3.11-slim`
- Installs `gcc`, `libpq-dev`
- Entrypoint: `./entrypoint.sh`
- Port: 8000

**Web** (`apps/web/Dockerfile`):
- Multi-stage: `dev` → `builder` → `runner`
- Production: Next.js standalone output, compressed assets
- Port: 3000

### Terraform modules (infra/terraform/modules/)

`network` · `rds` · `elasticache` · `s3` · `ecr` · `ecs_api` · `alb` · `iam` · `secrets` · `security` · `sqs` · `eventbridge` · `observability`

Environments: `dev` · `staging` · `prod`

---

## Environment Variables

### Backend (apps/api/.env)

```env
# App
APP_ENV=local                          # local | dev | staging | prod
SECRET_KEY=change-me

# URLs
FRONTEND_URL=http://localhost:3000
FRONTEND_URLS=http://localhost:3000    # comma-separated for multiple origins

# Database
DATABASE_URL=postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge

# Redis
REDIS_URL=redis://localhost:6379/0

# AI Provider
AI_PROVIDER=gemini                     # gemini | claude_vertex | bedrock | nvidia | ollama
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=europe-west9
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_EMBED_MODEL=text-multilingual-embedding-002

# Storage
GCS_BUCKET=studyforge-files
GCS_EMULATOR_HOST=http://localhost:4443  # local MinIO

# Vector store
CHROMA_HOST=chroma_server
CHROMA_PORT=8001

# Auth (Clerk)
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Notifications
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+...

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...

# Observability
SENTRY_DSN=...

# Task execution
TASK_EXECUTION_MODE=celery             # celery | hybrid | lambda
```

### Frontend (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

## Testing

Tests live in `apps/api/tests/`. `pytest.ini` sets asyncio mode to `auto`.

```bash
cd apps/api && source .venv/bin/activate

pytest                                  # all tests
pytest tests/test_rag_service.py        # single file
pytest -k "test_ai_provider"            # filter by name
pytest --tb=short                       # compact tracebacks
```

Test coverage areas:

- AI provider selection and fallback
- RAG pipeline (embed → retrieve → rerank)
- File processor (PDF, DOCX, PPTX parsing)
- Storage service (upload, download, delete)
- Slide service (deck generation)

---
 
## Contributing

1. Branch from `main`
2. Follow existing async patterns (`AsyncSession`, `await`, `Depends`)
3. Add new models to `app/models/__init__.py` for Alembic autogenerate
4. All authenticated routes must use `Depends(get_current_user)`
5. Resource-level checks use `require_permission()`
6. New background work goes through Celery — choose the appropriate queue
7. Run `pytest` and `npm run lint` before pushing
