# StudyForge V3 — Complete Claude Code Build Prompt

You are building **StudyForge**, an AI-powered educational SaaS platform for Moroccan students and
teachers. Work through every section below **in order**. Stop after each **COMMIT** checkpoint and
report what was built before continuing. Never skip a section. Never add features not specified.
Fix all TypeScript and ruff errors before each COMMIT.

Ground rules:
- Python 3.11+, TypeScript strict mode — `any` is forbidden
- All DB calls are async (SQLAlchemy 2.0 + asyncpg)
- Every FastAPI route: `Depends(get_current_user)` — zero exceptions
- Plan limits live in `plan_limits` table, never in route code
- All UI copy in French
- `bg-slate-700 animate-pulse` for skeletons — never white
- Score display: X/20 format, color-coded (≥16 green, ≥12 amber, ≥8 orange, <8 red)

---

## SECTION 1 — MONOREPO STRUCTURE

Create this exact tree (skip anything already present):

```
studyforge/
├── apps/
│   ├── api/
│   │   ├── alembic/
│   │   │   ├── versions/
│   │   │   └── env.py
│   │   ├── app/
│   │   │   ├── api/v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── users.py
│   │   │   │   ├── organizations.py
│   │   │   │   ├── groups.py
│   │   │   │   ├── documents.py
│   │   │   │   ├── chat.py
│   │   │   │   ├── exams.py
│   │   │   │   ├── flashcards.py
│   │   │   │   ├── learning_paths.py
│   │   │   │   ├── slides.py
│   │   │   │   ├── notifications.py
│   │   │   │   ├── billing.py
│   │   │   │   ├── analytics.py
│   │   │   │   └── admin.py
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   ├── database.py
│   │   │   │   ├── security.py
│   │   │   │   ├── permissions.py
│   │   │   │   └── limits.py
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── user.py
│   │   │   │   ├── organization.py
│   │   │   │   ├── group.py
│   │   │   │   ├── document.py
│   │   │   │   ├── exam.py
│   │   │   │   ├── flashcard.py
│   │   │   │   ├── learning_path.py
│   │   │   │   ├── subscription.py
│   │   │   │   └── event.py
│   │   │   ├── schemas/
│   │   │   │   ├── auth.py, user.py, organization.py
│   │   │   │   ├── group.py, document.py, exam.py
│   │   │   │   ├── flashcard.py, learning_path.py
│   │   │   │   ├── billing.py, analytics.py
│   │   │   ├── services/
│   │   │   │   ├── ai_service.py       # BaseAIProvider + Bedrock/OpenAI/NVIDIA
│   │   │   │   ├── nim_service.py      # NVIDIA NIM embed + rerank (new)
│   │   │   │   ├── rag_service.py
│   │   │   │   ├── vector_store.py     # Qdrant hybrid search
│   │   │   │   ├── file_processor.py
│   │   │   │   ├── storage_service.py  # Cloudflare R2
│   │   │   │   ├── exam_service.py
│   │   │   │   ├── flashcard_service.py
│   │   │   │   ├── slide_service.py
│   │   │   │   ├── notification_service.py
│   │   │   │   ├── billing_service.py
│   │   │   │   └── analytics_service.py
│   │   │   ├── tasks/                  # Celery (heavy)
│   │   │   │   ├── celery_app.py
│   │   │   │   ├── file_tasks.py
│   │   │   │   ├── slide_tasks.py
│   │   │   │   ├── exam_tasks.py       # grade_open_answers
│   │   │   │   └── analytics_tasks.py
│   │   │   ├── jobs/                   # ARQ (lightweight)
│   │   │   │   ├── arq_app.py
│   │   │   │   ├── notification_jobs.py
│   │   │   │   └── status_jobs.py
│   │   │   └── main.py
│   │   ├── tests/
│   │   ├── alembic.ini
│   │   ├── pyproject.toml
│   │   └── .env.example
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── sign-in/page.tsx
│       │   │   ├── sign-up/page.tsx
│       │   │   └── verify/page.tsx
│       │   ├── (app)/
│       │   │   ├── layout.tsx
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── groups/
│       │   │   │   ├── page.tsx
│       │   │   │   └── [groupId]/
│       │   │   │       ├── layout.tsx
│       │   │   │       ├── chat/page.tsx
│       │   │   │       ├── files/page.tsx
│       │   │   │       ├── exams/
│       │   │   │       │   ├── page.tsx
│       │   │   │       │   └── [examId]/
│       │   │   │       │       ├── page.tsx
│       │   │   │       │       └── results/[sessionId]/page.tsx
│       │   │   │       ├── flashcards/page.tsx
│       │   │   │       ├── learning-paths/page.tsx
│       │   │   │       ├── slides/page.tsx
│       │   │   │       ├── members/page.tsx
│       │   │   │       └── generate/page.tsx
│       │   │   ├── org/[slug]/
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── members/page.tsx
│       │   │   │   ├── groups/page.tsx
│       │   │   │   ├── analytics/page.tsx
│       │   │   │   └── billing/page.tsx
│       │   │   ├── account/page.tsx
│       │   │   └── admin/
│       │   │       ├── layout.tsx
│       │   │       ├── page.tsx
│       │   │       ├── orgs/page.tsx
│       │   │       └── plans/page.tsx
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                     # shadcn primitives
│       │   ├── layout/sidebar.tsx, header.tsx, group-tabs.tsx
│       │   ├── chat/
│       │   │   ├── chat-window.tsx
│       │   │   ├── message-bubble.tsx
│       │   │   ├── citation-chip.tsx
│       │   │   └── source-drawer.tsx
│       │   ├── exams/
│       │   │   ├── exam-card.tsx
│       │   │   ├── question-renderer.tsx
│       │   │   ├── timer.tsx
│       │   │   └── results-view.tsx
│       │   ├── flashcards/
│       │   │   ├── flashcard-stack.tsx
│       │   │   └── review-buttons.tsx
│       │   ├── files/
│       │   │   ├── upload-zone.tsx
│       │   │   └── document-list.tsx
│       │   ├── analytics/
│       │   │   ├── stat-card.tsx
│       │   │   ├── score-chart.tsx
│       │   │   └── student-table.tsx
│       │   └── billing/
│       │       ├── plan-card.tsx
│       │       └── bank-transfer-modal.tsx
│       ├── lib/
│       │   ├── api.ts
│       │   ├── auth.ts
│       │   ├── hooks/
│       │   │   ├── use-groups.ts, use-documents.ts
│       │   │   ├── use-chat.ts, use-exams.ts
│       │   │   ├── use-flashcards.ts, use-learning-paths.ts
│       │   │   ├── use-org.ts, use-billing.ts
│       │   │   └── use-analytics.ts
│       │   └── utils.ts
│       ├── middleware.ts
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── tsconfig.json
├── docker-compose.yml
└── CLAUDE.md
```

**COMMIT: "chore: scaffold monorepo — missing dirs and stubs"**

---

## SECTION 2 — ENVIRONMENT VARIABLES

### `apps/api/.env.example`
```env
# App
APP_ENV=local
SECRET_KEY=changeme_min32chars
FRONTEND_URL=http://localhost:3000

# Database (TimescaleDB via Supabase or local)
DATABASE_URL=postgresql+asyncpg://studyforge:password@localhost:5432/studyforge

# Better Auth
BETTER_AUTH_SECRET=changeme
BETTER_AUTH_URL=http://localhost:8000

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=

# LLM — DeepSeek V3 via AWS Bedrock
AI_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=deepseek.deepseek-v3-20250324

# NVIDIA NIM — embeddings + reranking
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_EMBED_MODEL=nvidia/nv-embedqa-e5-v5
NVIDIA_RERANK_MODEL=nvidia/nv-rerankqa-mistral-4b-v3

# Storage — Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=studyforge-files
R2_PUBLIC_URL=https://files.studyforge.ma

# Redis (Celery broker + ARQ)
REDIS_URL=redis://localhost:6379/0

# Upstash Redis (edge cache)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Email
SENDGRID_API_KEY=
SENDGRID_FROM=noreply@studyforge.ma

# WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+212XXXXXXXXX

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_TEACHER_SOLO=price_xxx
STRIPE_PRICE_SCHOOL_STARTER=price_xxx
STRIPE_PRICE_SCHOOL_PRO=price_xxx
```

