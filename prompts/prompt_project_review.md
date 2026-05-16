# StudyForge — Full Project Review

## Your role
You are a senior engineer doing a complete technical review of this codebase.
Read everything first. Write nothing until the full read is done.
Produce one comprehensive report. Be direct and specific — no vague praise,
no generic advice. Every finding must name the exact file and line.

---

## Step 1 — Read the entire codebase

Run every command below. Do not skip any.

```bash
# Project structure
find . -type f | grep -v node_modules | grep -v __pycache__ | grep -v .git | grep -v .venv | grep -v .next | sort

# Backend
cat apps/api/app/main.py
cat apps/api/app/core/security.py
cat apps/api/app/core/permissions.py
cat apps/api/app/core/database.py
cat apps/api/alembic/env.py
ls apps/api/alembic/versions/
cat apps/api/requirements.txt
cat apps/api/app/models/user.py
cat apps/api/app/models/exam.py
cat apps/api/app/models/flashcard.py
cat apps/api/app/models/group.py
cat apps/api/app/models/organization.py
cat apps/api/app/models/cohort.py
cat apps/api/app/models/assignment.py
cat apps/api/app/models/goal.py
cat apps/api/app/models/permissions.py
find apps/api/app/models -name "*.py" | sort
find apps/api/app/api/v1 -name "*.py" | sort
cat apps/api/app/api/v1/exams.py
cat apps/api/app/api/v1/groups.py
cat apps/api/app/api/v1/files.py
cat apps/api/app/api/v1/chat.py
cat apps/api/app/api/v1/me.py
cat apps/api/app/services/ai_service.py
cat apps/api/app/services/rag_service.py
cat apps/api/app/services/exam_service.py
cat apps/api/app/services/flashcard_service.py
cat apps/api/app/services/slide_service.py
cat apps/api/app/services/learning_path_service.py
cat apps/api/app/services/file_processor.py
cat apps/api/app/services/grading_service.py
cat apps/api/app/services/curriculum_service.py
cat apps/api/app/services/analytics_service.py
cat apps/api/app/services/vector_store.py
cat apps/api/app/services/reranker.py
cat apps/api/app/services/storage_service.py
cat apps/api/app/services/notification_service.py
find apps/api/app/tasks -name "*.py" | sort
find apps/api/app/jobs -name "*.py" | sort
cat docker-compose.yml
cat apps/api/Dockerfile

# Frontend
cat apps/web/app/\(app\)/layout.tsx
cat apps/web/app/\(app\)/dashboard/page.tsx
find apps/web/app -name "page.tsx" | sort
find apps/web/lib/hooks -name "*.ts" | sort
cat apps/web/lib/api.ts
cat apps/web/package.json
cat apps/api/app/core/config.py 2>/dev/null || cat apps/api/app/core/settings.py 2>/dev/null
find . -name ".env.example" -o -name ".env.sample" | head -5

# Git history
git log --oneline -20
git branch -a
```

---

## Step 2 — Produce the review report

Write `audit/full_project_review.md` with every section below.
Do not summarise — be specific. If something is good, say why specifically.
If something is a problem, name the file, line, and exact fix needed.

---

### Section 1 — Project map

A complete inventory of what exists:

```
Backend:
  Models: [list all, with table names]
  Routes: [list all endpoints with method + path]
  Services: [list all service files]
  Celery tasks: [list all tasks + queues]
  Alembic migrations: [list all, in order]

Frontend:
  Route groups: [list]
  Pages: [list all page.tsx paths]
  Hooks: [list all hook files + what they expose]
  Components: [list shared components]

Infrastructure:
  Docker services: [list all with ports]
  External services: [list — Clerk, Stripe, ChromaDB, MinIO, etc.]
```

---

### Section 2 — Architecture assessment

Answer each question with a specific verdict and evidence:

**Q1: Is the auth system correct and complete?**
- Does every route that should require auth have `get_current_user`?
- Are there any routes missing auth guards?
- Is the RBAC system (`permissions` table + `require_permission`) used consistently?
- Are there role checks hardcoded anywhere they should use RBAC?
- Does the frontend correctly attach the Clerk JWT to every API call?

**Q2: Is the database schema sound?**
- Are there missing indexes on foreign keys or frequently-queried fields?
- Are there N+1 query risks in any route handler?
- Do all migrations chain correctly (check `down_revision` values)?
- Are there any JSONB fields that should be normalized tables?
- Are soft deletes handled consistently?

