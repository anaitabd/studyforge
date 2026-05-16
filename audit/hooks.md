# Hooks Audit — StudyForge Frontend

TanStack Query v5 compliance and schema correctness for all React hooks.

---

## TanStack Query v5 Compliance

All hooks that use `useQuery` / `useMutation` from `@tanstack/react-query` were checked for v5 API usage (primarily: `queryFn` returning data, no `onSuccess`/`onError` in `useQuery`, `refetchInterval` accepting a function receiving the query object, etc.).

**Result: All hooks are v5-compliant.** Notable v5 patterns in use:
- `refetchInterval: (q) => ...` (function form, v5 required)
- `useMutation.onSuccess` used only to invalidate/setQueryData (not `useQuery.onSuccess` which is removed in v5)
- No deprecated `cacheTime` (uses `gcTime` where needed, or omits it)
- `enabled` guards present throughout

---

## Schema Mismatch Issues

### 1. `use-flashcards.ts` — FlashcardProgress interface

**File:** `apps/web/lib/hooks/use-flashcards.ts`

| Frontend field | Backend field | Fix |
|---|---|---|
| `interval` (number) | `interval_days` (int) | Rename to `interval_days` |
| `repetitions` (number) | `reps` (int) | Rename to `reps` |

**Impact**: `useReviewCard` mutation response data will have all numeric fields as `undefined` because the keys don't match. The SM-2 progress UI will show blank/incorrect values.

---

### 2. `use-individual-kpis.ts` — PersonalKpis interface

**File:** `apps/web/lib/hooks/use-individual-kpis.ts`

**Backend `/me/kpis` returns:**
```json
{
  "cards_due_today": 5,
  "cards_overdue": 2,
  "flashcard_retention_rate": 0.82,
  "exam_score_trend": [...],
  "streak": { "current": 7, "longest": 14, "today_active": true }
}
```

**Frontend `PersonalKpis` interface uses:**
```typescript
cards_due: number          // should be cards_due_today
cards_overdue: number      // OK
retention_rate: number     // should be flashcard_retention_rate
exams_taken: number        // does not exist in backend response
avg_exam_score: number     // does not exist in backend response
score_trend: number[]      // backend key is exam_score_trend
```

| Frontend field | Backend field | Fix |
|---|---|---|
| `cards_due` | `cards_due_today` | Rename |
| `retention_rate` | `flashcard_retention_rate` | Rename |
| `exams_taken` | ❌ not returned | Remove or derive from exam_score_trend.length |
| `avg_exam_score` | ❌ not returned | Remove or compute client-side |
| `score_trend` | `exam_score_trend` | Rename |

---

### 3. `use-individual-kpis.ts` — StreakData interface

**Backend `/me/streak` returns:**
```json
{ "current": 7, "longest": 14, "today_active": true }
```

**Frontend `StreakData` interface uses:**
```typescript
current_streak: number    // backend: current
longest_streak: number    // backend: longest
has_activity_today: boolean  // backend: today_active
```

| Frontend field | Backend field | Fix |
|---|---|---|
| `current_streak` | `current` | Rename |
| `longest_streak` | `longest` | Rename |
| `has_activity_today` | `today_active` | Rename |

---

### 4. `use-individual-kpis.ts` — WeakAreas

**Backend `/me/weak-areas` returns:**
```json
{ "weak_areas": ["Thermodynamics", "Electron orbitals"] }
```

**Frontend expects:**
```typescript
interface WeakArea {
  concept: string
  frequency: number
}
```

**Impact**: Hook receives a `string[]` but tries to map `.concept` and `.frequency` on each item. Both will be `undefined`. Weak areas UI will render blank.

**Fix**: Change `WeakArea` to `string` or add backend support for frequency data.

---

### 5. `use-org-kpis.ts` — OrgKpisOverview interface

**Backend `/org/{slug}/kpis/overview` returns:**
```json
{
  "dau": 42,
  "wau": 150,
  "avg_exam_score": 0.78,
  "completion_rate": 0.65,
  "at_risk_count": 8
}
```

