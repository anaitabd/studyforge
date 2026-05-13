# StudyForge — Claude Code Implementation Prompt

## Your role
You are implementing a major feature expansion on an existing production codebase. Read every existing file in the relevant directories before writing any new code. Follow existing patterns — naming conventions, file structure, error handling, and response shapes — precisely. Do not refactor existing code unless explicitly told to. Commit-ready output only.

---

## Codebase overview

Full-stack EdTech platform:
- **Backend**: FastAPI 0.111, SQLAlchemy 2 async, Alembic, Pydantic v2, Python 3.11, Celery (3 queues: files/slides/notifications), ChromaDB HTTP, MinIO/S3
- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind CSS, TanStack Query v5, Clerk auth, Recharts, Lucide icons
- **Auth**: Clerk JWT verified via JWKS, auto-provisions `users` row, role stored in `users.role`
- **AI**: OpenAI-compat provider facade in `ai_service.py` (also supports NVIDIA + Bedrock), embeddings via amazon.titan-embed-text-v2

Existing DB has 16 tables. Existing API has 14 route files under `/api/v1/`. Read them all before starting.

---

## What you are building

Expand StudyForge from a single-surface product into two distinct surfaces:

1. **Individual tier** — personal learner dashboard with goals, streaks, and self-serve KPIs
2. **Organization tier** — multi-tenant B2B surface with org admin, teacher, and student roles; cohort management; assignments; live monitoring; and a full KPI/analytics engine

### Architecture decisions already made — do not deviate from these:

**A. Single RBAC table replaces multiple role systems**
Do not add a third role field to `users`. Instead create a `permissions` table:
```sql
permissions(id, actor_id, resource_type, resource_id, role, granted_by, created_at)
```
`resource_type` values: `org | cohort | group`. All access guards go through a single `require_permission(resource_type, resource_id, min_role)` dependency. Keep existing `users.role` for platform-level guards (super_admin) only.

**B. TimescaleDB for analytics events — not OLTP aggregation**
Install the TimescaleDB extension on the existing PostgreSQL instance (zero infra change). Create a `user_events` hypertable:
```sql
user_events(time TIMESTAMPTZ, user_id UUID, org_id UUID, event_type TEXT, resource_type TEXT, resource_id UUID, metadata JSONB)
```
Create a `track_event(user_id, org_id, event_type, resource_type, resource_id, metadata)` helper in `analytics_service.py`. Call it from the 8 endpoints listed below. KPI queries run against this table, not against OLTP tables.

Events to track (minimum):
- `exam.submitted` — from `PUT /exams/{id}/sessions/{id}`
- `flashcard.reviewed` — from `POST /flashcard-sets/{id}/review`
- `file.read` — from `POST /analytics/reading-event` (already exists, redirect here)
- `chat.message_sent` — from `POST /groups/{id}/chat`
- `learning_path.module_completed` — from `POST /modules/{id}/progress`
- `slide.viewed` — from `POST /slide-decks/{id}/progress`
- `exam.started` — from `POST /exams/{id}/sessions`
- `user.login` — from `POST /auth/webhook` on Clerk `session.created` event

**C. ChromaDB collections scoped to org, not group**
Refactor `vector_store.py`:
- Individual users (no org): collection name = `user_{user_id}`
- Org users: collection name = `org_{org_id}`
- Chunk metadata always includes `file_id`, `group_id`, `org_id`
- All existing `query()` calls already use `file_ids` filter — keep that, just change collection resolution logic
- Write a one-time migration script `scripts/migrate_chroma_collections.py` that re-maps existing group-scoped collections to the new scheme

**D. Frontend: separate layout trees, not shared nav with conditionals**
- Individual surface: `app/(individual)/` route group — existing dashboard stays here
- Org surface: `app/(org)/[slug]/` route group — completely separate root layout, sidebar, and auth guard
- Shared components go in `components/shared/`
- Do not add role-conditional rendering to existing individual layouts

---

## Implementation phases

Work through these phases in order. Complete and verify each phase before starting the next. After each phase, output a summary of files created/modified.

---

### Phase 1 — Foundation (do this first, everything else depends on it)

#### 1a. RBAC system