### `apps/web/.env.example`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=changeme
BETTER_AUTH_URL=http://localhost:8000
```

**COMMIT: "chore: env templates"**

---

## SECTION 3 — BACKEND FOUNDATION

### 3.1 `app/core/config.py`

Pydantic `BaseSettings`. Every env var above becomes a typed field. No hardcoded defaults for secrets
(SECRET_KEY, BETTER_AUTH_SECRET, NVIDIA_API_KEY, R2_ACCESS_KEY_ID must have no defaults — Pydantic
will raise on startup if missing).

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    APP_ENV: str = "local"
    SECRET_KEY: str
    FRONTEND_URL: str = "http://localhost:3000"

    DATABASE_URL: str

    BETTER_AUTH_SECRET: str
    BETTER_AUTH_URL: str = "http://localhost:8000"

    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_API_KEY: str = ""

    AI_PROVIDER: str = "bedrock"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "deepseek.deepseek-v3-20250324"

    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"
    NVIDIA_RERANK_MODEL: str = "nvidia/nv-rerankqa-mistral-4b-v3"

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = "studyforge-files"
    R2_PUBLIC_URL: str = ""

    REDIS_URL: str = "redis://localhost:6379/0"
    UPSTASH_REDIS_URL: str = ""
    UPSTASH_REDIS_TOKEN: str = ""

    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM: str = "noreply@studyforge.ma"

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_TEACHER_SOLO: str = ""
    STRIPE_PRICE_SCHOOL_STARTER: str = ""
    STRIPE_PRICE_SCHOOL_PRO: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### 3.2 `app/core/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### 3.3 `app/core/security.py`

Better Auth issues HS256 JWTs. Verify with shared secret. Do NOT make network calls on every request.

```python
import jwt
from dataclasses import dataclass, field
from fastapi import Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db

@dataclass
class UserContext:
    user: "User"
    org_role: str | None = None
    group_role: str | None = None
    is_superadmin: bool = False
    current_org_id: str | None = None

def _extract_token(request: Request) -> str:
    token = request.cookies.get("better-auth.session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Authentification requise")
    return token

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserContext:
    token = _extract_token(request)
    try:
        payload = jwt.decode(token, settings.BETTER_AUTH_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalide")

    # SSE tokens have scope="sse" — reject them on regular endpoints
    if payload.get("scope") == "sse":
        raise HTTPException(401, "Token SSE non autorisé ici")

    user_id = payload["sub"]
    user = await _get_or_create_user(db, user_id, payload)

    # Resolve org context
    org_slug = (
        request.headers.get("X-Org-Slug")
        or request.path_params.get("slug")
    )
    org_role = None
    current_org_id = None
    if org_slug:
        org_role, current_org_id = await _resolve_org_role(db, user.id, org_slug)

    return UserContext(
        user=user,
        org_role=org_role,
        is_superadmin=user.is_superadmin,
        current_org_id=current_org_id,
    )

async def get_sse_user(request: Request, db: AsyncSession = Depends(get_db)) -> "User":
    """Validates ?token= param for SSE endpoints."""
    token = request.query_params.get("token")
    if not token:
        raise HTTPException(401, "Token SSE manquant")
    try:
        payload = jwt.decode(token, settings.BETTER_AUTH_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token SSE invalide")
    if payload.get("scope") != "sse":
        raise HTTPException(401, "Token invalide pour SSE")
    user_id = payload["sub"]
    return await _get_or_create_user(db, user_id, payload)
```

`_get_or_create_user`: SELECT user by id; if not found, INSERT with email/name from JWT payload
(Better Auth includes these claims). Always upsert on first login.

`_resolve_org_role`: SELECT org by slug → get id → SELECT membership by (user_id, org_id) → return
(role, org_id) or (None, None).

### 3.4 `app/core/permissions.py`

```python
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_current_user, UserContext
from app.core.database import get_db

ROLE_RANK = {"student": 0, "teacher": 1, "admin": 2, "super_admin": 3}

def require_org_role(min_role: str):
    async def dep(ctx: UserContext = Depends(get_current_user)):
        if ctx.is_superadmin:
            return ctx
        if ctx.org_role is None or ROLE_RANK.get(ctx.org_role, -1) < ROLE_RANK[min_role]:
            raise HTTPException(403, "Accès refusé")
        return ctx
    return dep

def require_group_role(min_role: str):
    async def dep(
        request: Request,
        db: AsyncSession = Depends(get_db),
        ctx: UserContext = Depends(get_current_user),
    ):
        if ctx.is_superadmin:
            return ctx
        group_id = request.path_params.get("group_id")
        if not group_id:
            raise HTTPException(400, "group_id manquant")
        from app.models.group import GroupMember
        result = await db.execute(
            select(GroupMember.role).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == ctx.user.id,
            )
        )
        role = result.scalar_one_or_none()
        if role is None or ROLE_RANK.get(role, -1) < ROLE_RANK[min_role]:
            raise HTTPException(403, "Accès refusé au groupe")
        ctx.group_role = role
        return ctx
    return dep

def require_superadmin():
    async def dep(ctx: UserContext = Depends(get_current_user)):
        if not ctx.is_superadmin:
            raise HTTPException(403, "Réservé aux super-administrateurs")
        return ctx
    return dep
```

### 3.5 `app/core/limits.py`

```python
from fastapi import Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Callable
from app.core.database import get_db
from app.core.security import get_current_user, UserContext
from app.models.subscription import PlanLimits, Subscription
from app.core.config import settings

async def _get_active_plan(db: AsyncSession, org_id: str | None, user_id: str) -> str:
    if org_id:
        result = await db.execute(
            select(Subscription.plan).where(
                Subscription.org_id == org_id,
                Subscription.status.in_(["active", "trialing"]),
            ).limit(1)
        )
        plan = result.scalar_one_or_none()
        if plan:
            return plan
    result = await db.execute(
        select(Subscription.plan).where(
            Subscription.user_id == user_id,
            Subscription.status.in_(["active", "trialing"]),
        ).limit(1)
    )
    return result.scalar_one_or_none() or "free"

async def check_plan_limit(
    db: AsyncSession,
    org_id: str | None,
    user_id: str,
    limit_key: str,
    current_count: int,
) -> None:
    plan = await _get_active_plan(db, org_id, user_id)
    result = await db.execute(
        select(PlanLimits).where(PlanLimits.plan == plan)
    )
    limits = result.scalar_one_or_none()
    if limits is None:
        return
    max_val = getattr(limits, limit_key, None)
    if max_val is not None and current_count >= max_val:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "LIMIT_REACHED",
                "limit": limit_key,
                "current": current_count,
                "max": max_val,
                "plan": plan,
                "upgrade_url": f"{settings.FRONTEND_URL}/billing",
            },
        )

def enforce_limit(limit_key: str, count_fn: Callable):
    """
    Usage:
        @router.post("/", dependencies=[Depends(enforce_limit("max_groups", count_groups))])
    count_fn signature: async (db, ctx) -> int
    """
    async def dep(
        db: AsyncSession = Depends(get_db),
        ctx: UserContext = Depends(get_current_user),
    ):
        count = await count_fn(db, ctx)
        await check_plan_limit(db, ctx.current_org_id, ctx.user.id, limit_key, count)
    return dep
```

**COMMIT: "feat: backend foundation — config, db, security, permissions, limits"**

---

## SECTION 4 — SQLALCHEMY MODELS

All models use `Mapped[]` typed columns (SQLAlchemy 2.0). Import all models in
`app/models/__init__.py` so Alembic sees them.

### `app/models/user.py`
```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(20))
    preferred_lang: Mapped[str] = mapped_column(String(5), default="fr")
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_opted_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

No `role` field. Role is always resolved from memberships/group_members.

### `app/models/organization.py`
```python
class Organization(Base):
    __tablename__ = "organizations"
    id, name, slug (unique), logo_url, city, billing_email, created_at

class Membership(Base):
    __tablename__ = "memberships"
    id, user_id FK→users, org_id FK→organizations
    role: Enum("student","teacher","admin")
    status: Enum("active","invited","suspended")
    invited_by FK→users nullable
    joined_at: DateTime nullable
    __table_args__ = UniqueConstraint("user_id", "org_id")
```

### `app/models/group.py`
```python
class Group(Base):
    __tablename__ = "groups"
    id, org_id FK→organizations nullable (NULL = personal group)
    owner_id FK→users, name, subject, level, lang
    vector_namespace: str (unique) — format: "{org_id or 'personal'}:{group_id}"
    is_public: bool default False
    created_at

class GroupMember(Base):
    __tablename__ = "group_members"
    id, group_id FK→groups, user_id FK→users
    role: Enum("student","teacher")
    joined_at
    __table_args__ = UniqueConstraint("group_id","user_id")
```

### `app/models/document.py`
```python
class Document(Base):
    __tablename__ = "documents"
    id, group_id FK→groups, uploaded_by FK→users
    name: str, file_type: str (pdf/docx/pptx/txt)
    r2_key: str, file_size_bytes: BigInteger
    page_count: int nullable, chunk_count: int default 0
    status: Enum("pending","processing","indexed","error")
    error_message: Text nullable
    indexed_at: DateTime nullable
    created_at