**Frontend `OrgKpisOverview` includes `total_members`** — this field is not in the backend response.

**Impact**: `total_members` will always be `undefined`.

---

### 6. `use-org-kpis.ts` — CohortKpiSummary interface

**Backend cohort KPI list returns objects with `name` field.**
**Frontend `CohortKpiSummary` has `cohort_name` field.**

**Impact**: Cohort name renders as `undefined` in cohort KPI table.

| Frontend field | Backend field | Fix |
|---|---|---|
| `cohort_name` | `name` | Rename |

---

### 7. `use-org-kpis.ts` — AtRiskStudent interface

**Backend `/org/{slug}/kpis/at-risk` returns:**
```json
{ "user_id": "...", "name": "...", "reason_flags": ["no_activity_7d", "exam_fail"] }
```

**Frontend `AtRiskStudent` has `days_inactive: number`** — backend returns `reason_flags: string[]` instead.

**Impact**: `days_inactive` always `undefined`; `reason_flags` not accessible in the type.

---

### 8. `use-groups.ts` — Group interface

**Backend `/groups` returns `color`, `my_role`, `is_archived` fields.**
**Frontend `Group` interface is missing all three.**

**Impact**: Group color and role-based UI gating will not work.

Additionally, `useCreateGroup` mutation only sends `name` and `description` — does not include `color`. If the UI allows color selection, it will be silently ignored.

---

### 9. `use-files.ts` — GroupFile interface

**Backend returns `indexed_at` (ISO datetime) on file objects.**
**Frontend `GroupFile` interface is missing `indexed_at`.**

**Impact**: Minor — `indexed_at` not accessible from hook consumers.

---

### 10. `use-teacher.ts` — StudentStat interface

**Backend `/teacher/groups/{id}/analytics` returns student records with `files_read` and `active_minutes`.**
**Frontend `StudentStat` interface is missing both fields.**

**Impact**: Teacher analytics dashboard cannot display file engagement or time-on-task data.

---

## Duplicate Hook Files

Three pairs of duplicates were found. This increases the risk of divergence over time.

| Capability | File A | File B | Key difference |
|---|---|---|---|
| Chat streaming | `lib/hooks/use-chat.ts` | `lib/hooks/use-streaming-chat.ts` | use-streaming-chat invalidates `["chat", groupId]` but useChatHistory key is `["chat-history", groupId]` — **wrong key, no invalidation** |
| Generate exam | `lib/hooks/use-exams.ts` | `hooks/use-generate.ts` | Same endpoint, different param name convention |
| Generate flashcards | `lib/hooks/use-flashcards.ts` | `hooks/use-generate.ts` | Same endpoint |
| Group files | `lib/hooks/use-files.ts` + `lib/hooks/useApi.ts` | `hooks/use-generate.ts` | Three implementations with slightly different GroupFile shapes |
| Exam / flashcard / room queries | `lib/hooks/useApi.ts` | Dedicated hook files | useApi.ts is a monolithic legacy file; dedicated files use different query keys |

**Recommendation**: Remove `lib/hooks/use-streaming-chat.ts` (or merge into `use-chat.ts`). Deprecate `lib/hooks/useApi.ts` in favour of the dedicated hook files.

---

## Missing Hooks

| Backend capability | Missing hook |
|---|---|
| `PUT /api/v1/notifications/{id}/read` | No mutation hook |
| `PUT /api/v1/notifications/read-all` | No mutation hook |
| `POST /api/v1/me/goals`, `GET /api/v1/me/goals`, `PATCH /api/v1/me/goals/{id}` | No hook file found |

---

## Reading Tracker — Payload Type Mismatch

**File:** `apps/web/lib/hooks/use-reading-tracker.ts`

Hook sends:
```json
{ "scroll_depth_pct": 0.75 }
```

Backend `ReadingEvent.scroll_depth_pct` is typed as `Integer` (0–100).

**Impact**: Backend receives `0` for all scroll depth values because `0.75` truncates to `0` on int coercion. Scroll analytics will be permanently incorrect.

**Fix**: Multiply by 100 before sending: `Math.round(scrollDepthRef.current * 100)`.
