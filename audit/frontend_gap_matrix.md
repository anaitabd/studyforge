# Frontend Gap Matrix
Generated: 2026-05-13

## Hook coverage

| Backend endpoint | Hook file | Hook exists? | Page uses it? | Gap type |
|---|---|---|---|---|
| GET /api/v1/org/:slug | use-org.ts `useOrg` | ✅ | org sidebar | OK |
| GET /api/v1/org/:slug/kpis/overview | use-org-kpis.ts `useOrgKpisOverview` | ✅ (also re-exported as `useOrgKpis` from use-org.ts) | org dashboard | OK |
| GET /api/v1/org/:slug/kpis/at-risk | use-org-kpis.ts `useAtRiskStudents` | ✅ | org dashboard | OK |
| GET /api/v1/org/:slug/kpis/dau-trend | use-org-admin.ts `useDauTrend` | ✅ | org dashboard | OK |
| GET /api/v1/org/:slug/kpis/cohorts | use-org-kpis.ts `useCohortsKpis` | ✅ | org dashboard | OK |
| GET /api/v1/org/:slug/members | use-org.ts `useOrgMembers` | ✅ | members page | OK |
| POST /api/v1/org/:slug/members/invite | use-org.ts `useInviteMember` | ✅ | members page | OK |
| POST /api/v1/org/:slug/members/bulk-invite | use-org-admin.ts `useBulkInvite` | ✅ | members page | OK |
| PATCH /api/v1/org/:slug/members/:id/role | use-org.ts `useUpdateMemberRole` | ✅ | members page | OK |
| DELETE /api/v1/org/:slug/members/:id | use-org.ts `useRemoveMember` | ✅ | members page | OK |
| GET /api/v1/org/:slug/cohorts | use-cohorts.ts `useCohorts` | ✅ | cohorts page | OK |
| POST /api/v1/org/:slug/cohorts | use-cohorts.ts `useCreateCohort` | ✅ | cohorts page | OK |
| GET /api/v1/org/:slug/cohorts/:id/kpis | use-org-kpis.ts `useCohortKpis` | ✅ | cohort detail | OK |
| GET /api/v1/org/:slug/cohorts/:id/students | use-org-admin.ts `useCohortStudents` | ✅ | cohort detail | OK |
| GET /api/v1/org/:slug/cohorts/:id/assignments | use-org-admin.ts `useCohortAssignments` | ✅ | cohort detail | OK |
| GET /api/v1/org/:slug/cohorts/:id/live | use-org-admin.ts `useCohortLive` | ✅ | cohort detail | OK |
| GET /api/v1/org/:slug/students/:id | use-org-admin.ts `useStudentProfile` | ✅ | student profile | OK |
| GET /api/v1/org/:slug/students/:id/timeline | use-org-kpis.ts `useStudentTimeline` | ✅ | student profile | OK |
| GET /api/v1/org/:slug/assignments/my | use-org-admin.ts `useMyAssignments` | ✅ | student tasks | OK |
| GET /api/v1/me/kpis | use-individual-kpis.ts `usePersonalKpis` | ✅ | dashboard | OK |
| GET /api/v1/me/streak | use-individual-kpis.ts `useStreak` | ✅ | dashboard, goals | OK |
| GET /api/v1/me/goals | use-individual-kpis.ts `useGoals` | ✅ | goals page | OK |
| POST /api/v1/me/goals | use-individual-kpis.ts `useCreateGoal` | ✅ | goals page | OK |
| PATCH /api/v1/me/goals/:id | use-individual-kpis.ts `useUpdateGoal` | ✅ | goals page | OK |
| GET /api/v1/me/weak-areas | use-individual-kpis.ts `useWeakAreas` | ✅ | goals page | OK |
| POST /groups/:id/exams/:id/sessions/:id/answers/:qid/photo | use-exams.ts `useUploadConstructionPhoto` | ✅ **ADDED** | not yet wired to UI | NO_UI |
| GET /api/v1/groups/:id/exams | useApi.ts `useExams` | ✅ | exams list | OK |
| GET /api/v1/groups/:id/exams/:id | use-exams.ts `useExam` | ✅ | take exam | OK |
| POST /api/v1/groups/:id/exams/generate | use-exams.ts `useGenerateExam` | ✅ | generate modal | OK |
| POST /api/v1/groups/:id/exams/:id/sessions | use-exams.ts `useStartSession` | ✅ | take exam | OK |
| PUT /api/v1/groups/:id/exams/:id/sessions/:id | use-exams.ts `useAutosave` | ✅ | take exam | OK |
| POST /api/v1/groups/:id/exams/:id/sessions/:id/submit | use-exams.ts `useSubmitExam` | ✅ | take exam | OK |
| GET /api/v1/groups/:id/exams/:id/sessions/:id | (inline useQuery in results page) | ✅ | results page | OK |