```

### `app/models/exam.py`
```python
class Exam(Base):
    __tablename__ = "exams"
    id, group_id FK→groups, created_by FK→users, title
    difficulty: Enum("easy","medium","hard","mixed")
    duration_minutes: int default 60
    question_count: int
    question_types: JSONB (list of strings)
    subject_area: str nullable, level: str nullable
    status: Enum("generating","ready","archived")
    deadline_at: DateTime nullable
    created_at

class ExamQuestion(Base):
    __tablename__ = "exam_questions"
    id, exam_id FK→exams
    question_text: Text, question_type: str
    options: JSONB nullable, correct_answer: Text nullable
    explanation: Text nullable
    points: Float default 1.0
    source_doc_id FK→documents nullable
    source_page: int nullable, order_index: int default 0

class ExamSession(Base):
    __tablename__ = "exam_sessions"
    id, exam_id FK→exams, student_id FK→users
    answers: JSONB default {}        # {question_id: answer_str}
    score_over_20: Float nullable
    grading_status: Enum("pending","grading","done")
    started_at: DateTime server_default now()
    submitted_at: DateTime nullable
    corrections: JSONB default {}    # {question_id: {points_earned, feedback, is_correct}}
```

### `app/models/flashcard.py`
```python
class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"
    id, group_id FK→groups, created_by FK→users, title, created_at

class Flashcard(Base):
    __tablename__ = "flashcards"
    id, set_id FK→flashcard_sets, group_id FK→groups
    front: Text, back: Text
    source_doc_id FK→documents nullable
    source_page: int nullable
    difficulty: Enum("easy","medium","hard") default "medium"

class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    id, flashcard_id FK→flashcards, user_id FK→users
    result: Enum("got_it","almost","missed")
    ease_factor: Float default 2.5
    interval_days: int default 1
    repetitions: int default 0
    next_review_at: DateTime
    reviewed_at: DateTime server_default now()
    __table_args__ = UniqueConstraint("flashcard_id","user_id", name="uq_review_per_user")
```

### `app/models/learning_path.py`
```python
class LearningPath(Base):
    __tablename__ = "learning_paths"
    id, group_id FK→groups, student_id FK→users
    steps: JSONB   # list of step objects
    generated_at: DateTime
    __table_args__ = UniqueConstraint("group_id","student_id")
```

Step object schema (stored in JSONB):
```json
{"order": 1, "title": "...", "description": "...",
 "type": "read_doc|practice_flashcards|take_exam|review_weak_areas",
 "resource_id": "doc_id|null", "estimated_minutes": 20, "is_completed": false}
```

### `app/models/subscription.py`
```python
class Subscription(Base):
    __tablename__ = "subscriptions"
    id, user_id FK nullable, org_id FK nullable
    plan: Enum("free","teacher_solo","school_starter","school_pro","enterprise")
    status: Enum("active","past_due","cancelled","trialing")
    stripe_sub_id: str nullable, stripe_customer_id: str nullable
    seat_count: int default 1
    current_period_end: DateTime nullable
    is_manual_payment: bool default False
    created_at

class PlanLimits(Base):
    __tablename__ = "plan_limits"
    plan: str (primary key)
    max_groups: int nullable         # NULL = unlimited
    max_files_per_group: int nullable
    max_chat_per_day: int nullable
    max_exams_per_month: int nullable
    max_students: int nullable
    can_use_whatsapp: bool default False
    can_generate_slides: bool default False
    storage_gb: Float default 1.0

class ManualPaymentRequest(Base):
    __tablename__ = "manual_payment_requests"
    id, org_id FK→organizations
    plan: str, amount_mad: int
    reference: str (unique)   # "SF-{YYMM}{RAND4}"
    status: Enum("pending","confirmed","rejected")
    created_at, confirmed_at: DateTime nullable
    confirmed_by FK→users nullable
```

### `app/models/event.py`

NOT an ORM model. Define as SQLAlchemy Core `Table` so it's visible for raw inserts but excluded from
Alembic autogenerate. Add `include_object` guard in `alembic/env.py`:

```python
from sqlalchemy import Table, Column, String, DateTime, JSON
from app.core.database import Base

user_events = Table(
    "user_events", Base.metadata,
    Column("time", DateTime(timezone=True), nullable=False),
    Column("user_id", String(36), nullable=False),
    Column("org_id", String(36)),
    Column("group_id", String(36)),
    Column("event_type", String(100), nullable=False),
    Column("resource_id", String(36)),
    Column("metadata", JSON, server_default="{}"),
    Column("plan", String(50)),
)
```

**COMMIT: "feat: all SQLAlchemy models"**

---

## SECTION 5 — ALEMBIC MIGRATIONS

### `alembic/env.py`
```python
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
from alembic import context
from app.core.config import settings
from app.core.database import Base
import app.models.user, app.models.organization, app.models.group
import app.models.document, app.models.exam, app.models.flashcard
import app.models.learning_path, app.models.subscription, app.models.event

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=lambda obj, name, type_, reflected, compare_to: not (
            type_ == "table" and name == "user_events"
        ),
    )
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Migration sequence

1. `alembic revision --autogenerate -m "initial_schema"` — all ORM tables
2. Manual migration `create_user_events_hypertable`:
```python
def upgrade():
    op.execute("""
        CREATE TABLE user_events (
            time TIMESTAMPTZ NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            org_id VARCHAR(36),
            group_id VARCHAR(36),
            event_type VARCHAR(100) NOT NULL,
            resource_id VARCHAR(36),
            metadata JSONB DEFAULT '{}',
            plan VARCHAR(50)
        )
    """)
    op.execute("SELECT create_hypertable('user_events','time',if_not_exists=>TRUE)")
    op.execute("CREATE INDEX ON user_events (user_id, time DESC)")
    op.execute("CREATE INDEX ON user_events (org_id, time DESC)")
    op.execute("CREATE INDEX ON user_events (event_type, time DESC)")
```
3. Manual migration `seed_plan_limits`:
```python
def upgrade():
    op.execute("""
    INSERT INTO plan_limits VALUES
    ('free',          1,  3,  10,   1,  5,   false, false, 0.5),
    ('teacher_solo',  10, 20, 100,  20, 50,  false, true,  5.0),
    ('school_starter',50, 50, NULL, 200,200, true,  true,  20.0),
    ('school_pro',    NULL,NULL,NULL,NULL,600,true,  true,  100.0),
    ('enterprise',    NULL,NULL,NULL,NULL,NULL,true, true,  500.0)
    ON CONFLICT (plan) DO NOTHING
    """)
```

**COMMIT: "feat: alembic migrations with TimescaleDB hypertable and plan seeds"**

---

## SECTION 6 — NVIDIA NIM SERVICE

### `app/services/nim_service.py`

```python
import httpx
from app.core.config import settings

class NIMService:
    """NVIDIA NIM — embeddings + reranking via OpenAI-compatible API."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=settings.NVIDIA_BASE_URL,
            headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"},
            timeout=60.0,
        )

    async def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        """
        input_type: "passage" for documents, "query" for search queries.
        Prepend "passage: " or "query: " to each text (E5 convention).
        """
        prefix = f"{input_type}: "
        prefixed = [prefix + t for t in texts]
        resp = await self.client.post(
            "/embeddings",
            json={
                "input": prefixed,
                "model": settings.NVIDIA_EMBED_MODEL,
                "input_type": input_type,
                "encoding_format": "float",
            },
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        return [item["embedding"] for item in sorted(data, key=lambda x: x["index"])]

    async def rerank(
        self,
        query: str,
        passages: list[str],
        top_n: int = 5,
    ) -> list[dict]:
        """
        Returns list of {index, relevance_score} sorted descending.
        Use NVIDIA NIM reranking API (not the embeddings endpoint).
        """
        resp = await self.client.post(
            "/ranking",
            json={
                "model": settings.NVIDIA_RERANK_MODEL,
                "query": {"role": "user", "content": query},
                "passages": [{"role": "user", "content": p} for p in passages],
                "truncate": "END",
            },
        )
        resp.raise_for_status()
        rankings = resp.json()["rankings"]
        top = sorted(rankings, key=lambda x: x["logit"], reverse=True)[:top_n]
        return top

nim = NIMService()
```

Embed in batches of 32:
```python
async def embed_batched(texts: list[str], input_type: str) -> list[list[float]]:
    results = []
    for i in range(0, len(texts), 32):
        batch = await nim.embed(texts[i:i+32], input_type=input_type)
        results.extend(batch)
    return results
```

