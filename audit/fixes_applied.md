# Fixes Applied

## Priority 1 — Runtime bugs (backend)

FIXED BROKEN_BACKEND — `GET /api/v1/search` — `File.filename.ilike(...)` → `File.name.ilike(...)` in `search.py:44,69`; `File` model has no `filename` column, this raised `AttributeError` on every search query that matched a file.

FIXED BROKEN_BACKEND — `POST /api/v1/admin/users/{id}/suspend` — `AuditLog(metadata=...)` → `AuditLog(meta=...)` in `admin.py:478`; column is `meta` not `metadata`, would have raised `AttributeError` on every suspend call.

FIXED BROKEN_BACKEND — `PATCH /api/v1/admin/feature-flags/{key}` — `AuditLog(metadata=...)` → `AuditLog(meta=...)` in `admin.py:538`; same `AttributeError` on every flag update.

FIXED SCHEMA_MISMATCH — `notification_service.py:_dispatch_email` — added `getattr(user, "notif_email", True)` guard; previously emailed all users regardless of preference.

FIXED SCHEMA_MISMATCH — `notification_service.py:_dispatch_whatsapp` — added `getattr(user, "notif_whatsapp", False)` and `getattr(user, "plan", "") == "school"` guards; previously sent WhatsApp to any user with a number regardless of opt-in or plan.

## Priority 2 — Reliability (Celery)

FIXED RELIABILITY — `celery_app.py` — added `task_acks_late=True` globally; without it a worker crash between receipt and task completion silently drops the job with no retry.

FIXED RELIABILITY — `slide_tasks.py:19` — `max_retries=2` → `max_retries=3`; spec requires 3 retries.

FIXED PERFORMANCE — `slide_service.py:32` — `SLIDE_ENRICH_CONCURRENCY=1` → `SLIDE_ENRICH_CONCURRENCY=4`; slide enrichment was running serially, ~4× slower than the spec target.

## Priority 3 — Schema mismatches (frontend)

FIXED SCHEMA_MISMATCH — `use-flashcards.ts` — renamed `interval` → `interval_days` and `repetitions` → `reps` in `FlashcardProgress` interface; SM-2 progress values were always `undefined` in UI.

FIXED SCHEMA_MISMATCH — `use-individual-kpis.ts:PersonalKpis` — renamed `cards_due` → `cards_due_today`, `retention_rate` → `flashcard_retention_rate`, `score_trend` → `exam_score_trend`; removed non-existent `exams_taken` and `avg_exam_score` fields.

FIXED SCHEMA_MISMATCH — `use-individual-kpis.ts:StreakData` — renamed `current_streak` → `current`, `longest_streak` → `longest`, `has_activity_today` → `today_active` to match backend `/me/streak` response shape.

FIXED SCHEMA_MISMATCH — `use-individual-kpis.ts:WeakArea` — changed from `{concept, frequency}` object to `string`; backend `/me/weak-areas` returns `string[]`.

FIXED SCHEMA_MISMATCH — `use-org-kpis.ts:OrgKpisOverview` — removed non-existent `total_members` field; added `completion_rate` which backend actually returns.

FIXED SCHEMA_MISMATCH — `use-org-kpis.ts:CohortKpiSummary` — renamed `cohort_name` → `name` to match backend response.

FIXED SCHEMA_MISMATCH — `use-org-kpis.ts:AtRiskStudent` — replaced `days_inactive: number` with `reason_flags: string[]`; backend returns flags array not a numeric count.

FIXED SCHEMA_MISMATCH — `use-reading-tracker.ts:55` — `scrollDepthRef.current.toFixed(2)` → `Math.round(scrollDepthRef.current * 100)`; backend column is `Integer` 0–100, hook was sending float 0–1 which truncated to 0.

FIXED WRONG_URL — `use-streaming-chat.ts:64` — `invalidateQueries(["chat", groupId])` → `invalidateQueries(["chat-history", groupId])`; chat history never refreshed after a streaming session completed because the invalidation key didn't match `useChatHistory`'s query key.

FIXED SCHEMA_MISMATCH — `use-groups.ts:Group` — added `color: string | null`, `my_role: string | null`, `is_archived: boolean` fields that backend returns but interface was missing.

FIXED SCHEMA_MISMATCH — `use-teacher.ts:StudentStat` — added `files_read: number` and `active_minutes: number` that backend analytics response includes; teacher dashboard could not display engagement data.

FIXED SCHEMA_MISMATCH — `use-files.ts:GroupFile` — added `indexed_at: string | null` field that backend returns; hook consumers could not display indexing timestamp.

## Priority 4 — Missing hooks

FIXED NO_HOOK — `PUT /api/v1/notifications/{id}/read` — added `useMarkNotificationRead()` mutation to `useApi.ts`; no hook existed.

FIXED NO_HOOK — `PUT /api/v1/notifications/read-all` — added `useMarkAllNotificationsRead()` mutation to `useApi.ts`; no hook existed.

FIXED NO_ERROR — `useApi.ts:useNotifications` — removed silent `catch { return [] }` that swallowed all API errors; errors are now surfaced to callers.
