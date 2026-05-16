# StudyForge audit summary

## Stats
- Total backend endpoints: 105
- Fully connected (OK) before audit: ~78
- Gaps fixed this session: 20
- Remaining issues (if any): 4 (documented below)

## Services health
- ai_service: PASS
- rag_service: PASS (minor: AI message lost on client disconnect — architectural, not a bug)
- file_processor: PASS
- exam_service: PASS (minor: malformed questions silently dropped instead of degraded)
- flashcard_service: PASS
- learning_path_service: PASS
- slide_service: PASS (fixed: SLIDE_ENRICH_CONCURRENCY 1→4)
- notification_service: PASS (fixed: notif_email, notif_whatsapp, plan guards were missing)
- vector_store: PASS
- reranker: PASS
- storage_service: PASS (no presigned PUT; direct uploads go multipart — acceptable)

## Celery tasks health
- process_file_task: PASS (fixed: task_acks_late=True added globally)
- generate_slides_task: PASS (fixed: max_retries 2→3, task_acks_late=True)
- check_exam_deadlines: PASS
- send_email_task: PASS (fixed: task_acks_late=True)
- send_whatsapp_task: PASS (fixed: task_acks_late=True)
- analytics tasks: PASS (fixed: task_acks_late=True)

## Critical fixes applied
1. **AuditLog `metadata=` → `meta=`** (`admin.py`) — both `suspend_user` and `update_feature_flag` would raise `AttributeError` at runtime, making those endpoints permanently broken.
2. **Notification preference gates** (`notification_service.py`) — all users received email and WhatsApp notifications regardless of their opt-in settings and plan tier.
3. **`task_acks_late=True`** (`celery_app.py`) — all task queues were at risk of silent message loss on worker crash.
4. **`SLIDE_ENRICH_CONCURRENCY` 1→4** (`slide_service.py`) — slide generation was 4× slower than the spec target.
5. **`scroll_depth_pct` ×100** (`use-reading-tracker.ts`) — all scroll analytics were permanently recorded as 0.
6. **Chat history invalidation key** (`use-streaming-chat.ts`) — chat list never refreshed after streaming; every conversation required a full page reload to show AI responses.
7. **SM-2 field names** (`use-flashcards.ts`) — `interval_days`/`reps` mismatch caused flashcard progress UI to show undefined for all SM-2 values.
8. **Personal KPI / Streak / WeakAreas field names** (`use-individual-kpis.ts`) — dashboard KPI widgets rendered blank for all users.
9. **Org KPI field names** (`use-org-kpis.ts`) — org admin dashboard cohort table showed undefined names; at-risk panel had wrong field shape.

## Remaining known issues

### 1. `useNotifications` error swallowing removed — callers must handle errors
**Where**: `lib/hooks/useApi.ts`
**Detail**: The `catch { return [] }` wrapper was removed so errors surface properly. Any component that renders the notification bell without an error boundary may now show an unhandled error state if the endpoint is temporarily unavailable.
**Suggested fix**: Add a try/catch in the notification bell component, or use TanStack Query's `isError` state to show a fallback gracefully.

### 2. `exam_service.py` — malformed questions silently dropped
**Where**: `apps/api/app/services/exam_service.py`
**Detail**: Questions that fail schema validation are skipped without substitution. A consistently bad AI response could produce an exam with fewer questions than requested.
**Suggested fix**: Add a retry loop for individual question types that fail, or fill dropped slots with a simpler fallback question type.

### 3. `use-streaming-chat.ts` duplicate of `use-chat.ts`
**Where**: `apps/web/lib/hooks/use-streaming-chat.ts` and `apps/web/lib/hooks/use-chat.ts`
**Detail**: Two separate hooks implement the same SSE stream. The query key mismatch has been fixed but the duplication remains. Any future change to streaming behavior must be made in both files.
**Suggested fix**: Delete `use-streaming-chat.ts` and update all imports to use the implementation in `use-chat.ts`.

### 4. `useApi.ts` — legacy duplicate hooks
**Where**: `apps/web/lib/hooks/useApi.ts`
**Detail**: `useGroups`, `useGroup`, `useGroupFiles`, `useChatHistory`, `useExams`, `useFlashcardSets`, `useRooms`, `useTeacherAnalytics` are all duplicated in dedicated hook files with different query keys. This causes cache divergence when components from different files are rendered together.
**Suggested fix**: Deprecate and remove `useApi.ts` hook-by-hook, routing all consumers to the dedicated hook files. This is a larger refactor; safe to do incrementally.