**COMMIT: "feat: NVIDIA NIM service — embed + rerank"**

---

## SECTION 7 — QDRANT VECTOR STORE

### `app/services/vector_store.py`

```python
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    VectorParams, Distance, PointStruct, Filter, FieldCondition,
    MatchValue, FilterSelector, SparseVectorParams, SearchRequest,
    SparseIndexParams,
)
from app.core.config import settings

VECTOR_SIZE = 1024   # nv-embedqa-e5-v5 output dimension

class VectorStore:
    def __init__(self):
        self.client = AsyncQdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            api_key=settings.QDRANT_API_KEY or None,
        )

    async def ensure_collection(self, collection_name: str) -> None:
        """One collection per org_id (or 'personal')."""
        exists = await self.client.collection_exists(collection_name)
        if not exists:
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                sparse_vectors_config={"bm25": SparseVectorParams(index=SparseIndexParams())},
            )

    async def upsert(self, collection: str, points: list[PointStruct]) -> None:
        await self.client.upsert(collection_name=collection, points=points, wait=True)

    async def search(
        self,
        collection: str,
        group_id: str,
        query_vector: list[float],
        top_k: int = 10,
        score_threshold: float = 0.35,
    ) -> list[dict]:
        group_filter = Filter(must=[FieldCondition(key="group_id", match=MatchValue(value=group_id))])
        hits = await self.client.search(
            collection_name=collection,
            query_vector=query_vector,
            query_filter=group_filter,
            limit=top_k,
            score_threshold=score_threshold,
            with_payload=True,
        )
        return [
            {
                "id": str(hit.id),
                "score": hit.score,
                "text": hit.payload.get("text", ""),
                "doc_id": hit.payload.get("doc_id"),
                "doc_name": hit.payload.get("doc_name"),
                "page": hit.payload.get("page"),
                "chunk_index": hit.payload.get("chunk_index"),
            }
            for hit in hits
        ]

    async def delete_by_doc(self, collection: str, doc_id: str) -> None:
        await self.client.delete(
            collection_name=collection,
            points_selector=FilterSelector(
                filter=Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))])
            ),
        )

vector_store = VectorStore()
```

**COMMIT: "feat: Qdrant vector store — hybrid search, multitenancy"**

---

## SECTION 8 — RAG PIPELINE

### `app/services/rag_service.py`

```python
import json
from typing import AsyncIterator
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.nim_service import nim
from app.services.vector_store import vector_store
from app.services.ai_service import get_ai_provider
from app.models.group import Group

NO_CONTEXT_REPLY = "Je ne trouve pas cette information dans les documents du groupe."

QUERY_REWRITE_PROMPT = (
    "Reformule cette question pour optimiser la recherche documentaire. "
    "Réponds UNIQUEMENT avec la question reformulée, sans explication :\n{question}"
)

SYSTEM_PROMPT = """Tu es un assistant pédagogique pour StudyForge.
Réponds UNIQUEMENT à partir du contexte fourni ci-dessous.
Si la réponse n'est pas dans le contexte, réponds exactement :
"{no_context}"
Ne fais jamais de suppositions. Cite les pages entre [crochets].

CONTEXTE:
{context}"""

@dataclass
class RAGSource:
    doc_name: str
    page: int
    doc_id: str

async def stream_answer(
    question: str,
    group_id: str,
    org_id: str | None,
    db: AsyncSession,
) -> AsyncIterator[dict]:
    ai = get_ai_provider()
    collection = org_id or "personal"

    # 1. Query rewrite
    rewritten = await ai.complete(
        [{"role": "user", "content": QUERY_REWRITE_PROMPT.format(question=question)}]
    )
    rewritten = rewritten.strip()

    # 2. Embed (NIM, query type)
    query_vec = (await nim.embed([rewritten], input_type="query"))[0]

    # 3. Qdrant search (filter by group_id)
    hits = await vector_store.search(
        collection=collection,
        group_id=group_id,
        query_vector=query_vec,
        top_k=10,
        score_threshold=0.35,
    )

    if not hits:
        yield {"type": "no_context"}
        return

    # 4. Rerank (NIM)
    passages = [h["text"] for h in hits]
    rankings = await nim.rerank(rewritten, passages, top_n=5)
    ranked_hits = [hits[r["index"]] for r in rankings]

    # 5. Build context string
    context_parts = []
    sources: list[RAGSource] = []
    for h in ranked_hits:
        context_parts.append(
            f"[{h['doc_name']} p.{h['page']}]\n{h['text']}"
        )
        sources.append(RAGSource(doc_name=h["doc_name"], page=h["page"], doc_id=h["doc_id"]))

    context = "\n\n---\n\n".join(context_parts)
    system = SYSTEM_PROMPT.format(context=context, no_context=NO_CONTEXT_REPLY)

    # 6. Stream via Bedrock DeepSeek
    async for chunk in ai.complete(
        [{"role": "user", "content": question}],
        system=system,
        stream=True,
    ):
        yield {"type": "chunk", "text": chunk}

    yield {
        "type": "done",
        "sources": [{"doc_name": s.doc_name, "page": s.page, "doc_id": s.doc_id} for s in sources],
    }
```

### SSE endpoint (`app/api/v1/chat.py`)

```python
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_sse_user
from app.services.rag_service import stream_answer
import json

router = APIRouter(prefix="/groups/{group_id}/chat", tags=["chat"])

@router.get("/stream")
async def chat_stream(
    request: Request,
    group_id: str,
    q: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_sse_user),   # validates ?token= with scope="sse"
):
    # Resolve org from group
    from app.models.group import Group
    from sqlalchemy import select
    result = await db.execute(select(Group.org_id).where(Group.id == group_id))
    org_id = result.scalar_one_or_none()

    async def event_generator():
        async for event in stream_answer(q, group_id, org_id, db):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

**COMMIT: "feat: RAG pipeline — NIM embed/rerank, DeepSeek streaming, SSE"**

---

## SECTION 9 — FILE PROCESSING CELERY TASK

### `app/tasks/file_tasks.py`

```python
import asyncio, tempfile, os
from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.document import Document
from app.services.storage_service import storage
from app.services.file_processor import extract_text, semantic_chunk
from app.services.nim_service import embed_batched
from app.services.vector_store import vector_store
from qdrant_client.models import PointStruct
from sqlalchemy import select, update
import uuid, logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, queue="files", max_retries=3, default_retry_delay=60)
def process_document(self, doc_id: str):
    asyncio.run(_process_document_async(doc_id))

async def _process_document_async(doc_id: str):
    async with SessionLocal() as db:
        try:
            # 1. Load doc, set status=processing
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one()
            doc.status = "processing"
            await db.commit()

            # 2. Download from R2
            with tempfile.NamedTemporaryFile(suffix=f".{doc.file_type}", delete=False) as f:
                tmp_path = f.name
            await storage.download(doc.r2_key, tmp_path)

            # 3. Extract text
            pages = extract_text(tmp_path, doc.file_type)

            # 4. Semantic chunk
            chunks = semantic_chunk(pages)  # returns list of {text, page, chunk_index}

            # 5. Embed (batches of 32, passage type)
            texts = [c["text"] for c in chunks]
            vectors = await embed_batched(texts, input_type="passage")

            # 6. Upsert to Qdrant
            from app.models.group import Group
            grp = await db.get(Group, doc.group_id)
            collection = grp.org_id or "personal"
            await vector_store.ensure_collection(collection)

            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vectors[i],
                    payload={
                        "group_id": doc.group_id,
                        "doc_id": doc.id,
                        "doc_name": doc.name,
                        "page": chunks[i]["page"],
                        "chunk_index": chunks[i]["chunk_index"],
                        "text": chunks[i]["text"],
                    },
                )
                for i in range(len(chunks))
            ]
            await vector_store.upsert(collection, points)

            # 7. Update document record
            doc.status = "indexed"
            doc.chunk_count = len(chunks)
            doc.page_count = max((c["page"] for c in chunks), default=0)
            doc.indexed_at = datetime.now(timezone.utc)
            await db.commit()

        except Exception as exc:
            async with SessionLocal() as err_db:
                await err_db.execute(
                    update(Document)
                    .where(Document.id == doc_id)
                    .values(status="error", error_message=str(exc)[:500])
                )
                await err_db.commit()
            raise process_document.retry(exc=exc)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
