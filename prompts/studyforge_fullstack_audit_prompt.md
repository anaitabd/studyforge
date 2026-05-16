# StudyForge — Full-Stack Audit & Gap Closure Prompt

## Your role
You are a senior full-stack engineer doing a complete health check on an existing codebase. Your job is to map every backend service and endpoint, verify the frontend covers all of them correctly, find every gap, and fix each one. You do not add new features. You do not refactor for style. You only fix what is broken, missing, or misconnected.

---

## Step 0 — Read everything first (mandatory, do not skip)

Before writing a single line of code, read the entire codebase in this order:

**Backend — read all of these:**
```bash
find backend/app/api -name "*.py" | sort          # every route file
find backend/app/services -name "*.py" | sort      # every service
find backend/app/models -name "*.py" | sort        # every model
find backend/app/schemas -name "*.py" | sort       # every schema
find backend/app/tasks -name "*.py" | sort         # every Celery task
cat backend/app/main.py                            # router mounts
cat backend/app/core/security.py                   # auth guards
cat docker-compose.yml                             # all services
```

**Frontend — read all of these:**
```bash
find lib/hooks -name "*.ts" | sort                 # every hook
find lib -name "api.ts"                            # axios wrapper
find app -name "page.tsx" | sort                   # every page
find app -name "layout.tsx" | sort                 # every layout
find components -name "*.tsx" | sort               # every component
```

Only after reading everything above, proceed to Step 1.

---

## Step 1 — Build the master map

Create a file `audit/master_map.md` with three sections:

### Section A — Backend inventory
For every route file, list every endpoint in this format:
```
METHOD /api/v1/path
  Auth:      [public | user | role:X | permission:X]
  Request:   {field: type, ...} or "none"
  Response:  {field: type, ...} or schema name
  Service:   which service file handles the logic
  Task:      which Celery task it enqueues (if any)
  Status:    [complete | stub | broken]
```

Mark an endpoint as `stub` if it returns hardcoded data or `{"status": "ok"}` without real logic.
Mark it as `broken` if it references a model, service, or field that doesn't exist.

### Section B — Frontend inventory
For every hook in `lib/hooks/`, list:
```
Hook: useXxx()
  Calls:     METHOD /api/v1/path
  Used in:   page or component name
  State:     [loading, error, data] handled? yes/no
  Empty:     empty state handled? yes/no
  Optimistic: optimistic update? yes/no (note if needed)
```

### Section C — Gap matrix
A table with every backend endpoint as a row:
```
| Endpoint | Has hook? | Has UI? | Error handled? | Loading handled? | Gap type |
```

Gap types:
- `NO_HOOK` — endpoint exists in backend, no hook in frontend
- `NO_UI` — hook exists, no page or component uses it
- `NO_ERROR` — hook exists, error state not handled in UI
- `NO_LOADING` — hook exists, loading state not shown in UI
- `STUB_BACKEND` — endpoint is a stub, frontend calls it but gets fake data
- `SCHEMA_MISMATCH` — frontend expects different fields than backend returns
- `WRONG_METHOD` — frontend calls wrong HTTP method
- `WRONG_URL` — frontend has a different URL than backend defines
- `AUTH_MISMATCH` — frontend doesn't send auth header, but endpoint requires it
- `OK` — fully connected and working

Do not start fixing anything until this map is complete and written to `audit/master_map.md`.

---

## Step 2 — Verify each service layer

For every file in `backend/app/services/`, verify:

1. **ai_service.py** — all three providers (OpenAI-compat, NVIDIA, Bedrock) are importable and the fallback chain works. `generate_structured_json` retry logic (3 attempts, markdown strip) is present. Exponential backoff (2s/5s/10s + jitter) is on all provider calls.

2. **rag_service.py** — query rewrite → embed → ChromaDB search → rerank → LLM stream pipeline is complete. SSE yields both `{"type":"token","content":"..."}` and `{"type":"citations","data":[...]}` shapes. Messages are persisted after streaming.

3. **file_processor.py** — all four MIME types handled: PDF (`pdfplumber`), DOCX (`python-docx`), PPTX (`python-pptx`), TXT. Chunking by sentence boundaries is present. Batch embed size is 96. ChromaDB upsert happens after all chunks are embedded.

