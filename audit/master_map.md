# Master Map — StudyForge Full-Stack Audit

---

## Section A — Backend Endpoint Inventory

| # | Method | Path | Auth | Handler | Notes |
|---|--------|------|------|---------|-------|
| 1 | POST | `/api/v1/auth/webhook` | Clerk-Signature | `auth.webhook` | Handles session.created, user.created, user.updated, user.deleted |
| 2 | POST | `/api/v1/analytics/reading-event` | JWT | `analytics.create_reading_event` | Upserts ReadingEvent with 5-min coalescing |
| 3 | GET | `/api/v1/groups` | JWT | `groups.list_groups` | Returns groups the user belongs to |
| 4 | POST | `/api/v1/groups` | JWT | `groups.create_group` | Creates group; user becomes owner |
| 5 | GET | `/api/v1/groups/{group_id}` | JWT | `groups.get_group` | Returns group + files |
| 6 | DELETE | `/api/v1/groups/{group_id}` | JWT+owner | `groups.delete_group` | |
| 7 | POST | `/api/v1/groups/{group_id}/invite-link` | JWT+teacher | `groups.generate_invite_link` | Returns one-time or persistent invite |
| 8 | POST | `/api/v1/groups/{group_id}/join` | JWT | `groups.join_group` | Accepts invite code |
| 9 | GET | `/api/v1/groups/{group_id}/files` | JWT+member | `files.list_files` | |
| 10 | POST | `/api/v1/groups/{group_id}/files` | JWT+member | `files.upload_file` | Multipart; enqueues process_file_task |
| 11 | GET | `/api/v1/groups/{group_id}/files/{file_id}/status` | JWT+member | `files.get_file_status` | |
| 12 | DELETE | `/api/v1/groups/{group_id}/files/{file_id}` | JWT+member | `files.delete_file` | Removes S3 object + ChromaDB chunks |
| 13 | GET | `/api/v1/groups/{group_id}/files/{file_id}/download` | JWT+member | `files.download_file` | Returns presigned GET URL (302 redirect) |
| 14 | POST | `/api/v1/groups/{group_id}/chat` | JWT+member | `chat.chat_stream` | SSE stream via RAG pipeline |
| 15 | GET | `/api/v1/groups/{group_id}/chat/history` | JWT+member | `chat.get_history` | |
| 16 | POST | `/api/v1/groups/{group_id}/chat/{message_id}/pin` | JWT+teacher | `chat.pin_message` | |
| 17 | GET | `/api/v1/groups/{group_id}/chat/pinned` | JWT+member | `chat.get_pinned` | |
| 18 | POST | `/api/v1/groups/{group_id}/exams/generate` | JWT+teacher | `exams.generate_exam` | Enqueues generate_exam_task |
| 19 | GET | `/api/v1/groups/{group_id}/exams` | JWT+member | `exams.list_exams` | |
| 20 | GET | `/api/v1/groups/{group_id}/exams/{exam_id}` | JWT+member | `exams.get_exam` | |
| 21 | POST | `/api/v1/groups/{group_id}/exams/{exam_id}/assign` | JWT+teacher | `exams.assign_exam` | Sets status→assigned, dates, attempt_limit |
| 22 | POST | `/api/v1/groups/{group_id}/exams/{exam_id}/sessions` | JWT+member | `exams.start_session` | Creates ExamSession |
| 23 | PUT | `/api/v1/groups/{group_id}/exams/{exam_id}/sessions/{session_id}` | JWT+member | `exams.autosave_session` | Autosave answers |
| 24 | POST | `/api/v1/groups/{group_id}/exams/{exam_id}/sessions/{session_id}/submit` | JWT+member | `exams.submit_session` | Grades and finalises |
| 25 | GET | `/api/v1/groups/{group_id}/exams/{exam_id}/sessions/{session_id}` | JWT+member | `exams.get_session` | |
| 26 | POST | `/api/v1/groups/{group_id}/flashcards/generate` | JWT+member | `flashcards.generate_set` | Enqueues generate_flashcards_task |
| 27 | GET | `/api/v1/groups/{group_id}/flashcards` | JWT+member | `flashcards.list_sets` | |
| 28 | GET | `/api/v1/groups/{group_id}/flashcards/{set_id}` | JWT+member | `flashcards.get_set` | |
| 29 | GET | `/api/v1/groups/{group_id}/flashcards/{set_id}/study` | JWT+member | `flashcards.get_due_cards` | Returns cards due today (SM-2) |
| 30 | POST | `/api/v1/groups/{group_id}/flashcards/{set_id}/review` | JWT+member | `flashcards.review_card` | Runs SM-2 update |
| 31 | DELETE | `/api/v1/groups/{group_id}/flashcards/{set_id}` | JWT+teacher | `flashcards.delete_set` | |
| 32 | POST | `/api/v1/groups/{group_id}/slide-decks` | JWT+teacher | `slides.create_deck` | Enqueues generate_slides_task |
| 33 | GET | `/api/v1/groups/{group_id}/slide-decks` | JWT+member | `slides.list_decks` | Includes per-user progress pct |
| 34 | GET | `/api/v1/groups/{group_id}/slide-decks/{deck_id}` | JWT+member | `slides.get_deck` | Full slides + progress + quiz answers |
| 35 | POST | `/api/v1/groups/{group_id}/slide-decks/{deck_id}/progress` | JWT+member | `slides.update_progress` | Updates current_slide_index + completed |
| 36 | POST | `/api/v1/groups/{group_id}/slide-decks/{deck_id}/slides/{slide_id}/quiz` | JWT+member | `slides.submit_quiz` | Records quiz answer |
| 37 | GET | `/api/v1/groups/{group_id}/slide-decks/{deck_id}/pptx` | JWT+member | `slides.download_pptx` | 302 redirect to S3 URL |
| 38 | DELETE | `/api/v1/groups/{group_id}/slide-decks/{deck_id}` | JWT+teacher | `slides.delete_deck` | |
| 39 | POST | `/api/v1/groups/{group_id}/learning-paths/generate` | JWT+teacher | `learning_paths.generate_path` | |
| 40 | GET | `/api/v1/groups/{group_id}/learning-paths` | JWT+member | `learning_paths.list_paths` | |
| 41 | GET | `/api/v1/groups/{group_id}/learning-paths/{path_id}` | JWT+member | `learning_paths.get_path` | |
| 42 | GET | `/api/v1/groups/{group_id}/learning-paths/{path_id}/modules/{module_id}` | JWT+member | `learning_paths.get_module` | |
| 43 | POST | `/api/v1/groups/{group_id}/learning-paths/{path_id}/progress` | JWT+member | `learning_paths.mark_module_complete` | |
| 44 | DELETE | `/api/v1/groups/{group_id}/learning-paths/{path_id}` | JWT+teacher | `learning_paths.delete_path` | |
| 45 | POST | `/api/v1/rooms` | JWT | `rooms.create_room` | |
| 46 | GET | `/api/v1/rooms/group/{group_id}` | JWT+member | `rooms.list_rooms` | |
| 47 | POST | `/api/v1/rooms/join/{invite_code}` | JWT | `rooms.join_room` | |
| 48 | DELETE | `/api/v1/rooms/{room_id}` | JWT+teacher | `rooms.close_room` | |
| 49 | GET | `/api/v1/me/continue-learning` | JWT | `me.continue_learning` | |
| 50 | GET | `/api/v1/me/account` | JWT | `me.get_account` | Returns usage + subscription + notifications |
| 51 | PATCH | `/api/v1/me/account` | JWT | `me.update_account` | |
| 52 | PATCH | `/api/v1/me/notifications` | JWT | `me.update_notifications` | |
| 53 | POST | `/api/v1/me/billing-portal` | JWT | `me.billing_portal` | Returns Stripe portal URL |
| 54 | DELETE | `/api/v1/me/account` | JWT | `me.delete_account` | Soft-delete, Clerk user removal |
| 55 | GET | `/api/v1/me/kpis` | JWT | `me.get_kpis` | Personal KPI snapshot |
| 56 | POST | `/api/v1/me/goals` | JWT | `me.create_goal` | |
| 57 | GET | `/api/v1/me/goals` | JWT | `me.list_goals` | |
| 58 | PATCH | `/api/v1/me/goals/{goal_id}` | JWT | `me.update_goal` | |
| 59 | GET | `/api/v1/me/streak` | JWT | `me.get_streak` | |
| 60 | GET | `/api/v1/me/weak-areas` | JWT | `me.get_weak_areas` | Returns `{"weak_areas": [string]}` |
| 61 | GET | `/api/v1/notifications` | JWT | `notifications.list_notifications` | |
| 62 | PUT | `/api/v1/notifications/{id}/read` | JWT | `notifications.mark_read` | |
| 63 | PUT | `/api/v1/notifications/read-all` | JWT | `notifications.mark_all_read` | |
| 64 | GET | `/api/v1/teacher/groups/{group_id}/analytics` | JWT+teacher | `teacher.group_analytics` | |
| 65 | GET | `/api/v1/teacher/groups/{group_id}/generate-history` | JWT+teacher | `teacher.generate_history` | |
| 66 | GET | `/api/v1/teacher/cohorts/{cohort_id}/live` | JWT+teacher | `teacher.cohort_live` | |
| 67 | POST | `/api/v1/teacher/cohorts/{cohort_id}/generate` | JWT+teacher | `teacher.cohort_generate` | |
| 68 | GET | `/api/v1/teacher/assignments/{assignment_id}/progress` | JWT+teacher | `teacher.assignment_progress` | |
| 69 | PATCH | `/api/v1/teacher/assignments/{assignment_id}/grade` | JWT+teacher | `teacher.grade_assignment` | |
| 70 | GET | `/api/v1/org/{slug}` | JWT+org_member | `organizations.get_org` | |
| 71 | PATCH | `/api/v1/org/{slug}` | JWT+org_admin | `organizations.update_org` | |
| 72 | GET | `/api/v1/org/{slug}/members` | JWT+org_member | `organizations.list_members` | |
| 73 | POST | `/api/v1/org/{slug}/members` | JWT+org_admin | `organizations.add_member` | |
| 74 | PATCH | `/api/v1/org/{slug}/members/{user_id}` | JWT+org_admin | `organizations.update_member` | |
| 75 | DELETE | `/api/v1/org/{slug}/members/{user_id}` | JWT+org_admin | `organizations.remove_member` | |
| 76 | GET | `/api/v1/org/{slug}/cohorts` | JWT+org_member | `organizations.list_cohorts` | |
| 77 | POST | `/api/v1/org/{slug}/cohorts` | JWT+org_admin | `organizations.create_cohort` | |
| 78 | GET | `/api/v1/org/{slug}/cohorts/{cohort_id}` | JWT+org_member | `organizations.get_cohort` | |
| 79 | PATCH | `/api/v1/org/{slug}/cohorts/{cohort_id}` | JWT+org_admin | `organizations.update_cohort` | |
| 80 | DELETE | `/api/v1/org/{slug}/cohorts/{cohort_id}` | JWT+org_admin | `organizations.delete_cohort` | |
| 81 | GET | `/api/v1/org/{slug}/cohorts/{cohort_id}/members` | JWT+org_member | `organizations.list_cohort_members` | |
| 82 | POST | `/api/v1/org/{slug}/cohorts/{cohort_id}/members` | JWT+org_admin | `organizations.add_cohort_member` | |
| 83 | DELETE | `/api/v1/org/{slug}/cohorts/{cohort_id}/members/{user_id}` | JWT+org_admin | `organizations.remove_cohort_member` | |
| 84 | GET | `/api/v1/org/{slug}/cohorts/{cohort_id}/assignments` | JWT+org_member | `organizations.list_assignments` | |
| 85 | POST | `/api/v1/org/{slug}/cohorts/{cohort_id}/assignments` | JWT+org_admin | `organizations.create_assignment` | |
| 86 | GET | `/api/v1/org/{slug}/assignments/{assignment_id}/progress` | JWT+org_member | `organizations.get_assignment_progress` | |
| 87 | PATCH | `/api/v1/org/{slug}/assignments/{assignment_id}/progress/{user_id}` | JWT+teacher | `organizations.update_assignment_progress` | |
| 88 | GET | `/api/v1/org/{slug}/kpis/overview` | JWT+org_admin | `organizations.kpis_overview` | |
| 89 | GET | `/api/v1/org/{slug}/kpis/cohorts` | JWT+org_admin | `organizations.kpis_cohorts` | |
| 90 | GET | `/api/v1/org/{slug}/kpis/cohorts/{cohort_id}` | JWT+org_admin | `organizations.kpis_cohort_detail` | |
| 91 | GET | `/api/v1/org/{slug}/kpis/at-risk` | JWT+org_admin | `organizations.at_risk_students` | |
| 92 | GET | `/api/v1/org/{slug}/kpis/students/{user_id}/timeline` | JWT+org_admin | `organizations.student_timeline` | |
| 93 | GET | `/api/v1/admin/health/overview` | JWT+super_admin | `admin.health_overview` | |
| 94 | GET | `/api/v1/admin/health/stuck-files` | JWT+super_admin | `admin.stuck_files` | |
| 95 | POST | `/api/v1/admin/health/stuck-files/{file_id}/retry` | JWT+super_admin | `admin.retry_stuck_file` | |
| 96 | POST | `/api/v1/admin/health/stuck-files/{file_id}/mark-error` | JWT+super_admin | `admin.mark_file_error` | |
| 97 | GET | `/api/v1/admin/health/dlq` | JWT+super_admin | `admin.get_dlq` | `?queue=files\|slides\|notifications` |
| 98 | POST | `/api/v1/admin/health/dlq/{message_id}/retry` | JWT+super_admin | `admin.retry_dlq` | |
| 99 | DELETE | `/api/v1/admin/health/dlq/{message_id}` | JWT+super_admin | `admin.delete_dlq` | |
| 100 | GET | `/api/v1/admin/health/ai-costs` | JWT+super_admin | `admin.ai_costs` | |
| 101 | GET | `/api/v1/admin/users/search` | JWT+super_admin | `admin.search_users` | `?q=` |
| 102 | POST | `/api/v1/admin/users/{user_id}/override-plan` | JWT+super_admin | `admin.override_plan` | |
| 103 | POST | `/api/v1/admin/users/{user_id}/suspend` | JWT+super_admin | `admin.suspend_user` | **BUG: uses `metadata=` instead of `meta=`** |
| 104 | GET | `/api/v1/admin/feature-flags` | JWT+super_admin | `admin.list_flags` | |
| 105 | PATCH | `/api/v1/admin/feature-flags/{key}` | JWT+super_admin | `admin.update_flag` | **BUG: uses `metadata=` instead of `meta=`** |