```

### `app/services/file_processor.py`

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")
CHUNK_SIZE = 500   # tokens
OVERLAP = 50       # tokens

def extract_text(path: str, file_type: str) -> list[dict]:
    """Returns [{page: int, text: str}]"""
    if file_type == "pdf":
        import fitz
        doc = fitz.open(path)
        return [{"page": i+1, "text": page.get_text()} for i, page in enumerate(doc)]
    elif file_type == "docx":
        from docx import Document as DocxDoc
        doc = DocxDoc(path)
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return [{"page": 1, "text": text}]
    elif file_type == "pptx":
        from pptx import Presentation
        prs = Presentation(path)
        slides = []
        for i, slide in enumerate(prs.slides):
            texts = [shape.text for shape in slide.shapes if hasattr(shape, "text")]
            slides.append({"page": i+1, "text": "\n".join(texts)})
        return slides
    elif file_type == "txt":
        return [{"page": 1, "text": open(path, encoding="utf-8").read()}]
    raise ValueError(f"Type non supporté: {file_type}")

def semantic_chunk(pages: list[dict]) -> list[dict]:
    chunks = []
    chunk_index = 0
    for page_data in pages:
        tokens = enc.encode(page_data["text"])
        for start in range(0, len(tokens), CHUNK_SIZE - OVERLAP):
            token_slice = tokens[start:start + CHUNK_SIZE]
            if not token_slice:
                continue
            text = enc.decode(token_slice)
            chunks.append({
                "text": text,
                "page": page_data["page"],
                "chunk_index": chunk_index,
            })
            chunk_index += 1
    return chunks
```

**COMMIT: "feat: file processing pipeline — extract, chunk, embed, index"**

---

## SECTION 10 — EXAM GENERATION + GRADING

### `app/services/exam_service.py`

Exam generation prompt:
```python
EXAM_PROMPT = """Tu es un professeur expert en {subject} pour le niveau {level} (programme marocain).
Génère exactement {count} questions d'examen en {lang} basées UNIQUEMENT sur le contexte fourni.
Difficulté globale : {difficulty}
Types de questions : {types}
Le total des points doit être 20.
Format réel du Bac/CNC marocain (Exercice 1, Exercice 2...).

CONTEXTE DOCUMENTAIRE:
{context}

RÈGLES:
- Chaque question provient directement du contexte
- QCM: 4 options, une seule correcte
- JSON UNIQUEMENT, sans texte hors JSON

FORMAT:
{{"questions":[{{"type":"mcq_single|true_false|fill_blank|short_answer|essay|calculation",
"question_text":"...","options":["A...","B...","C...","D..."]|null,
"correct_answer":"...","explanation":"...","points":float,
"source_page":int|null,"order_index":int}}]}}"""
```

Implementation:
1. Retrieve chunks for the group (or filtered to `file_ids`).
2. Truncate context to ~3000 tokens (tiktoken count).
3. Call `ai.complete(messages, temperature=0.7, max_tokens=4096)`.
4. `json.loads(response)` — if `JSONDecodeError`, retry once with:
   `"Le JSON que tu as généré est invalide. Retourne UNIQUEMENT le JSON corrigé."`
5. Validate each question has `question_text`, `points`, `order_index`.
6. Bulk insert to `exam_questions`.
7. Update `exam.status = "ready"`.

### `app/tasks/exam_tasks.py`

```python
@celery_app.task(bind=True, queue="files")
def grade_open_answers(self, session_id: str):
    asyncio.run(_grade_async(session_id))

GRADE_PROMPT = """Corrige cette réponse d'étudiant.
Question: {question}
Réponse attendue: {expected}
Réponse étudiant: {student_answer}
Points max: {points}

Réponds en JSON: {{"points_earned": float, "feedback": "...", "is_correct": bool}}"""

async def _grade_async(session_id: str):
    async with SessionLocal() as db:
        session = await db.get(ExamSession, session_id)
        session.grading_status = "grading"
        await db.commit()

        exam = await db.get(Exam, session.exam_id)
        questions = (await db.execute(
            select(ExamQuestion).where(ExamQuestion.exam_id == exam.id)
        )).scalars().all()

        ai = get_ai_provider()
        corrections = {}
        total_earned = 0.0
        total_max = 0.0
        open_types = {"short_answer", "essay", "calculation"}

        for q in questions:
            student_ans = session.answers.get(q.id, "")
            if q.question_type in open_types:
                resp = await ai.complete([{"role": "user", "content": GRADE_PROMPT.format(
                    question=q.question_text,
                    expected=q.correct_answer or "",
                    student_answer=student_ans,
                    points=q.points,
                )}])
                result = json.loads(resp)
            else:
                is_correct = student_ans.strip().lower() == (q.correct_answer or "").strip().lower()
                result = {
                    "points_earned": q.points if is_correct else 0.0,
                    "feedback": None,
                    "is_correct": is_correct,
                }
            corrections[q.id] = result
            total_earned += result["points_earned"]
            total_max += q.points

        session.corrections = corrections
        session.score_over_20 = round((total_earned / total_max) * 20, 2) if total_max > 0 else 0
        session.grading_status = "done"
        await db.commit()

        # Trigger result notification
        from app.jobs.notification_jobs import send_exam_result_job
        # enqueue ARQ job
```

**COMMIT: "feat: exam generation + AI grading celery tasks"**

---

## SECTION 11 — SM-2 FLASHCARD ALGORITHM

### `app/services/flashcard_service.py`

```python
from datetime import datetime, timedelta, timezone

QUALITY_MAP = {"got_it": 5, "almost": 3, "missed": 1}

def sm2_update(review, result: str):
    """
    Mutates review (FlashcardReview ORM object) in-place.
    result: "got_it" | "almost" | "missed"
    """
    q = QUALITY_MAP[result]

    if q < 3:
        review.repetitions = 0
        review.interval_days = 1
    else:
        if review.repetitions == 0:
            review.interval_days = 1
        elif review.repetitions == 1:
            review.interval_days = 6
        else:
            review.interval_days = round(review.interval_days * review.ease_factor)
        review.repetitions += 1

    review.ease_factor = max(
        1.3,
        review.ease_factor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02),
    )
    review.next_review_at = datetime.now(timezone.utc) + timedelta(days=review.interval_days)
    review.result = result
    review.reviewed_at = datetime.now(timezone.utc)
    return review
```

`GET /flashcards/due`: `WHERE next_review_at <= now() ORDER BY next_review_at ASC LIMIT 20`

On first review (no existing row): INSERT with `next_review_at = now()`, `ease_factor=2.5`,
`interval_days=1`, `repetitions=0`, then immediately call `sm2_update`.

**COMMIT: "feat: SM-2 spaced repetition algorithm"**

---

## SECTION 12 — ARQ NOTIFICATION JOBS

### `app/jobs/arq_app.py`

```python
from arq import create_pool
from arq.connections import RedisSettings
from app.core.config import settings

def get_redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.REDIS_URL)

class WorkerSettings:
    functions = [
        "app.jobs.notification_jobs.send_exam_result_job",
        "app.jobs.notification_jobs.send_daily_flashcard_reminders",
        "app.jobs.notification_jobs.send_exam_countdown",
        "app.jobs.status_jobs.update_document_status",
    ]
    redis_settings = get_redis_settings()
    cron_jobs = [
        # daily flashcard reminders 08:00 Morocco (07:00 UTC)
        # exam countdown check hourly
    ]
    on_startup = startup
    on_shutdown = shutdown
```

### `app/jobs/notification_jobs.py`

```python
async def send_exam_result_job(ctx, session_id: str):
    """
    Called by exam_tasks.grade_open_answers after grading.
    Fetches session, student, exam. Sends WhatsApp + email.
    """
    async with SessionLocal() as db:
        session = await db.get(ExamSession, session_id)
        student = await db.get(User, session.student_id)
        exam = await db.get(Exam, session.exam_id)
        if student.whatsapp_opted_in and student.phone:
            await notif.send_whatsapp(
                to=f"whatsapp:{student.phone}",
                template="exam_result",
                params={"score": session.score_over_20, "title": exam.title},
            )

async def send_daily_flashcard_reminders(ctx):
    """07:00 UTC cron. Finds users with due cards + whatsapp_opted_in."""
    ...

async def send_exam_countdown(ctx):
    """Hourly cron. Finds exams with deadline in 3 days or 1 day."""
    ...
```

### `app/services/notification_service.py`