4. **exam_service.py** — all four question types generated: `mcq_single`, `mcq_multiple`, `true_false`, `fill_blank`. Schema validation present. Falls back if a question type fails to parse.

5. **flashcard_service.py** — SM-2 algorithm: ease factor starts at 2.5, quality 0–5 input, intervals 1→6→N days. `update_sm2` function updates `ease_factor`, `interval_days`, `repetitions`, and `due_date` correctly.

6. **learning_path_service.py** — two-phase: outline first (all modules), then enrich each module with `asyncio.Semaphore(3)`. Both phases use `generate_structured_json`. Module content is markdown.

7. **slide_service.py** — three-phase: outline → per-slide enrichment (`Semaphore(4)`) → PPTX export via `python-pptx` → S3 upload. Deck `status` is updated to `ready` or `error` at end.

8. **notification_service.py** — three channels: in-app DB row, SendGrid email, Twilio WhatsApp. WhatsApp only fires if `user.notif_whatsapp = true` AND `user.plan = 'school'`. In-app always fires. Email only if `user.notif_email = true`.

9. **vector_store.py** — `upsert_chunks()`, `query()`, `get_all_chunks_for_files()` all present. `query()` accepts `file_ids` filter and `min_score` threshold. ChromaDB HTTP client, not embedded.

10. **reranker.py** — cross-encoder `ms-marco-MiniLM-L-6-v2` loads without error. Falls back to raw similarity scores if model unavailable (not a hard failure).

11. **storage_service.py** — presigned PUT and GET URLs work. `delete()` works. Auto-creates bucket if it doesn't exist (MinIO local dev path).

For each service, write findings to `audit/services.md` in format:
```
service_name.py — [PASS | ISSUES]
  Issues: [list any broken, missing, or incomplete logic]
```

---

## Step 3 — Verify every Celery task

For each task in `backend/app/tasks/`:

**`process_file_task`** (queue: files):
- Downloads file from S3 using `storage_service`
- Calls `file_processor.extract_text()`
- Chunks and embeds
- Upserts to ChromaDB
- Updates `files.status` to `ready` or `error`
- Updates `files.chunk_count` and `files.indexed_at`

**`generate_slides_task`** (queue: slides):
- Calls `slide_service` three-phase pipeline
- Updates `slide_decks.status` to `ready` or `error`
- Updates `slide_decks.pptx_url` on success
- Updates `slide_decks.slide_count`

**`check_exam_deadlines`** (queue: beat, hourly):
- Queries exams where `ends_at` is within 24h and `status = 'published'`
- Finds all students who haven't submitted yet
- Calls `notification_service` for each
- Does NOT re-notify the same student twice (check audit log or add a notified flag)

Verify each task has:
- `max_retries = 3`
- `autoretry_for = (Exception,)` or explicit retry logic
- `acks_late = True`
- Proper logging at start, success, and failure

Write findings to `audit/tasks.md`.

---

## Step 4 — Verify the frontend API layer

Open `lib/api.ts`. Verify:
- `apiGet`, `apiPost`, `apiPatch`, `apiDelete` all attach Clerk JWT via `useAuth().getToken()` in the Authorization header
- All four functions handle non-2xx responses by throwing an error with the server's `detail` field (not a generic message)
- No hardcoded base URLs — uses `process.env.NEXT_PUBLIC_API_URL`

Open every file in `lib/hooks/`. For each hook verify:
- Uses TanStack Query v5 (`useQuery` / `useMutation`) — not v4 syntax
- `queryKey` is specific enough (includes IDs, not just `['exams']` when it should be `['exams', groupId]`)
- `useMutation` calls `queryClient.invalidateQueries()` on success with the correct key
- Error from the API is surfaced (not silently swallowed)
- Loading state is returned and usable by the component

Write `audit/hooks.md` with per-hook status.

---

## Step 5 — Fix all gaps

Work through the gap matrix from Step 1. Fix every row that is not `OK`. Apply fixes in this priority order:

**Priority 1 — Broken backend (fix first, nothing works without these)**
- `STUB_BACKEND`: implement the real logic using the appropriate service
- `WRONG_URL` on backend: fix the route path in the router
- `AUTH_MISMATCH` on backend: add the correct `Depends(get_current_user)` or `require_role()`

**Priority 2 — Missing frontend connections**
- `NO_HOOK`: create the hook in the appropriate `lib/hooks/` file following existing patterns
- `WRONG_METHOD` or `WRONG_URL` on frontend: correct the `apiGet/apiPost` call
- `SCHEMA_MISMATCH`: align the TypeScript type to match the actual Pydantic schema

**Priority 3 — Missing UI**
- `NO_UI`: add the UI to the correct page or create a new component
- `NO_ERROR`: add error state display (use existing error component pattern in the codebase)
- `NO_LOADING`: add skeleton or spinner (use existing loading pattern in the codebase)

For each fix, write a one-line entry in `audit/fixes_applied.md`:
```
FIXED [gap_type] — endpoint — what was done
```

---

## Step 6 — Verify all 8 Docker services

Check `docker-compose.yml`. All 8 services must be present and correctly configured:

| Service | Image | Port | Required env vars |
|---|---|---|---|
| api | python:3.11-slim | 8000 | DATABASE_URL, REDIS_URL, CLERK_SECRET_KEY, OPENAI_API_KEY, AWS_* |
| web | node:20-alpine | 3000 | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY |
| postgres | postgres:16-alpine | 5432 | POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD |
| redis | redis:7-alpine | 6379 | — |
| celery_worker | (same as api) | — | same as api + CELERY_BROKER_URL |
| celery_beat | (same as api) | — | same as api |
| chroma_server | chromadb:0.5.3 | 8001 | — |
| minio | minio/minio | 9000/9001 | MINIO_ROOT_USER, MINIO_ROOT_PASSWORD |

Verify:
- `api` service has `depends_on: [postgres, redis, chroma_server, minio]`
- `celery_worker` has `depends_on: [postgres, redis]`
- `celery_beat` has `depends_on: [redis]`
- `web` has `depends_on: [api]`
- All services have `restart: unless-stopped`
- No service exposes internal ports to host unnecessarily (only `api:8000`, `web:3000`, `minio:9001` for console should be host-exposed)
- Health checks exist for `postgres`, `redis`, and `api`

Write any issues to `audit/docker.md`.

---

## Step 7 — Verify all admin endpoints

The admin surface (`/api/v1/admin/`) is the most likely to have stubs. Verify every endpoint:

**Health endpoints:**
- `GET /admin/health/overview` — actually pings DB pool, Redis, Chroma, S3, AI provider, and returns latency for each. Not hardcoded.
- `GET /admin/health/stuck-files` — queries `files` table where `status IN ('uploading','processing')` and `updated_at < now() - interval`. Takes `minutes` query param.
- `POST /admin/health/stuck-files/{id}/retry` — resets status to `uploading`, re-enqueues `process_file_task`
- `GET /admin/health/dlq` — actually reads from the Redis DLQ (not SQS — check the actual implementation matches the broker)
- `GET /admin/health/ai-costs` — if `tracking_enabled: false`, the response must say so clearly. Do not return fake cost data.

**User management:**
- `GET /admin/users/search` — searches `name` and `email` with ILIKE, returns paginated results
- `POST /admin/users/{id}/override-plan` — changes `users.plan`, writes `audit_logs` row with `actor_id`, `target_id`, `action='plan_override'`, `meta={old_plan, new_plan}`
- `POST /admin/users/{id}/suspend` — sets `users.is_active = false`, calls Clerk API to revoke sessions, writes `audit_logs` row

**Feature flags:**
- `GET /admin/feature-flags` — returns all rows from `feature_flags` table including `enabled_for_plans`
- `PATCH /admin/feature-flags/{key}` — updates `enabled` field, writes `audit_logs` row

All admin endpoints must have `Depends(require_role("super_admin"))`. Verify this on each one.

---

## Step 8 — Verify the streaming chat pipeline end-to-end

The RAG chat endpoint is the most complex. Trace it completely:

**Backend** (`POST /api/v1/groups/{id}/chat`):
1. Auth guard fires — `get_current_user()` returns user
2. Group membership verified — user is a member of `group_id`
3. `rag_service.stream_response()` called with `query`, `group_id`, `user_id`, `room_id`
4. Inside `rag_service`:
   a. `rewrite_query()` → rewritten query string
   b. `embed_texts([rewritten_query])` → embedding vector
   c. `vector_store.query(embedding, file_ids=group_file_ids, top_k=10, min_score=0.7)` → chunks
   d. `reranker.rerank(query, chunks)` → top 5 reranked chunks
   e. Prompt built with chunks as context
   f. `chat_completion(prompt, stream=True)` → async token generator
   g. Yields `{"type":"token","content":"..."}` for each token
   h. After stream ends, yields `{"type":"citations","data":[{file_id, chunk_id, passage}]}`
5. `chat_messages` row saved with `role='assistant'`, `content=full_response`, `citations=citations_json`
6. Returns `StreamingResponse` with `media_type="text/event-stream"`

**Frontend** (`lib/hooks/use-streaming-chat.ts`):
1. `EventSource` opened to the endpoint with Clerk token in URL or header
2. `message` event handler parses each SSE line as JSON
3. Token events: appended to current `assistantMessage` state
4. Citations event: stored in `citations` state
5. On stream end (`event.type === 'close'` or empty data): sets `isStreaming = false`
6. Error event: sets `error` state, closes EventSource
7. Message added to chat history state

Verify both sides match. If `EventSource` cannot send Authorization headers (browser limitation), check how the Clerk token is passed — it must be via a short-lived query param or cookie, not a missing header.

Write findings to `audit/streaming_chat.md`.

---

## Step 9 — Verify plan limits enforcement

Plan limits must be enforced server-side. Verify these limits are checked in the correct endpoints:

| Limit | Free | Personal | School | Enforced in |
|---|---|---|---|---|
| Chat messages/day | 20 | 100 | 200 | `POST /groups/{id}/chat` |
| Exams/month | 5 | 30 | 100 | `POST /groups/{id}/exams/generate` |
| Groups | 1 | 10 | 50 | `POST /groups` |
| Files per group | check existing | check existing | check existing | `POST /groups/{id}/files/upload-url` |

For each endpoint, verify:
- Query counts existing records within the time window (day/month)
- Compares against `PLAN_LIMITS[user.plan][limit_key]`
- Returns `HTTP 429` with `{"detail": "plan_limit_reached", "limit": N, "current": M}` when exceeded
- The limit dict is defined in one place (not hardcoded in each endpoint separately)

---

## Step 10 — Final output

After all steps are complete, write `audit/summary.md` with:

```markdown
# StudyForge audit summary

## Stats
- Total backend endpoints: N
- Fully connected (OK): N
- Gaps fixed this session: N
- Remaining issues (if any): N

## Services health
- ai_service: PASS / ISSUES
- rag_service: PASS / ISSUES
- file_processor: PASS / ISSUES
- exam_service: PASS / ISSUES
- flashcard_service: PASS / ISSUES
- learning_path_service: PASS / ISSUES
- slide_service: PASS / ISSUES
- notification_service: PASS / ISSUES
- vector_store: PASS / ISSUES
- reranker: PASS / ISSUES
- storage_service: PASS / ISSUES

## Celery tasks health
- process_file_task: PASS / ISSUES
- generate_slides_task: PASS / ISSUES
- check_exam_deadlines: PASS / ISSUES

## Critical fixes applied
[list the most important fixes]

## Remaining known issues
[anything that couldn't be fixed automatically with a clear description and suggested fix]
```

---

## Rules

- Do not add new features, only fix existing ones
- Do not rename files, routes, or variables for style — only for correctness
- Do not change Pydantic schema field names unless they are actually wrong
- Do not remove any existing endpoint even if unused — mark it in the audit only
- Every fix must be minimal — change only what is broken
- If a fix requires a decision (e.g. two valid ways to implement something), write both options to `audit/decisions.md` and pick the one that matches existing patterns most closely
- After every Phase, output which files were modified