**Q3: Is the AI pipeline correct?**
- Does the RAG pipeline flow correctly: rewrite → embed → retrieve → rerank → stream?
- Is the temperature correct in every AI call? (generate_structured_json: 0.1, RAG chat: 0.25)
- Is the retry logic in `generate_structured_json` correct (3 attempts, markdown strip)?
- Is the ChromaDB collection naming correct (org-scoped vs user-scoped)?
- Does the vision path in `file_processor.py` correctly handle all PDF types?

**Q4: Is the Celery architecture correct?**
- Are there 3 queues configured (files, slides, notifications)?
- Is `celery_analytics` queue present if analytics tasks exist?
- Does every task have `max_retries`, `acks_late`, and retry logic?
- Is `process_file_task` calling `extract_text_async` (not the sync version)?

**Q5: Is the frontend complete?**
- Does every backend endpoint have a corresponding hook?
- Does every hook have a corresponding UI?
- Are there any `any` TypeScript types?
- Do all pages have `loading.tsx` siblings?
- Do all lists have empty states?

---

### Section 3 — Security audit

Check each of these and report PASS / FAIL / PARTIAL with evidence:

| Check | Status | Evidence |
|---|---|---|
| All API routes require auth (no accidental public endpoints) | | |
| File upload validates MIME type server-side | | |
| Construction photo base64 not stored in S3 (memory only) | | |
| Plan limits enforced server-side (not just frontend) | | |
| Clerk JWKS verification correct in security.py | | |
| No secrets hardcoded in source files | | |
| CORS configured correctly in main.py | | |
| SQL injection not possible (ORM used everywhere) | | |
| Clerk webhook signature verified (Svix) | | |
| Admin endpoints guarded by super_admin role | | |

---

### Section 4 — Performance risks

List any specific performance problems found:

For each problem, format as:
```
RISK: [description]
FILE: [path:line]
IMPACT: [what breaks at scale]
FIX: [specific code change]
```

Common things to check:
- Routes that do synchronous AI calls in the request/response cycle
  (should be Celery tasks)
- Routes that load all records without pagination
- Missing `select()` filters (loading whole objects when only 2 fields needed)
- Synchronous `file_processor.extract_text()` calls (should use async version)
- Any `asyncio.sleep()` in route handlers
- N+1 loops over DB records inside route handlers

---

### Section 5 — Missing features

List everything that exists in the backend but has NO frontend:
```
MISSING UI: [endpoint]
IMPACT: [what the user can't do]
PRIORITY: high / medium / low
```

List everything that has frontend UI but NO backend:
```
MISSING BACKEND: [component or page]
IMPACT: [what breaks]
PRIORITY: high / medium / low  
```

---

### Section 6 — Code quality findings

Report only real issues — not style preferences.

**Duplicate logic:** places where the same logic is written twice instead
of shared.

**Error handling gaps:** routes or service calls where exceptions are
silently swallowed (`except: pass` or `except Exception: return None`).

**Type safety gaps:** any `dict` or `Any` return type on a function that
should have a typed schema.

**Deprecated patterns:** any v4 TanStack Query syntax in v5 codebase,
any FastAPI 0.100- patterns in a 0.111 codebase.

---

### Section 7 — Data integrity risks

Things that could cause corrupt or inconsistent data:

- Exam sessions without proper state machine (can a student submit twice?)
- Flashcard progress records without upsert safety
- File status stuck in `processing` with no timeout recovery
- Soft-delete inconsistencies (is `is_deleted=True` respected in all queries?)
- Race conditions in plan limit checks (two concurrent requests both passing the limit)

---

### Section 8 — What's working well

List 5–10 specific things that are implemented correctly and why.
Be specific — reference actual files and patterns.

---

### Section 9 — Priority fix list

Rank every finding from Sections 3–7 by impact:

```
CRITICAL — fix before any user sees this:
  1. [finding]

HIGH — fix before launch:
  2. [finding]

MEDIUM — fix in next sprint:
  3. [finding]

LOW — fix when convenient:
  4. [finding]
```

---

### Section 10 — Overall verdict

Three sentences maximum:
1. What is this project's current state in one honest sentence.
2. What is the single biggest risk.
3. What should be done first.

---

## Rules

- Every claim must cite a file. No vague statements.
- If you cannot find evidence for a check, say "Could not verify — [reason]"
  rather than guessing.
- Do not repeat findings across sections.
- The report must be written to `audit/full_project_review.md`.
- After writing the report, print the Section 9 priority list to the terminal
  so it's immediately visible.