**Total backend endpoints: 105**

---

## Section B — Frontend Hook Inventory

| # | Hook | File | Query Key | TQ v5? | Notes |
|---|------|------|-----------|--------|-------|
| 1 | `useChatHistory` | `lib/hooks/use-chat.ts` | `["chat-history", groupId]` | Yes | Duplicate in `useApi.ts` as `["chat", groupId]` |
| 2 | `usePinnedMessages` | `lib/hooks/use-chat.ts` | `["pinned", groupId]` | Yes | |
| 3 | `useChat` | `lib/hooks/use-chat.ts` | manual SSE | n/a | Imperative fetch; no TQ |
| 4 | `useStreamingChat` | `lib/hooks/use-streaming-chat.ts` | manual SSE | n/a | Duplicate of useChat; invalidates `["chat", groupId]` (wrong key) |
| 5 | `useFiles` | `lib/hooks/use-files.ts` | `["files", groupId]` | Yes | Missing `chunk_count`, `indexed_at` in GroupFile interface |
| 6 | `useUploadFile` | `lib/hooks/use-files.ts` | mutation | Yes | |
| 7 | `useDeleteFile` | `lib/hooks/use-files.ts` | mutation | Yes | |
| 8 | `useExams` | `lib/hooks/use-exams.ts` | `["exams", groupId]` | Yes | |
| 9 | `useExam` | `lib/hooks/use-exams.ts` | `["exam", examId]` | Yes | |
| 10 | `useGenerateExam` | `lib/hooks/use-exams.ts` | mutation | Yes | |
| 11 | `useAssignExam` | `lib/hooks/use-exams.ts` | mutation | Yes | |
| 12 | `useStartSession` | `lib/hooks/use-exams.ts` | mutation | Yes | Sends empty body `{}` |
| 13 | `useAutosaveSession` | `lib/hooks/use-exams.ts` | mutation | Yes | |
| 14 | `useSubmitSession` | `lib/hooks/use-exams.ts` | mutation | Yes | |
| 15 | `useFlashcardSets` | `lib/hooks/use-flashcards.ts` | `["flashcard-sets", groupId]` | Yes | |
| 16 | `useFlashcardSet` | `lib/hooks/use-flashcards.ts` | `["flashcard-set", setId]` | Yes | |
| 17 | `useStudyDue` | `lib/hooks/use-flashcards.ts` | `["study-due", setId]` | Yes | |
| 18 | `useGenerateFlashcards` | `lib/hooks/use-flashcards.ts` | mutation | Yes | |
| 19 | `useReviewCard` | `lib/hooks/use-flashcards.ts` | mutation | Yes | **Schema mismatch**: interface uses `interval`/`repetitions`, backend returns `interval_days`/`reps` |
| 20 | `useDeleteFlashcardSet` | `lib/hooks/use-flashcards.ts` | mutation | Yes | |
| 21 | `useSlideDecks` | `lib/hooks/use-slides.ts` | `["slide-decks", groupId]` | Yes | |
| 22 | `useSlideDeck` | `lib/hooks/use-slides.ts` | `["slide-deck", groupId, deckId]` | Yes | |
| 23 | `useGenerateSlideDeck` | `lib/hooks/use-slides.ts` | mutation | Yes | |
| 24 | `useUpdateSlideProgress` | `lib/hooks/use-slides.ts` | mutation | Yes | |
| 25 | `useAnswerSlideQuiz` | `lib/hooks/use-slides.ts` | mutation | Yes | |
| 26 | `useDeleteSlideDeck` | `lib/hooks/use-slides.ts` | mutation | Yes | |
| 27 | `getDeckPptxUrl` | `lib/hooks/use-slides.ts` | n/a | n/a | Pure URL helper |
| 28 | `useGroups` | `lib/hooks/use-groups.ts` | `["groups"]` | Yes | Missing `color`, `my_role`, `is_archived` in Group interface |
| 29 | `useCreateGroup` | `lib/hooks/use-groups.ts` | mutation | Yes | Doesn't send `color` field |
| 30 | `useGroup` | `lib/hooks/use-groups.ts` | `["group", groupId]` | Yes | |
| 31 | `useUpdateGroup` | `lib/hooks/use-groups.ts` | mutation | Yes | |
| 32 | `useDeleteGroup` | `lib/hooks/use-groups.ts` | mutation | Yes | |
| 33 | `useGroupMembers` | `lib/hooks/use-groups.ts` | `["group-members", groupId]` | Yes | |
| 34 | `useInviteLink` | `lib/hooks/use-groups.ts` | mutation | Yes | |
| 35 | `useJoinGroup` | `lib/hooks/use-groups.ts` | mutation | Yes | |
| 36 | `useStudyRooms` | `lib/hooks/use-rooms.ts` | `["rooms", groupId]` | Yes | |
| 37 | `useCreateRoom` | `lib/hooks/use-rooms.ts` | mutation | Yes | |
| 38 | `useJoinRoom` | `lib/hooks/use-rooms.ts` | mutation | Yes | |
| 39 | `useCloseRoom` | `lib/hooks/use-rooms.ts` | mutation | Yes | |
| 40 | `useLearningPaths` | `lib/hooks/use-learning-paths.ts` | `["learning-paths", groupId]` | Yes | |
| 41 | `useLearningPath` | `lib/hooks/use-learning-paths.ts` | `["learning-path", pathId]` | Yes | |
| 42 | `useLearningPathModule` | `lib/hooks/use-learning-paths.ts` | `["lp-module", moduleId]` | Yes | |
| 43 | `useGenerateLearningPath` | `lib/hooks/use-learning-paths.ts` | mutation | Yes | |
| 44 | `useMarkModuleComplete` | `lib/hooks/use-learning-paths.ts` | mutation | Yes | |
| 45 | `useDeleteLearningPath` | `lib/hooks/use-learning-paths.ts` | mutation | Yes | |
| 46 | `useGroupAnalytics` | `lib/hooks/use-teacher.ts` | `["teacher-analytics", groupId]` | Yes | StudentStat missing `files_read`, `active_minutes` |
| 47 | `useOrg` | `lib/hooks/use-org.ts` | `["org", slug]` | Yes | |
| 48 | `useUpdateOrg` | `lib/hooks/use-org.ts` | mutation | Yes | |
| 49 | `useOrgMembers` | `lib/hooks/use-org.ts` | `["org-members", slug]` | Yes | |
| 50 | `useAddOrgMember` | `lib/hooks/use-org.ts` | mutation | Yes | |
| 51 | `useUpdateOrgMember` | `lib/hooks/use-org.ts` | mutation | Yes | |
| 52 | `useRemoveOrgMember` | `lib/hooks/use-org.ts` | mutation | Yes | |
| 53 | `useContinueLearning` | `lib/hooks/use-continue-learning.ts` | `["continue-learning", limit]` | Yes | |
| 54 | `usePersonalKpis` | `lib/hooks/use-individual-kpis.ts` | `["personal-kpis"]` | Yes | **Schema mismatch**: 6+ field name mismatches vs backend |
| 55 | `useStreakData` | `lib/hooks/use-individual-kpis.ts` | `["streak"]` | Yes | `current_streak`/`longest_streak` vs backend `current`/`longest` |
| 56 | `useWeakAreas` | `lib/hooks/use-individual-kpis.ts` | `["weak-areas"]` | Yes | Expects `{concept, frequency}` objects; backend returns `string[]` |
| 57 | `useOrgKpisOverview` | `lib/hooks/use-org-kpis.ts` | `["org-kpis-overview", slug]` | Yes | `total_members` missing in backend response |
| 58 | `useOrgCohortKpis` | `lib/hooks/use-org-kpis.ts` | `["org-cohort-kpis", slug]` | Yes | `cohort_name` vs backend `name` |
| 59 | `useOrgCohortDetail` | `lib/hooks/use-org-kpis.ts` | `["org-cohort-detail", slug, cohortId]` | Yes | |
| 60 | `useAtRiskStudents` | `lib/hooks/use-org-kpis.ts` | `["at-risk", slug]` | Yes | `days_inactive` vs backend `reason_flags` array |
| 61 | `useStudentTimeline` | `lib/hooks/use-org-kpis.ts` | `["student-timeline", slug, userId]` | Yes | |
| 62 | `useAssignments` | `lib/hooks/use-assignments.ts` | `["assignments", slug, cohortId]` | Yes | |
| 63 | `useAssignmentProgress` | `lib/hooks/use-assignments.ts` | `["assignment-progress", slug, assignmentId]` | Yes | |
| 64 | `useCreateAssignment` | `lib/hooks/use-assignments.ts` | mutation | Yes | |
| 65 | `useUpdateAssignmentProgress` | `lib/hooks/use-assignments.ts` | mutation | Yes | |
| 66 | `useCohorts` | `lib/hooks/use-cohorts.ts` | `["cohorts", slug]` | Yes | |
| 67 | `useCohort` | `lib/hooks/use-cohorts.ts` | `["cohort", slug, cohortId]` | Yes | |
| 68 | `useCohortMembers` | `lib/hooks/use-cohorts.ts` | `["cohort-members", slug, cohortId]` | Yes | |
| 69 | `useCreateCohort` | `lib/hooks/use-cohorts.ts` | mutation | Yes | |
| 70 | `useAddCohortMember` | `lib/hooks/use-cohorts.ts` | mutation | Yes | |
| 71 | `useRemoveCohortMember` | `lib/hooks/use-cohorts.ts` | mutation | Yes | |
| 72 | `useReadingTracker` | `lib/hooks/use-reading-tracker.ts` | n/a (effect) | n/a | Direct fetch; sends every 30s + beforeunload |
| 73 | `useRoomPresence` | `lib/hooks/use-room-presence.ts` | n/a (Supabase realtime) | n/a | Supabase Realtime presence; graceful no-op when supabaseEnabled=false |
| 74 | `useAccount` | `hooks/use-account.ts` | `["account"]` | Yes | |
| 75 | `useUpdateAccount` | `hooks/use-account.ts` | mutation | Yes | |
| 76 | `useUpdateNotifications` | `hooks/use-account.ts` | mutation | Yes | |
| 77 | `useBillingPortal` | `hooks/use-account.ts` | mutation | Yes | |
| 78 | `useDeleteAccount` | `hooks/use-account.ts` | mutation | Yes | |
| 79 | `useHealthOverview` | `hooks/use-admin-health.ts` | `["admin-health-overview"]` | Yes | Polls every 15s |
| 80 | `useStuckFiles` | `hooks/use-admin-health.ts` | `["admin-stuck-files", minutes]` | Yes | |
| 81 | `useRetryStuckFile` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 82 | `useMarkFileError` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 83 | `useDlqMessages` | `hooks/use-admin-health.ts` | `["admin-dlq", queue]` | Yes | |
| 84 | `useRetryDlqMessage` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 85 | `useDeleteDlqMessage` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 86 | `useAiCosts` | `hooks/use-admin-health.ts` | `["admin-ai-costs"]` | Yes | |
| 87 | `useAdminUserSearch` | `hooks/use-admin-health.ts` | `["admin-user-search", q]` | Yes | Enabled only when q.length >= 2 |
| 88 | `useOverrideUserPlan` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 89 | `useSuspendUser` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 90 | `useFeatureFlags` | `hooks/use-admin-health.ts` | `["admin-feature-flags"]` | Yes | |
| 91 | `useUpdateFeatureFlag` | `hooks/use-admin-health.ts` | mutation | Yes | |
| 92 | `useGroupFilesForGenerate` | `hooks/use-generate.ts` | `["files-generate", groupId]` | Yes | Polls at 5s when uploading/processing |
| 93 | `useGenerateExam` | `hooks/use-generate.ts` | mutation | Yes | Duplicate of #10 |
| 94 | `useGenerateFlashcards` | `hooks/use-generate.ts` | mutation | Yes | Duplicate of #18 |
| 95 | `useGeneratePath` | `hooks/use-generate.ts` | mutation | Yes | |
| 96 | `useGenerateSlides` | `hooks/use-generate.ts` | mutation | Yes | Duplicate of #23 |
| 97 | `usePollSlideDeck` | `hooks/use-generate.ts` | `["slide-deck-poll", groupId, deckId]` | Yes | Backs off to 10s after 10 ticks |
| 98 | `useGenerationHistory` | `hooks/use-generate.ts` | `["generate-history", groupId]` | Yes | |
| 99 | `useGroups` (useApi) | `lib/hooks/useApi.ts` | `["groups"]` | Yes | Duplicate |
| 100 | `useGroup` (useApi) | `lib/hooks/useApi.ts` | `["groups", groupId]` | Yes | |
| 101 | `useGroupFiles` (useApi) | `lib/hooks/useApi.ts` | `["files", groupId]` | Yes | Duplicate; partial GroupFile interface |
| 102 | `useTeacherAnalytics` (useApi) | `lib/hooks/useApi.ts` | `["analytics", groupId]` | Yes | Different key from use-teacher.ts |
| 103 | `useNotifications` (useApi) | `lib/hooks/useApi.ts` | `["notifications"]` | Yes | Swallows errors, returns `[]` |

