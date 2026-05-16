# StudyForge Frontend — Prompt FE-1: Audit & Hook Gap Closure

## Read first
```
cat prompts/prompt_fe0_design_system.md
```

## Step 0 — Read everything before writing a single line

```bash
find apps/web/lib/hooks -name "*.ts" | sort
find apps/web/app -name "page.tsx" | sort
cat apps/web/lib/api.ts
cat apps/web/app/\(app\)/dashboard/page.tsx
cat apps/web/app/\(app\)/groups/\[groupId\]/page.tsx
ls apps/api/app/api/v1/
```

After reading, produce `audit/frontend_gap_matrix.md` with this format:

```
| Backend endpoint | Hook exists? | Page/component uses it? | Gap type |
```

Gap types: NO_HOOK | NO_UI | SCHEMA_MISMATCH | NO_LOADING | NO_ERROR | NO_EMPTY_STATE | OK

---

## Fix priority order

### Priority 1 — Missing hooks (build these first)

Create `apps/web/lib/hooks/use-org.ts`:
```typescript
// GET /api/v1/org/:slug — org detail
export function useOrg(slug: string)

// GET /api/v1/org/:slug/kpis/overview
export function useOrgKpis(slug: string)

// GET /api/v1/org/:slug/kpis/at-risk
export function useAtRiskStudents(slug: string)

// GET /api/v1/org/:slug/members
export function useOrgMembers(slug: string)

// POST /api/v1/org/:slug/members/bulk-invite
export function useBulkInvite(slug: string)

// GET /api/v1/org/:slug/cohorts
export function useOrgCohorts(slug: string)

// POST /api/v1/org/:slug/cohorts
export function useCreateCohort(slug: string)

// GET /api/v1/org/:slug/cohorts/:id/kpis
export function useCohortKpis(slug: string, cohortId: string)

// GET /api/v1/org/:slug/students/:userId/timeline
export function useStudentTimeline(slug: string, userId: string)
```

Create `apps/web/lib/hooks/use-individual-kpis.ts`:
```typescript
// GET /api/v1/me/kpis
export function useMyKpis()

// GET /api/v1/me/goals
export function useMyGoals()

// POST /api/v1/me/goals
export function useCreateGoal()

// GET /api/v1/me/streak
export function useMyStreak()

// GET /api/v1/me/weak-areas
export function useMyWeakAreas()
```

Extend `apps/web/lib/hooks/use-exams.ts` — add these:
```typescript
// POST /groups/:id/exams/:id/sessions/:id/answers/:qid/photo
export function useUploadConstructionPhoto(groupId, examId, sessionId)

// The results hook must handle the new fields: score_over_20, passed,
// grading_status, per-question feedback, ai_summary, weak_areas
```

### Priority 2 — Fix existing hooks with schema mismatches

Open every hook file. For each hook that calls an endpoint, verify:
- The TypeScript return type matches the actual API response shape
- If the API now returns `score_over_20`, `grading_status`, `passed` — the type must include these
- If the API returns `per_question_scores` with nested feedback — the type must include this

Fix any type that uses `any` or is missing new fields.

### Priority 3 — Pages missing loading.tsx

Check every page in `apps/web/app/(app)/`. For every page that lacks a
sibling `loading.tsx`, create one using skeleton components from the
design system.

### Priority 4 — Lists missing empty states

Check every component that renders a list (`map()`). If there's no empty
state branch (`if (!items?.length)`), add one following the design system
pattern.

---

## Verification

```bash
cd apps/web
npx tsc --noEmit 2>&1 | head -50
```

Fix all TypeScript errors before finishing. Report the output.

Write `audit/frontend_gap_matrix.md` when done.