```python
from twilio.rest import Client as TwilioClient
import sendgrid
from app.core.config import settings

WHATSAPP_TEMPLATES = {
    "daily_review": "{name}, tu as {count} flashcards à réviser aujourd'hui 📚",
    "exam_reminder": "Rappel : '{title}' dans {days} jours 🎯",
    "exam_result": "Ton résultat pour '{title}' : {score}/20 🎓",
    "streak_reminder": "Ne casse pas ta série de {n} jours ! Étudie aujourd'hui 🔥",
}

class NotificationService:
    def __init__(self):
        self._twilio = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    async def send_whatsapp(self, to: str, template: str, params: dict) -> None:
        body = WHATSAPP_TEMPLATES[template].format(**params)
        self._twilio.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to,
            body=body,
        )

    async def send_email(self, to: str, template_id: str, data: dict) -> None:
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = sendgrid.Mail(
            from_email=settings.SENDGRID_FROM,
            to_emails=to,
        )
        message.template_id = template_id
        message.dynamic_template_data = data
        sg.send(message)

notif = NotificationService()
```

**COMMIT: "feat: ARQ jobs + notification service (WhatsApp + email)"**

---

## SECTION 13 — BILLING

### `app/services/billing_service.py`

```python
import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

STRIPE_PRICES = {
    "teacher_solo": settings.STRIPE_PRICE_TEACHER_SOLO,
    "school_starter": settings.STRIPE_PRICE_SCHOOL_STARTER,
    "school_pro": settings.STRIPE_PRICE_SCHOOL_PRO,
}

PLAN_PRICES_MAD = {
    "teacher_solo": 290,
    "school_starter": 1490,
    "school_pro": 2490,
}

async def create_stripe_checkout(org_id: str, slug: str, plan: str) -> str:
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": STRIPE_PRICES[plan], "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/org/{slug}/billing?success=1",
        cancel_url=f"{settings.FRONTEND_URL}/org/{slug}/billing",
        metadata={"org_id": org_id, "plan": plan},
    )
    return session.url

async def handle_stripe_webhook(payload: bytes, sig: str, db) -> None:
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    if event.type == "checkout.session.completed":
        meta = event.data.object.metadata
        await _activate_plan(db, meta["org_id"], meta["plan"], event.data.object)
    elif event.type in ("customer.subscription.deleted", "customer.subscription.updated"):
        sub = event.data.object
        await _sync_subscription(db, sub)
    elif event.type == "invoice.payment_failed":
        await _mark_past_due(db, event.data.object.subscription)
```

Manual bank transfer endpoint:
```
POST /billing/bank-transfer
Body: {plan: str}
1. Generate reference: f"SF-{now:%y%m}{random_uppercase(4)}"
2. Calculate amount from PLAN_PRICES_MAD[plan]
3. Insert ManualPaymentRequest
4. Send email with: RIB, amount in MAD, reference, instructions
5. Return {reference, amount_mad, bank_details}
```

`POST /billing/admin/confirm/{reference}` — superadmin only:
1. Find ManualPaymentRequest by reference
2. Activate subscription
3. Update request status=confirmed

**COMMIT: "feat: billing — Stripe checkout + manual bank transfer"**

---

## SECTION 14 — ANALYTICS

### `app/services/analytics_service.py`

```python
from sqlalchemy import text
from datetime import datetime, timedelta, timezone

async def track_event(
    db,
    user_id: str,
    event_type: str,
    org_id: str | None = None,
    group_id: str | None = None,
    resource_id: str | None = None,
    metadata: dict | None = None,
    plan: str | None = None,
) -> None:
    await db.execute(
        text("""
        INSERT INTO user_events (time,user_id,org_id,group_id,event_type,resource_id,metadata,plan)
        VALUES (:time,:user_id,:org_id,:group_id,:event_type,:resource_id,:metadata::jsonb,:plan)
        """),
        {
            "time": datetime.now(timezone.utc),
            "user_id": user_id,
            "org_id": org_id,
            "group_id": group_id,
            "event_type": event_type,
            "resource_id": resource_id,
            "metadata": json.dumps(metadata or {}),
            "plan": plan,
        },
    )

async def get_org_kpis(db, org_id: str, days: int = 30) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(text("""
        SELECT
            COUNT(DISTINCT user_id) FILTER (WHERE time > NOW() - INTERVAL '1 day') AS dau,
            COUNT(DISTINCT user_id) AS mau,
            COUNT(*) FILTER (WHERE event_type='chat_message') AS chat_count,
            COUNT(*) FILTER (WHERE event_type='exam_submit') AS exams_taken
        FROM user_events
        WHERE org_id = :org_id AND time > :since
    """), {"org_id": org_id, "since": since})
    return dict(result.mappings().one())

async def get_dau_trend(db, org_id: str, days: int = 30) -> list[dict]:
    result = await db.execute(text("""
        SELECT
            time_bucket('1 day', time) AS bucket,
            COUNT(DISTINCT user_id) AS dau
        FROM user_events
        WHERE org_id = :org_id AND time > NOW() - :days * INTERVAL '1 day'
        GROUP BY bucket ORDER BY bucket
    """), {"org_id": org_id, "days": days})
    return [{"date": str(r.bucket.date()), "dau": r.dau} for r in result]

async def get_at_risk_students(db, org_id: str) -> list[dict]:
    """Students with 0 events in last 14 days, enrolled in org."""
    result = await db.execute(text("""
        SELECT u.id, u.name, u.email, MAX(e.time) AS last_active
        FROM users u
        JOIN memberships m ON m.user_id = u.id AND m.org_id = :org_id AND m.role = 'student'
        LEFT JOIN user_events e ON e.user_id = u.id AND e.time > NOW() - INTERVAL '14 days'
        GROUP BY u.id, u.name, u.email
        HAVING MAX(e.time) IS NULL OR MAX(e.time) < NOW() - INTERVAL '14 days'
        ORDER BY last_active ASC NULLS FIRST
        LIMIT 50
    """), {"org_id": org_id})
    return [dict(r._mapping) for r in result]
```

**COMMIT: "feat: analytics — TimescaleDB KPI queries, event tracking"**

---

## SECTION 15 — ALL API ENDPOINTS

### Auth (`/api/v1/auth`)

```
POST /api/v1/auth/session     → UserContext (for client hydration)
POST /api/v1/auth/sse-token   → {token: str}  # 60s, scope="sse"
GET  /api/v1/auth/me          → UserProfile
PATCH /api/v1/auth/me         → Update name/phone/preferred_lang/whatsapp_opted_in
```

SSE token generation:
```python
import jwt, time
token = jwt.encode(
    {"sub": ctx.user.id, "exp": int(time.time()) + 60, "scope": "sse"},
    settings.BETTER_AUTH_SECRET, algorithm="HS256"
)
```

### Groups (`/api/v1/groups`)

```
GET    /                              → My groups (owned + member)
POST   /                             [limit: max_groups] [track: group_create]
GET    /{group_id}                   → Group detail
PATCH  /{group_id}                   [require: group teacher+]
DELETE /{group_id}                   [require: owner] → purge Qdrant collection namespace
GET    /{group_id}/members
POST   /{group_id}/members/invite    [require: group teacher+] [track: invite_sent]
DELETE /{group_id}/members/{uid}     [require: group teacher+]
POST   /{group_id}/join              → public groups only [track: group_join]
```

On group creation: `vector_namespace = f"{org_id or 'personal'}:{new_group_id}"`. Call
`vector_store.ensure_collection(org_id or "personal")`.

### Documents (`/api/v1/groups/{group_id}/documents`)

```
GET    /                  → list (with status)
POST   /upload            [limit: max_files_per_group] multipart → R2 → process_document.delay()
DELETE /{doc_id}          [require: teacher+] → delete R2 + Qdrant + DB
GET    /{doc_id}/url      → presigned R2 URL (900s expiry)
```

Upload validation: MIME must be pdf/docx/pptx/txt only. File size limit from storage_gb plan limit.

### Chat

```
GET  /groups/{group_id}/chat/history   paginated, cursor-based
POST /groups/{group_id}/chat           non-streaming [track: chat_message] [limit: max_chat_per_day]
GET  /groups/{group_id}/chat/stream    SSE via ?token= [track: chat_message]
DELETE /groups/{group_id}/chat/history [require: teacher+]
```

### Exams

```
GET    /groups/{group_id}/exams
POST   /groups/{group_id}/exams/generate   [require: teacher+] [limit: max_exams_per_month]
                                           [track: exam_generate]
GET    /groups/{group_id}/exams/{exam_id}  → strip correct_answer if not submitted
PATCH  /groups/{group_id}/exams/{exam_id}  [require: teacher+]
DELETE /groups/{group_id}/exams/{exam_id}  [require: teacher+]
POST   /groups/{group_id}/exams/{exam_id}/sessions              [track: exam_start]
GET    /groups/{group_id}/exams/{exam_id}/sessions/{sid}
PUT    /groups/{group_id}/exams/{exam_id}/sessions/{sid}        autosave
POST   /groups/{group_id}/exams/{exam_id}/sessions/{sid}/submit [track: exam_submit]
                                                                → enqueue grade_open_answers
GET    /groups/{group_id}/exams/{exam_id}/analytics             [require: teacher+]
```