## Schema mismatches fixed

| File | Field | Old (wrong) | New (correct) | Status |
|---|---|---|---|---|
| use-individual-kpis.ts `PersonalKpis` | `exam_score_trend` | `number[]` | `ExamScoreTrendPoint[]` | ✅ FIXED |
| use-individual-kpis.ts `PersonalKpis` | missing fields | — | `active_minutes_goal`, `streak`, `weak_areas`, `study_goal` | ✅ FIXED |
| use-individual-kpis.ts `StreakData` | `last_active_date` | extra field not in backend | removed | ✅ FIXED |
| dashboard/page.tsx | `kpis?.exams_taken` | field doesn't exist | `kpis?.exam_score_trend?.length` | ✅ FIXED |
| dashboard/page.tsx | `kpis?.cards_due` | wrong name | `kpis?.cards_due_today` | ✅ FIXED |
| dashboard/page.tsx | `streak.current_streak` | wrong name | `streak.current` | ✅ FIXED |
| dashboard/page.tsx | `streak.has_activity_today` | wrong name | `streak.today_active` | ✅ FIXED |
| goals/page.tsx | `streak.current_streak` | wrong name | `streak.current` | ✅ FIXED |
| goals/page.tsx | `streak.longest_streak` | wrong name | `streak.longest` | ✅ FIXED |
| goals/page.tsx | `streak.has_activity_today` | wrong name | `streak.today_active` | ✅ FIXED |
| goals/page.tsx | `w.concept` on `string` | type error | `w` | ✅ FIXED |
| use-exams.ts `Question.type` | missing open types | 4 types | 8 types (added open_calculation, essay, document_analysis, construction_photo) | ✅ FIXED |
| use-exams.ts `Question` | missing `points` | — | `points?: number` | ✅ FIXED |
| use-exams.ts `Correction` | missing fields | — | `type`, `points_earned`, `points_max`, `feedback`, `is_correct: boolean \| null` | ✅ FIXED |
| use-exams.ts `GradingResult` | missing fields | — | `score_over_20`, `passed`, `grading_status`, `ai_summary`, `weak_areas`, `study_recommendations` | ✅ FIXED |
| use-exams.ts `useGenerateExam` | old schema | `question_type: string` | `question_types?: string[]`, `subject_area?`, `level?` | ✅ FIXED |
| results/page.tsx `ResultData` | missing fields | — | `score_over_20`, `passed`, `grading_status`, `ai_summary`, `weak_areas`, `study_recommendations` | ✅ FIXED |
| cohorts/[cohortId]/page.tsx | `kpis?.avg_exam_score` | `number \| null \| undefined` passed to ScoreOver20 | `?? null` coercion | ✅ FIXED |

## Loading skeletons