Create `apps/api/app/models/permissions.py`:
```python
class Permission(Base):
    __tablename__ = "permissions"
    id: UUID
    actor_id: UUID  # FK → users.id
    resource_type: str  # 'org' | 'cohort' | 'group'
    resource_id: UUID
    role: str  # 'admin' | 'teacher' | 'student' | 'viewer'
    granted_by: UUID  # FK → users.id
    created_at: datetime
```

Create `apps/api/app/core/permissions.py`:
- `async def get_permission(db, actor_id, resource_type, resource_id) -> Permission | None`
- `def require_permission(resource_type: str, resource_id_param: str, min_role: str)` — FastAPI Depends factory
- Role hierarchy: `admin > teacher > student > viewer`
- Raise `HTTP 403` with `{"detail": "insufficient_permission"}` on failure

Create Alembic migration for `permissions` table.

#### 1b. Analytics events (TimescaleDB)

In `apps/api/app/db/session.py`, add:
```python
# After all tables created:
# CREATE EXTENSION IF NOT EXISTS timescaledb;
# SELECT create_hypertable('user_events', 'time', if_not_exists => TRUE);
```

Create `apps/api/app/models/events.py` — `UserEvent` model (non-ORM, raw insert via `asyncpg` for performance).

Create `apps/api/app/services/analytics_service.py`:
```python
async def track_event(db, user_id, org_id, event_type, resource_type=None, resource_id=None, metadata=None)
```
This must be fire-and-forget (wrap in `asyncio.create_task`, never block the request).

Add `track_event` calls to the 8 endpoints listed above. Import and call at the end of each endpoint handler, after all DB writes succeed.

#### 1c. Organizations table

Create migration that:
- Creates `organizations` table (replaces `schools`):
  ```sql
  id UUID PK, name TEXT, slug TEXT UNIQUE, logo_url TEXT,
  industry TEXT, size_range TEXT,
  sso_config JSONB,  -- {provider, entity_id, sso_url, certificate}
  custom_domain TEXT, brand_colors JSONB,
  billing_email TEXT, stripe_customer_id TEXT,
  admin_user_id UUID FK→users, wa_number TEXT, wa_api_key TEXT,
  is_active BOOL DEFAULT true, created_at, updated_at
  ```
- Adds `org_id UUID FK→organizations` to `users`, keeping `school_id` as deprecated (do not drop yet)
- Adds `account_type TEXT DEFAULT 'individual'` to `users` — values: `individual | organization`

Create `apps/api/app/models/organization.py` and `apps/api/app/schemas/organization.py`.

---

### Phase 2 — New core tables

Create models + Pydantic schemas + Alembic migrations for all of these:

**`cohorts`**
```sql
id UUID PK, org_id UUID FK, name TEXT, description TEXT,
subject TEXT, start_date DATE, end_date DATE,
is_archived BOOL DEFAULT false, created_by UUID FK→users,
created_at, updated_at
```

**`cohort_members`**
```sql
id UUID PK, cohort_id UUID FK, user_id UUID FK,
role TEXT  -- 'teacher' | 'student'
joined_at TIMESTAMPTZ
UNIQUE(cohort_id, user_id)
```

**`assignments`**
```sql
id UUID PK, cohort_id UUID FK, creator_id UUID FK→users,
resource_type TEXT,  -- 'exam' | 'learning_path'
resource_id UUID, title TEXT,
due_at TIMESTAMPTZ, instructions TEXT,
created_at TIMESTAMPTZ
```

**`assignment_progress`**
```sql
id UUID PK, assignment_id UUID FK, user_id UUID FK,
status TEXT DEFAULT 'not_started',  -- not_started | in_progress | submitted | graded
started_at TIMESTAMPTZ, submitted_at TIMESTAMPTZ,
score FLOAT, feedback TEXT
UNIQUE(assignment_id, user_id)
```

**`study_goals`**
```sql
id UUID PK, user_id UUID FK, title TEXT,
target_date DATE, target_score FLOAT,
subject TEXT, file_ids JSONB,
status TEXT DEFAULT 'active',  -- active | achieved | abandoned
created_at, updated_at
```