### Flashcards

```
GET    /groups/{group_id}/flashcards/sets
POST   /groups/{group_id}/flashcards/sets/generate  [require: teacher+] [track: flashcard_generate]
GET    /groups/{group_id}/flashcards/sets/{set_id}
DELETE /groups/{group_id}/flashcards/sets/{set_id}  [require: teacher+]
GET    /groups/{group_id}/flashcards/due             student's due cards today
POST   /groups/{group_id}/flashcards/{card_id}/review [track: flashcard_review]
```

### Learning Paths

```
GET  /groups/{group_id}/learning-paths       my path
POST /groups/{group_id}/learning-paths/generate
PATCH /groups/{group_id}/learning-paths/steps/{step_id}
```

### Slides

```
GET    /groups/{group_id}/slides
POST   /groups/{group_id}/slides/generate   [require: teacher+] [limit: can_generate_slides]
                                            [track: slide_generate]
GET    /groups/{group_id}/slides/{deck_id}
DELETE /groups/{group_id}/slides/{deck_id}  [require: teacher+]
```

### Organizations

```
GET    /org
POST   /org
GET    /org/{slug}
PATCH  /org/{slug}                      [require org: admin]
GET    /org/{slug}/members              [require org: teacher+]
POST   /org/{slug}/members/invite       [require org: admin] [limit: max_students]
PATCH  /org/{slug}/members/{uid}/role   [require org: admin]
DELETE /org/{slug}/members/{uid}        [require org: admin]
GET    /org/{slug}/kpis/overview        [require org: teacher+]
GET    /org/{slug}/kpis/at-risk         [require org: teacher+]
GET    /org/{slug}/kpis/dau-trend       [require org: teacher+]
```

### Billing

```
GET    /billing/plans
POST   /billing/checkout/stripe
POST   /billing/checkout/bank-transfer
GET    /billing/subscription
POST   /billing/webhook/stripe          no auth — verify Stripe signature
POST   /billing/admin/confirm/{ref}     [require: superadmin]
```

### Analytics

```
GET /analytics/me
GET /analytics/me/streak
GET /analytics/org/{slug}/overview      [require org: admin]
GET /analytics/org/{slug}/students/{uid} [require org: teacher+]
```

### Admin (all require `is_superadmin=True`)

```
GET  /admin/orgs
GET  /admin/orgs/{id}
POST /admin/orgs/{id}/plan
GET  /admin/users
GET  /admin/stats
```

**COMMIT: "feat: all API endpoints wired"**

---

## SECTION 16 — FRONTEND

### 16.1 Tailwind config

```typescript
// tailwind.config.ts
colors: {
  background: "#0a0e1a",
  surface: "#111827",
  "surface-2": "#1a2235",
  border: "#1e2d45",
  accent: "#f59e0b",
  "accent-hover": "#d97706",
  primary: "#f1f5f9",
  muted: "#64748b",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
},
fontFamily: {
  syne: ["var(--font-syne)", "sans-serif"],
  sans: ["var(--font-dm-sans)", "sans-serif"],
},
```

### 16.2 `lib/api.ts`

```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

let orgSlug: string | null = null;
export function setOrgSlug(slug: string | null) { orgSlug = slug; }

api.interceptors.request.use((config) => {
  if (orgSlug) config.headers["X-Org-Slug"] = orgSlug;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error.response?.status;
    if (status === 401) window.location.href = "/sign-in";
    if (status === 429) {
      const detail = error.response.data?.detail;
      // Show upgrade toast with detail.upgrade_url
      toast.error(`Limite atteinte. Passez au plan supérieur.`, {
        action: detail?.upgrade_url ? { label: "Mettre à niveau", onClick: () => window.location.href = detail.upgrade_url } : undefined,
      });
    }
    return Promise.reject(error);
  }
);
```

### 16.3 `lib/auth.ts`

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL!,
});

export const { signIn, signOut, signUp, useSession } = authClient;
```

### 16.4 `middleware.ts`

```typescript
import { betterAuthMiddleware } from "better-auth/next";

export default betterAuthMiddleware({
  publicRoutes: ["/sign-in", "/sign-up", "/verify"],
  redirectTo: "/sign-in",
});