**Total hooks/reactive utilities: 103 (including 12 duplicates across files)**

---

## Section C — Gap Matrix

| Feature Area | Backend Endpoint | Frontend Hook | Notes |
|---|---|---|---|
| Auth / Clerk webhook | ✅ 103 | ✅ Clerk SDK (middleware) | — |
| Reading events (analytics) | ✅ 102 | ✅ useReadingTracker | Hook sends `scroll_depth_pct` as float (0–1), backend expects int 0–100 — MISMATCH |
| Groups CRUD | ✅ 103–108 | ✅ use-groups.ts | `color` field missing in create mutation |
| Files | ✅ 109–113 | ✅ use-files.ts | `indexed_at` missing in GroupFile interface |
| Chat / RAG stream | ✅ 114–117 | ⚠️ use-chat.ts + use-streaming-chat.ts | Two competing implementations; wrong invalidation key in streaming variant |
| Exams | ✅ 118–125 | ✅ use-exams.ts | Full coverage |
| Flashcards | ✅ 126–131 | ⚠️ use-flashcards.ts | `interval`/`repetitions` vs `interval_days`/`reps` |
| Slide decks | ✅ 132–139 | ✅ use-slides.ts + use-generate.ts | Overlap between useSlideDeck and usePollSlideDeck |
| Learning paths | ✅ 139–144 | ✅ use-learning-paths.ts | Full coverage |
| Study rooms | ✅ 145–148 | ✅ use-rooms.ts | Presence via Supabase realtime (optional) |
| Me / Account | ✅ 149–160 | ✅ hooks/use-account.ts | Full coverage |
| Personal KPIs | ✅ me/kpis | ⚠️ use-individual-kpis.ts | 6+ field name mismatches |
| Streak | ✅ me/streak | ⚠️ use-individual-kpis.ts | `current`/`longest` vs `current_streak`/`longest_streak` |
| Weak areas | ✅ me/weak-areas | ⚠️ use-individual-kpis.ts | Backend returns `string[]`; hook expects `{concept,frequency}[]` |
| Goals | ✅ me/goals (POST/GET/PATCH) | ❌ No dedicated hook | No hook found; useApi.ts doesn't cover goals |
| Notifications | ✅ 161–163 | ⚠️ useApi.ts useNotifications | Swallows errors; returns []; no mutation hooks for read/read-all |
| Notification read/read-all | ✅ 162–163 | ❌ Missing | No hook for PUT /{id}/read or PUT /read-all |
| Teacher analytics | ✅ 164–169 | ⚠️ use-teacher.ts | StudentStat missing `files_read`, `active_minutes` |
| Organizations | ✅ 170–192 | ✅ use-org.ts + use-cohorts.ts + use-assignments.ts | Full coverage |
| Org KPIs | ✅ 188–192 | ⚠️ use-org-kpis.ts | `total_members`, `cohort_name`, `days_inactive` field mismatches |
| Admin health | ✅ 193–202 | ✅ hooks/use-admin-health.ts | Full coverage |
| Admin feature flags | ✅ 203–205 | ✅ hooks/use-admin-health.ts | Full coverage |
| Presigned upload URL | ❌ Missing | ❌ Missing | `storage_service.py` has no `get_presigned_put_url`; direct upload path is multipart POST |
| Continue learning | ✅ me/continue-learning | ✅ use-continue-learning.ts | Full coverage |