**`streak_records`**
```sql
user_id UUID FK, date DATE, has_activity BOOL DEFAULT true
PRIMARY KEY(user_id, date)
```

**`kpi_cache`** (replaces the `kpi_snapshots` concept — keyed for fast lookup)
```sql
id UUID PK, scope_type TEXT,  -- 'org' | 'cohort' | 'user'
scope_id UUID, metric_key TEXT, metric_value FLOAT,
computed_at TIMESTAMPTZ, date DATE
UNIQUE(scope_type, scope_id, metric_key, date)
```

Create all Alembic migrations. Run them in order.

---

### Phase 3 — Backend: Organization API

Create `apps/api/app/api/v1/organizations.py`. Mount at `/api/v1/org`.

All routes in this file require the caller to be an org member with sufficient permission (use the RBAC system from Phase 1).

**Org management**
```
POST   /org                           — create org (any authed user, becomes admin)
GET    /org/{slug}                    — org detail (member only)
PATCH  /org/{slug}                    — update org (admin only)
```

**User management (admin only)**
```
GET    /org/{slug}/members            — list all members with roles, last_active, cohort count
POST   /org/{slug}/members/invite     — invite by email, creates Permission row on accept
POST   /org/{slug}/members/bulk-invite — accepts {emails: list[str], role: str}, sends invite emails via existing notification_service
DELETE /org/{slug}/members/{user_id}  — remove member (revoke all permissions for this org)
PATCH  /org/{slug}/members/{user_id}/role — change role
```

**Cohort management**
```
GET    /org/{slug}/cohorts            — list cohorts with member_count, assignment_count
POST   /org/{slug}/cohorts            — create cohort
GET    /org/{slug}/cohorts/{id}       — cohort detail with teacher list and student list
PATCH  /org/{slug}/cohorts/{id}       — update cohort
POST   /org/{slug}/cohorts/{id}/members — add user to cohort with role
DELETE /org/{slug}/cohorts/{id}/members/{user_id}
```

**Assignments**
```
POST   /org/{slug}/cohorts/{id}/assignments         — create assignment (teacher/admin)
GET    /org/{slug}/cohorts/{id}/assignments          — list assignments
GET    /org/{slug}/assignments/{assignment_id}/progress — per-student status grid
```

**KPI endpoints (use kpi_cache table, fall back to live query if cache miss)**
```
GET    /org/{slug}/kpis/overview      — {dau, wau, avg_exam_score, completion_rate, at_risk_count}
GET    /org/{slug}/kpis/cohorts       — per-cohort KPI summary list
GET    /org/{slug}/cohorts/{id}/kpis  — full cohort KPI breakdown
GET    /org/{slug}/kpis/at-risk       — list of at-risk students with reason flags
GET    /org/{slug}/students/{user_id}/timeline — chronological activity list from user_events
```

KPI definitions (compute from `user_events` hypertable):
- `dau`: distinct `user_id` with any event in last 24h, scoped to `org_id`
- `wau`: distinct `user_id` with any event in last 7 days
- `avg_exam_score`: avg of `metadata->>'score'` where `event_type = 'exam.submitted'` in last 30 days
- `completion_rate`: count `learning_path.module_completed` / total modules for active paths, last 30 days
- `at_risk`: user has zero events in last 7 days, OR last 2 `exam.submitted` events have `metadata->>'score'` < 0.4

---

### Phase 4 — Backend: Teacher API

Extend `apps/api/app/api/v1/teacher.py` (existing file).

```
GET    /teacher/cohorts/{id}/live     — students online now (poll room_members + latest reading_event per student, joined, last 15s)
POST   /teacher/cohorts/{id}/generate — {resource_type, config, file_ids} → runs existing generation task for each student in cohort (fan-out via Celery group)
GET    /teacher/assignments/{id}/progress — assignment_progress rows joined with user name/email
PATCH  /teacher/assignments/{assignment_id}/progress/{user_id} — set feedback + graded status
```

---

### Phase 5 — Backend: Individual KPI API

Extend `apps/api/app/api/v1/me.py` (existing file).