| Route | loading.tsx | Status |
|---|---|---|
| (org)/[slug] | ✅ | Fixed bg-slate-100→bg-slate-200 |
| (org)/[slug]/cohorts/[cohortId] | ✅ | Fixed bg-slate-100→bg-slate-200 |
| (org)/[slug]/members | ✅ | Fixed bg-slate-100→bg-slate-200 |
| (org)/[slug]/student/tasks | ✅ | Fixed bg-slate-100→bg-slate-200 |
| (org)/[slug]/students/[userId] | ✅ | Fixed bg-slate-100→bg-slate-200 |
| (app)/dashboard | ✅ ADDED | bg-slate-200 |
| (app)/goals | ✅ ADDED | bg-slate-200 |
| (app)/groups | ✅ ADDED | bg-slate-200 |
| (app)/groups/[groupId]/exams | ✅ ADDED | bg-slate-200 |
| (app)/groups/[groupId]/flashcards | ✅ ADDED | bg-slate-200 |
| (app)/groups/[groupId]/learning-paths | ✅ ADDED | bg-slate-200 |
| (app)/groups/[groupId]/chat | ❌ | NO_LOADING — chat is streaming, inline spinner used |
| (app)/groups/[groupId]/exams/[examId] | ❌ | NO_LOADING — starts session on mount, inline spinner used |
| (app)/groups/[groupId]/exams/[examId]/results/[sessionId] | ❌ | NO_LOADING — inline spinner used |
| (app)/groups/[groupId]/flashcards/[setId] | ❌ | NO_LOADING |
| (app)/groups/[groupId]/learning-paths/[pathId] | ❌ | NO_LOADING |
| (app)/groups/[groupId]/slides | ❌ | NO_LOADING |
| (app)/account | ❌ | NO_LOADING |
| (app)/analytics | ❌ | NO_LOADING |
| (app)/rooms | ❌ | NO_LOADING |

## Empty states

| Component / page | List rendered | Empty state | Status |
|---|---|---|---|
| dashboard/page.tsx | recent groups | ✅ dashed border + CTA | OK |
| dashboard/page.tsx | continue learning | ✅ dashed border | OK |
| goals/page.tsx | active goals | ✅ icon + message | OK |
| goals/page.tsx | weak areas | conditional render (no list) | OK |
| results/page.tsx | filtered corrections | ✅ ADDED | FIXED |
| (org) members page | member table | ✅ | OK |
| (org) cohort students | student table | ✅ (empty text) | OK |
| (org) student tasks | task groups | ✅ (per group) | OK |

## TypeScript
`npx tsc --noEmit` → **0 errors** ✅

---

## FE-2 — Enhanced Exam Experience

| Item | Status |
|---|---|
| `QuestionRenderer.tsx` — 8 question type components | ✅ DONE |
| `MCQMultipleInput` — multi-select with comma-joined answer | ✅ DONE |
| `OpenCalculationInput` — monospace textarea with steps hint | ✅ DONE |
| `EssayInput` — large textarea with live word count | ✅ DONE |
| `DocumentAnalysisInput` — per-sub-question textareas, JSON-serialized | ✅ DONE |
| `ConstructionPhotoInput` — camera upload, preview, calls `useUploadConstructionPhoto` | ✅ DONE |
| exam taker `page.tsx` — uses `<QuestionRenderer>`, no more `confirm()` | ✅ DONE |
| exam taker — nav buttons `w-9 h-9` + `focus:ring-2 focus:ring-indigo-500` | ✅ DONE |
| exam taker — "X / Y answered" progress text + "Worth Z pts" per question | ✅ DONE |
| `CorrectionCard` — imports `Correction` from `use-exams`, handles `is_correct: null` | ✅ DONE |
| `CorrectionCard` — shows `points_earned/points_max`, AI feedback for open types | ✅ DONE |
| results page — Brain icon on AI summary card | ✅ DONE |
| results page — study recommendations side-by-side with weak areas | ✅ DONE |
| results page — "grading pending" state in score card | ✅ DONE |
| results page — filter counts use `=== true` / `!== true` for null safety | ✅ DONE |
| `generate-exam-modal.tsx` — remove `question_type`/`topic_focus`, add `question_types` chips | ✅ DONE |
| `generate-exam-modal.tsx` — `subject_area` + `level` selects | ✅ DONE |
| `generate-exam-modal.tsx` — info chip "/20 — Moroccan curriculum" | ✅ DONE |
| `hooks/use-generate.ts` `GenerateExamPayload` — new schema | ✅ DONE |
| `GeneratePageClient.tsx` `ExamCard` — new schema, `qTypes` chips, subject/level | ✅ DONE |
| `npx tsc --noEmit` after FE-2 | **0 errors** ✅ |