export const config = { matcher: ["/((?!_next|favicon|api/auth).*)"] };
```

### 16.5 Streaming chat hook `lib/hooks/use-chat.ts`

```typescript
export function useStreamingChat(groupId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (question: string) => {
    setIsStreaming(true);
    // Optimistic user message
    setMessages(prev => [...prev, { role: "user", content: question }]);

    // Get short-lived SSE token
    const { token } = await api.post<{token: string}>("/api/v1/auth/sse-token").then(r => r.data);

    const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/groups/${groupId}/chat/stream`);
    url.searchParams.set("q", question);
    url.searchParams.set("token", token);

    const response = await fetch(url.toString(), { credentials: "include" });
    if (!response.ok) throw new Error("Erreur de connexion");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    let sources: Source[] = [];

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: "assistant", content: "", sources: [] }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6)) as SSEEvent;
        if (event.type === "chunk") {
          assistantText += event.text;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantText, sources };
            return updated;
          });
        } else if (event.type === "done") {
          sources = event.sources ?? [];
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantText, sources };
            return updated;
          });
        } else if (event.type === "no_context") {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: "", sources: [], noContext: true };
            return updated;
          });
        }
      }
    }
    setIsStreaming(false);
  }, [groupId]);

  return { messages, sendMessage, isStreaming };
}
```

### 16.6 Other hooks pattern

Every hook follows this shape:

```typescript
// use-groups.ts
export function useGroups() {
  return useQuery({ queryKey: ["groups"], queryFn: () => api.get<Group[]>("/api/v1/groups").then(r => r.data) });
}
export function useGroup(id: string) {
  return useQuery({ queryKey: ["groups", id], queryFn: () => api.get<Group>(`/api/v1/groups/${id}`).then(r => r.data) });
}
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupPayload) => api.post<Group>("/api/v1/groups", data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}
```

Implement the same pattern for: `use-documents`, `use-exams`, `use-flashcards`, `use-learning-paths`,
`use-slides`, `use-org`, `use-billing`, `use-analytics`.

### 16.7 Page specifications

**`/dashboard`**
- Row 1 (2-col grid): StreakWidget (flame, N-day streak, 7-bar sparkline), TodayStats (cards due,
  chat remaining, exams this month)
- Row 2 (2-col grid): ActiveGoal card with progress bar, WeakAreas (amber numbered badges)
- Row 3 (full): ContinueLearning — last 3 groups with last activity date
- Loading: 3 skeleton cards per row

**`/groups`**
- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` of GroupCard
- GroupCard: name, subject/level badge, member count, file count, "Rejoindre" or "Ouvrir"
- Top right: "Créer un groupe" button (amber)
- Empty state: dashed border, "Aucun groupe pour le moment. Créez votre premier groupe." + CTA

**`/groups/[groupId]/chat`**
- Left panel (hidden mobile): document list, click to scroll to citation
- Main: MessageBubble components. User = right-aligned amber bg. AI = left-aligned surface bg
- CitationChip: `[Doc.pdf p.4]` inline, click opens SourceDrawer (right slide-over)
- NoContext state: amber warning card "Document introuvable pour cette question"
- Input: full-width textarea (Ctrl+Enter to send), streaming indicator (animated dots)

**`/groups/[groupId]/exams/[examId]`** — full screen, hide sidebar
- Header: exam title, countdown timer (red when < 5 min), "X / Y répondu"
- Nav dots: one per question, gray=unanswered, amber=answered, current=indigo ring
- QuestionRenderer: handles 6 types (mcq_single, true_false, fill_blank, short_answer, essay,
  calculation)
- Footer: Previous, Next, Submit — Submit shows confirmation modal (not browser confirm())
- Timer hits 0: auto-submit

**`/groups/[groupId]/flashcards`**
- Card stack with CSS flip animation (rotateY 180deg)
- Front: question text, Syne font
- Back: answer + source chip
- Bottom row: "Raté" (red), "Presque" (amber), "Compris" (green)
- Progress: "X / Y révisées", completion screen with accuracy %

**`/org/[slug]/billing`**
- Plan table: 4 columns (free, teacher_solo, school_starter, school_pro)
- MAD pricing prominent, USD in small text
- Current plan highlighted with amber border
- "Payer par carte" → Stripe checkout
- "Virement bancaire" → BankTransferModal with RIB, amount MAD, reference
- Payment status tracker: pending → confirmed → active

**COMMIT: "feat: frontend — all pages, hooks, streaming chat"**

---

## SECTION 17 — DOCKER COMPOSE

```yaml
version: "3.9"
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment: {POSTGRES_USER: studyforge, POSTGRES_PASSWORD: password, POSTGRES_DB: studyforge}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U studyforge"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck: {test: ["CMD","redis-cli","ping"], interval: 5s}

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]
    volumes: ["qdrant_data:/qdrant/storage"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment: {MINIO_ROOT_USER: studyforge, MINIO_ROOT_PASSWORD: password123}
    ports: ["9000:9000","9001:9001"]
    volumes: ["minio_data:/data"]

  api:
    build: {context: ./apps/api, dockerfile: Dockerfile}
    ports: ["8000:8000"]
    env_file: ./apps/api/.env
    depends_on:
      postgres: {condition: service_healthy}
      redis: {condition: service_healthy}
      qdrant: {condition: service_started}
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    volumes: ["./apps/api:/app"]

  celery_worker:
    build: {context: ./apps/api, dockerfile: Dockerfile}
    env_file: ./apps/api/.env
    depends_on: [api]
    command: celery -A app.tasks.celery_app worker --loglevel=info -Q files,slides,analytics -c 4

  arq_worker:
    build: {context: ./apps/api, dockerfile: Dockerfile}
    env_file: ./apps/api/.env
    depends_on: [api]
    command: python -m arq app.jobs.arq_app.WorkerSettings

  web:
    build: {context: ./apps/web, dockerfile: Dockerfile}
    ports: ["3000:3000"]
    env_file: ./apps/web/.env
    volumes: ["./apps/web:/app","arq_modules:/app/node_modules","next_cache:/app/.next"]
    command: npm run dev

volumes:
  pgdata:
  qdrant_data:
  minio_data:
  arq_modules:
  next_cache:
```

`apps/api/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgomp1 curl && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install -e ".[dev]"
COPY . .
```

`apps/web/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
```

**COMMIT: "feat: docker compose — 7 services with healthchecks"**

---

## SECTION 18 — PYPROJECT.TOML

```toml
[project]
name = "studyforge-api"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.29",
    "alembic>=1.13",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "PyJWT>=2.8",
    "httpx>=0.27",
    "boto3>=1.34",          # AWS Bedrock
    "celery[redis]>=5.4",
    "arq>=0.26",
    "qdrant-client[async]>=1.9",
    "PyMuPDF>=1.24",
    "python-docx>=1.1",
    "python-pptx>=0.6",
    "tiktoken>=0.7",
    "stripe>=10.0",
    "twilio>=9.0",
    "sendgrid>=6.11",
    "python-multipart>=0.0.9",
    "redis>=5.0",
]

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-asyncio>=0.23", "ruff>=0.5", "httpx>=0.27"]

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "UP"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

NOTE: No `sentence-transformers` dependency. Reranking and embedding are fully handled by NVIDIA NIM
API calls. This eliminates the 1.1GB model download and GPU requirement for development.

**COMMIT: "chore: pyproject.toml — all deps, no sentence-transformers"**

---

## SECTION 19 — SLIDE GENERATION

### `app/services/slide_service.py`

```python
SLIDE_PROMPT = """Tu es un expert en pédagogie marocaine.
Génère {count} diapositives de cours à partir du contenu ci-dessous.
Niveau: {level}. Matière: {subject}.
Format réel des cours CPGE/ENSA/Bac marocains.

CONTENU:
{context}

FORMAT JSON UNIQUEMENT:
{{"title": "Titre du cours", "slides": [{{"order": 1, "title": "...",
"bullets": ["point 1", "point 2", "point 3"],
"notes": "Notes du présentateur...",
"layout": "default|two_col|quote"}}]}}"""
```

After generation, also export to `.pptx` using `python-pptx`:
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

def export_to_pptx(deck: dict) -> bytes:
    prs = Presentation()
    prs.slide_width = Inches(16)
    prs.slide_height = Inches(9)
    for slide_data in deck["slides"]:
        layout = prs.slide_layouts[1]  # title + content
        slide = prs.slides.add_slide(layout)
        slide.shapes.title.text = slide_data["title"]
        tf = slide.placeholders[1].text_frame
        for bullet in slide_data["bullets"]:
            p = tf.add_paragraph()
            p.text = bullet
        if slide_data.get("notes"):
            slide.notes_slide.notes_text_frame.text = slide_data["notes"]
    import io
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()
```

Store slide JSON in `slide_decks` table. Offer `.pptx` download via `GET /slides/{deck_id}/export`.

**COMMIT: "feat: slide generation + PPTX export"**

---

## SECTION 20 — LEARNING PATH GENERATION

### `app/services/learning_path_service.py`

```python
LEARNING_PATH_PROMPT = """Tu es un tuteur pédagogique pour étudiants marocains.
Génère un plan d'apprentissage personnalisé en {count} étapes pour:
Niveau: {level} | Matière: {subject}
Documents disponibles: {doc_titles}
Performance récente: {performance_summary}
(exam_score_avg: {score_avg}/20, flashcard_accuracy: {accuracy}%, weak_areas: {weak_areas})

FORMAT JSON:
{{"steps": [{{"order": 1, "title": "...", "description": "...",
"type": "read_doc|practice_flashcards|take_exam|review_weak_areas",
"resource_id": "doc_id ou null", "estimated_minutes": 20,
"is_completed": false}}]}}"""
```

Performance summary comes from `analytics_service.get_student_profile()`. Steps of type `read_doc`
reference an actual `doc_id`. Regenerating overwrites the existing path (UPSERT on group_id+student_id
unique constraint).

**COMMIT: "feat: personalized learning path generation"**

---

## SECTION 21 — FINAL CHECKLIST

Run all of these before reporting done:

```bash
# Backend
cd apps/api
ruff check .                                    # 0 errors
pytest                                          # all pass

# Frontend
cd apps/web
npx tsc --noEmit                               # 0 errors
npm run lint                                   # 0 errors

# Integration
docker compose up --build -d
docker compose exec api alembic upgrade head   # all migrations clean
curl localhost:8000/health/ready               # {"status":"ready"}
curl localhost:8000/health                     # {"status":"ok"}
```

Verify:
- [ ] `POST /api/v1/groups` returns 429 when free plan group limit (1) reached
- [ ] SSE chat stream returns chunks — no 401 with valid SSE token
- [ ] SM-2: "missed" result → interval_days=1, repetitions=0
- [ ] Stripe webhook handler returns 200 with invalid payload (catches exception)
- [ ] `user_events` table exists and TimescaleDB hypertable is set up
- [ ] NVIDIA NIM embed call works (requires valid API key)
- [ ] Qdrant collection created on first group creation
- [ ] Document upload → status=pending → processing → indexed (via Celery)
- [ ] ARQ worker picks up notification jobs
- [ ] All 18 pages have loading skeletons and empty states
- [ ] Score always displayed as X/20 with color thresholds
- [ ] No sentence-transformers import anywhere
- [ ] bank-transfer reference matches pattern `SF-YYMM[A-Z]{4}`

**COMMIT: "feat: complete StudyForge V3"**

---

## APPENDIX — ERROR CONVENTIONS

| Code | Meaning | French message |
|---|---|---|
| 400 | Bad request | Pydantic handles automatically |
| 401 | Not authenticated | "Authentification requise" |
| 403 | Wrong role | "Accès refusé" |
| 404 | Not found | "Ressource introuvable" |
| 409 | Conflict (duplicate slug) | "Ce nom est déjà utilisé" |
| 422 | File type not supported | "Type de fichier non supporté" |
| 429 | Plan limit | `{code, limit, current, max, upgrade_url}` |
| 500 | Server error | "Une erreur interne est survenue" — log full traceback |

Frontend catches all via Axios interceptor. 429 shows amber toast with upgrade link.
Never expose raw Python exceptions to the client.

## APPENDIX — MOROCCAN CONTEXT

Level selector values: `["Bac", "CPGE-MP", "CPGE-PC", "CPGE-TSI", "CPGE-ECT",
"ENSA", "ENSIAS", "EMSI", "ENCG", "Licence", "Master", "Autre"]`

Subject selector values (French): `["Mathématiques", "Physique-Chimie", "SVT", "Français",
"Arabe", "Philosophie", "Histoire-Géographie", "Économie", "Informatique", "Anglais",
"Génie Civil", "Électronique", "Thermodynamique", "Analyse", "Algèbre", "Mécanique"]`

Bac countdown widget (dashboard): `Math.ceil((BAC_DATE - now) / 86400000)` — BAC_DATE = June 1st
of current academic year.