```
GET    /me/kpis              — personal KPI panel (all computed live from user_events + existing OLTP tables)
POST   /me/goals             — create study_goal
GET    /me/goals             — list goals with progress %
PATCH  /me/goals/{id}        — update or mark achieved
GET    /me/streak            — {current_streak, longest_streak, today_active: bool}
GET    /me/weak-areas        — AI-identified weak concepts (call generate_structured_json with last 10 wrong exam answers)
```

Personal KPI response shape:
```json
{
  "active_minutes_today": 42,
  "active_minutes_goal": 60,
  "flashcard_retention_rate": 0.74,
  "cards_due_today": 12,
  "cards_overdue": 3,
  "exam_score_trend": [{"date": "2025-05-01", "score": 0.62}, ...],
  "streak": {"current": 7, "longest": 14},
  "weak_areas": ["Gradient descent", "Transformer attention"],
  "study_goal": {"title": "AWS SAA", "target_date": "2025-08-01", "on_pace": true}
}
```

---

### Phase 6 — Celery: Analytics worker

Add a new Celery queue: `analytics`.

In `apps/api/app/tasks/analytics_tasks.py`:

```python
@celery_app.task(queue='analytics')
def compute_org_kpis(org_id: str):
    """Runs nightly. Writes to kpi_cache for all cohorts and users in org."""

@celery_app.task(queue='analytics')  
def update_streak_records():
    """Runs nightly at midnight UTC. Inserts streak_records row for every user with any event today."""

@celery_app.task(queue='analytics')
def flag_at_risk_students():
    """Runs daily. Queries user_events, writes at_risk flag to kpi_cache, sends notification to org admins."""
```

Add to Celery beat schedule:
- `compute_org_kpis`: every org, staggered, 2:00 AM UTC
- `update_streak_records`: nightly, 23:55 UTC
- `flag_at_risk_students`: daily, 6:00 AM UTC

Add `analytics` to `CELERY_QUEUES` and start a `celery_analytics` service in `docker-compose.yml` (same image as `celery_worker`, different queue arg).

---

### Phase 7 — ChromaDB refactor

Edit `apps/api/app/services/vector_store.py`:

```python
def _collection_name(org_id: str | None, user_id: str) -> str:
    if org_id:
        return f"org_{org_id}"
    return f"user_{user_id}"
```

Update `upsert_chunks()`, `query()`, and `get_all_chunks_for_files()` to resolve collection name via this function. Thread `org_id` and `user_id` through all callers (file_processor, rag_service, file routes).

Create `backend/scripts/migrate_chroma_collections.py`:
- Reads all groups from DB
- For each group: gets all chunks from `group_{group_id}` collection
- Resolves target collection (`org_{org_id}` or `user_{owner_id}`)
- Upserts chunks with updated metadata (`group_id` preserved)
- Deletes old collection after successful migration
- Idempotent: skip groups already migrated (check by metadata flag)
- Logs progress to stdout, errors to stderr

---

### Phase 8 — Frontend: Org surface

Create `app/(org)/[slug]/layout.tsx`:
- Separate root layout, completely independent from `(app)` layout
- Sidebar with: Dashboard, Cohorts, Members, Content Library, Assignments, Settings
- Shows org logo + name in sidebar header
- Role-aware nav items (admin sees all, teacher sees Cohorts + Assignments only)
- Auth guard: redirect to `/sign-in` if no session; redirect to individual dashboard if user has no org membership matching `slug`

Create these pages (each as a proper Next.js page with TanStack Query hooks):

**`app/(org)/[slug]/dashboard/page.tsx`**
- KPI cards: DAU, WAU, avg exam score, completion rate, at-risk count (with alert styling if > 0)
- Recharts LineChart for DAU over last 30 days
- At-risk student list (top 5, link to full list)
- Recent activity feed from `user_events`

**`app/(org)/[slug]/cohorts/page.tsx`**
- Table: cohort name, teacher(s), student count, avg score, completion rate, last active
- Create cohort modal

**`app/(org)/[slug]/cohorts/[cohortId]/page.tsx`**
- Tabs: Overview | Students | Assignments | Live
- Overview: cohort KPI cards + score distribution chart
- Students: table with name, last active, exam avg, flashcard retention, at-risk badge
- Assignments: list with due dates and per-assignment submission rate
- Live: auto-refreshing panel (15s) showing online students and their current activity

**`app/(org)/[slug]/students/[userId]/page.tsx`**
- Student profile header (name, email, cohort, plan)
- Activity timeline (chronological list of events with icons)
- Exam history with score chart
- Flashcard stats: retention rate, cards reviewed, overdue
- Weak areas (from `/me/weak-areas` called with teacher auth override)

**`app/(org)/[slug]/members/page.tsx`**
- Searchable member table: name, email, role, cohort count, last active, status
- Bulk invite modal (paste emails or CSV upload)
- Role change dropdown inline
- Deactivate/remove with confirmation

Create corresponding hooks in `lib/hooks/use-org.ts`, `use-cohorts.ts`, `use-assignments.ts`, `use-org-kpis.ts`.

---

### Phase 9 — Frontend: Individual KPI dashboard

Edit `app/(app)/dashboard/page.tsx` (existing file):
- Add personal KPI section above the existing "continue learning" widget
- KPI cards: streak, active minutes today vs goal, flashcard retention, cards due
- Weak areas chip list (from `/me/weak-areas`)
- Score trend sparkline (Recharts, last 10 exam attempts)

Create `app/(app)/goals/page.tsx`:
- Goal creation form: title, subject, target date, target score, file selector
- Goal progress cards: % complete, days remaining, on-pace indicator
- Daily study plan: today's recommended flashcard count + module to complete

Create hook `lib/hooks/use-individual-kpis.ts` covering all `/me/kpis`, `/me/goals`, `/me/streak`, `/me/weak-areas` endpoints.

---

## Constraints and rules

**Never do any of these:**
- Do not modify existing Alembic migrations — only create new ones
- Do not change existing API response shapes — only add new endpoints
- Do not add conditional role checks to existing individual UI components — put them in org-specific components
- Do not use `asyncio.sleep` or blocking calls in FastAPI route handlers
- Do not hardcode org slugs, user IDs, or any environment values
- Do not skip the `track_event` call in any of the 8 specified endpoints
- Do not write `kpi_cache` rows from route handlers — only from Celery tasks

**Always do these:**
- Use existing patterns from `ai_service.py` for any new AI calls (exponential backoff, `generate_structured_json` for structured output)
- Use existing `notification_service.py` for all user-facing notifications
- Use existing `storage_service.py` for any new file operations
- Add Pydantic v2 schemas for every new model in `apps/api/app/schemas/`
- Add `__repr__` to every new SQLAlchemy model
- Every new FastAPI endpoint must have a docstring and correct response model
- Every new React page must have a `loading.tsx` sibling using the existing skeleton pattern

---

## Verification checklist

After all phases are complete, verify:

- [ ] `alembic upgrade head` runs clean from a fresh DB with no errors
- [ ] `docker-compose up` starts all 9 services (existing 8 + `celery_analytics`) without errors
- [ ] `POST /org` creates an org and a `permissions` row for the creator as admin
- [ ] `POST /org/{slug}/members/bulk-invite` with 3 emails fires 3 notification tasks
- [ ] `PUT /exams/{id}/sessions/{id}` (submit exam) creates a `user_events` row with `event_type = 'exam.submitted'`
- [ ] `GET /org/{slug}/kpis/overview` returns valid JSON with all 5 fields
- [ ] `GET /me/kpis` returns valid JSON with all fields in the specified shape
- [ ] `scripts/migrate_chroma_collections.py` runs idempotently (second run is a no-op)
- [ ] Org dashboard page loads without console errors when no events exist yet (empty state)
- [ ] Individual dashboard shows streak card and KPI section with real data

---

## Starting point

Before writing any code:

1. `find . -name "*.py" | head -60` — get a full file tree
2. Read `apps/api/app/models/` — all existing models
3. Read `apps/api/app/api/v1/` — all existing route files
4. Read `apps/api/app/services/` — all existing services
5. Read `apps/api/app/core/security.py` — existing auth patterns
6. Read `docker-compose.yml` — existing service definitions
7. Read `alembic/versions/` — latest migration to understand current schema state

Only after reading all of the above, start Phase 1.