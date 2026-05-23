# StudyForge — Complete Build Prompts

Copy the **Project Context** block at the top of every prompt before sending it to Claude.
Each prompt is self-contained and production-ready.

---

## Project Context (paste this at the start of every prompt)

```
Project: StudyForge — AI-powered educational platform for Morocco.

Backend stack:
- Python 3.11, FastAPI 0.111, SQLAlchemy 2.0 async, Pydantic v2, Alembic
- PostgreSQL 16 + TimescaleDB, Redis 5, Celery 5.4, ChromaDB 0.5
- AI: Google Gemini (gemini-2.5-flash + text-multilingual-embedding-002) as default; claude_vertex / bedrock / nvidia / ollama as alternates via BaseAIProvider ABC in app/services/ai_service.py
- Storage: Google Cloud Storage (primary), MinIO locally
- Auth: Clerk JWT via get_current_user() in app/core/security.py
- RBAC: require_permission(resource_type, path_param, min_role) in app/core/permissions.py
- Background: Celery queues — files, notifications, slides, analytics
- Notifications: SendGrid (email), Twilio (WhatsApp + SMS)

Frontend stack:
- Next.js 15 App Router, TypeScript 5, Tailwind CSS 3.4
- Auth: Clerk 7 (JWT, hooks: useUser, useAuth)
- Server state: TanStack Query v5
- UI state: Zustand 5
- HTTP: Axios instance in lib/api.ts with Clerk JWT interceptor
- Streaming chat: native fetch + ReadableStream SSE in lib/hooks/use-streaming-chat.ts

Conventions:
- All authenticated routes use Depends(get_current_user)
- New models must be added to app/models/__init__.py
- Heavy work goes to Celery, choose the right queue
- API prefix: /api/v1/
- Frontend API calls go through lib/api.ts
- Use TanStack Query hooks pattern from lib/hooks/
```

---

## Part 1 — Critical Fixes

### 1.1 Pagination on all list endpoints

```
[paste project context]

Add cursor-based pagination to all list endpoints in the FastAPI backend.

Currently these endpoints return unbounded lists which will break under load:
- GET /groups/{id}/files
- GET /groups/{id}/exams
- GET /groups/{id}/flashcards
- GET /groups/{id}/learning-paths
- GET /groups/{id}/slide-decks
- GET /groups/{id}/members
- GET /notifications
- GET /admin/users/search

Task:
1. Create a reusable pagination utility in app/core/pagination.py:
   - PaginationParams (limit: int = 20, cursor: str | None = None) as a FastAPI Depends
   - PageResponse[T] generic Pydantic schema: { items: List[T], next_cursor: str | None, total: int }
   - cursor is base64-encoded last item ID + timestamp for stable ordering

2. Apply PaginationParams to all the list endpoints above using SQLAlchemy .limit() and .where(id > cursor)

3. Return PageResponse for each

4. Update the corresponding TanStack Query hooks in apps/web/lib/hooks/ to use useInfiniteQuery with getNextPageParam reading next_cursor

5. Add "Load more" button to each list component in the frontend

Show complete code for pagination.py, one example updated route (files), and the updated React hook.
```

---

### 1.2 File type and size validation

```
[paste project context]

Add server-side file validation to the file upload endpoint POST /api/v1/groups/{id}/files.

Requirements:
1. In the FastAPI route (app/api/v1/files.py), before dispatching to Celery:
   - Check file MIME type using python-magic (not just extension — extensions are spoofable)
   - Allowed types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation, text/plain, image/jpeg, image/png, image/webp
   - Raise HTTP 415 if type is not allowed

2. Enforce file size limits from app/core/plans.py based on the user's current plan:
   - Free: 10MB max
   - Personal: 50MB max
   - School: 200MB max
   - Raise HTTP 413 with a clear message if exceeded

3. Add the file size limits to app/core/plans.py plan definitions

4. In the frontend file upload component, add client-side pre-checks (same limits) with clear error toasts before the upload even starts — give instant feedback, don't wait for the server

5. Show a file type badge on each file card in the UI (PDF, DOCX, PPTX, TXT, Image)

Show complete backend validation code and the updated frontend upload component with error states.
```

---

### 1.3 Celery retry policy and dead-letter queue

```
[paste project context]

Add proper retry policy and dead-letter queue handling to all Celery tasks.

Currently failed tasks silently die with no recovery path.

Task:
1. In app/tasks/celery_app.py, configure task_routes and default retry policy:
   - autoretry_for = (Exception,)
   - max_retries = 3
   - retry_backoff = True (exponential: 60s, 120s, 240s)
   - retry_jitter = True

2. For process_file_task specifically:
   - On final failure (after 3 retries), update the file status to ERROR with a descriptive error_message in the DB
   - Send an in-app notification to the file owner explaining the failure
   - Log the full exception to Sentry

3. Create a dead-letter mechanism: add a failed_tasks table (task_id, task_name, args, error, created_at, retried_at) and write to it on final failure

4. Add a user-facing retry endpoint: POST /api/v1/groups/{id}/files/{fid}/retry — allows the file owner (not just admin) to re-queue a failed file. Check file status == ERROR before allowing.

5. Add a "Retry" button to the frontend file list for files in ERROR state

Show complete code: celery_app.py changes, updated process_file_task, the retry endpoint, and the frontend retry button.
```

---

### 1.4 Group update endpoint

```
[paste project context]

Add PATCH /api/v1/groups/{id} endpoint to allow updating a group after creation.

Currently groups are immutable — no update endpoint exists.

Task:
1. Create GroupUpdate Pydantic schema (all fields optional):
   - name: str | None
   - color: str | None (hex color)
   - visibility: str | None ("public" | "private")
   - school_id: int | None

2. Add PATCH /api/v1/groups/{id} route in app/api/v1/groups.py:
   - require_permission for "owner" or "teacher" role
   - Partial update: only update fields that are not None
   - Return updated GroupResponse

3. In the frontend, add a group settings page or modal at groups/[groupId]/settings:
   - Form with name, color picker, visibility toggle
   - Uses PATCH via TanStack Query mutation
   - Optimistic update so the UI reflects changes instantly
   - Accessible from a settings icon in the group header

Show complete backend route, schema, and frontend settings form component.
```

---

### 1.5 Question-level CRUD after exam generation

```
[paste project context]

Add the ability for teachers to edit, add, and delete individual questions in an exam after AI generation.

Currently there is no question-level management — the exam is immutable after generation.

Task:
1. Add these FastAPI routes in app/api/v1/exams.py:
   - PATCH /groups/{id}/exams/{eid}/questions/{qid} — edit question content, options, correct_answer, points, difficulty
   - DELETE /groups/{id}/exams/{eid}/questions/{qid} — delete a question (recalculate exam total_points)
   - POST /groups/{id}/exams/{eid}/questions — manually add a new question (full QuestionCreate schema)
   - POST /groups/{id}/exams/{eid}/questions/{qid}/duplicate — duplicate a question for easy editing
   All require teacher/owner role. Only allow editing exams that have no active sessions (status != "active").

2. Add QuestionUpdate and QuestionCreate Pydantic schemas

3. In the frontend exam editor (groups/[groupId]/exams):
   - Show questions in an editable list after generation
   - Inline edit: click any question to open an edit form
   - Delete button per question with confirmation
   - "Add question manually" button opens a blank question form
   - Support question types: MCQ (with 4 option inputs + correct answer selector), open-ended (with model answer textarea), Moroccan Bac-style

Show complete backend routes, schemas, and the frontend question editor component.
```

---

### 1.6 ChromaDB cleanup on group and file delete

```
[paste project context]

Ensure ChromaDB vector embeddings are properly cleaned up when files or groups are deleted.

Currently: file delete says it handles embeddings, but group delete does not mention ChromaDB cleanup, leaving orphaned embeddings forever.

Task:
1. In app/services/vector_store.py, ensure these methods exist and work correctly:
   - delete_file_embeddings(file_id: str) — delete all vectors with metadata file_id == file_id
   - delete_group_collection(group_id: str) — delete the entire ChromaDB collection for this group
   - Both should handle the case where the collection/document doesn't exist (no-op, no exception)

2. In app/api/v1/files.py DELETE handler:
   - After DB deletion, call vector_store.delete_file_embeddings(file_id) in a try/except (don't fail the delete if ChromaDB is temporarily unavailable — log the error and schedule cleanup)

3. In app/api/v1/groups.py DELETE handler:
   - After DB deletion, dispatch a Celery task delete_group_vectors_task to the files queue
   - This task calls vector_store.delete_group_collection(group_id) and logs the result

4. Add delete_group_vectors_task to app/tasks/file_tasks.py

Show complete code for all four changes.
```

---

### 1.7 Audit log retrieval endpoint

```
[paste project context]

The audit_logs table exists and is being written to, but there is no read endpoint. Add admin access to audit logs.

Task:
1. Add GET /api/v1/admin/audit-logs in app/api/v1/admin.py:
   - Requires super_admin role
   - Filters: actor_id (optional), resource_type (optional), resource_id (optional), action (optional), date_from, date_to
   - Cursor-based pagination (use the pagination utility from Part 1.1)
   - Returns: list of AuditLogResponse (id, actor_id, actor_email, action, resource_type, resource_id, created_at, metadata)

2. Add AuditLogResponse Pydantic schema

3. Add an Audit Logs page in apps/web/app/(app)/admin/audit-logs/:
   - Filterable table: search by user email, filter by resource_type dropdown, date range picker
   - Each row shows: timestamp, actor, action, resource_type + resource_id
   - Expandable row to show raw metadata JSON
   - Export as CSV button

Show complete backend route and frontend audit log page.
```

---

## Part 2 — Morocco-Specific Features

### 2.1 Arabic + French bilingual UI with RTL support

```
[paste project context]

Add full bilingual support (Arabic + French) to the Next.js frontend with proper RTL layout for Arabic.

Task:
1. Set up next-intl for i18n in apps/web:
   - Locales: ar (Arabic, RTL), fr (French, LTR)
   - Default locale: fr
   - Locale detection from browser, with manual override saved to user profile

2. Create translation files at apps/web/messages/ar.json and fr.json:
   - Cover all UI strings: navigation, buttons, headings, error messages, empty states
   - Arabic strings should use proper Modern Standard Arabic (MSA) for academic context

3. RTL layout handling:
   - Set dir="rtl" on <html> when locale is ar
   - Use Tailwind's rtl: and ltr: variants for directional spacing and flex direction
   - Reverse icon positions, breadcrumb arrows, sidebar direction
   - Test: sidebar should be on the right in Arabic, left in French

4. In the user account settings page, add a language switcher (FR / العربية) that:
   - Updates the locale immediately
   - Saves the preference to PATCH /api/v1/me/account
   - Persists across sessions

5. Add Accept-Language header reading in the backend for API error messages — return error text in the user's language

6. In the backend, add a language field to the users table (default: 'fr', options: 'ar', 'fr')

Show complete next-intl setup, sample translation files, RTL layout changes, and the language switcher component.
```

---

### 2.2 Bac exam preparation mode

```
[paste project context]

Build a dedicated Baccalauréat preparation mode — the most important exam for Moroccan students.

Task:

Backend:
1. Create a bac_papers table:
   - id, year (int), branch (enum: SM, SE, SEco, SH, SAgro, SA, Lettres, Arts), subject, region (nationale/régionale), session (normale/rattrapage), file_id (FK to files), created_at

2. Add these routes in a new app/api/v1/bac.py:
   - GET /bac/papers — list papers with filters: year, branch, subject, session
   - POST /bac/papers — admin uploads a past paper (links to an uploaded file)
   - POST /bac/practice — create a timed practice session from a past paper
   - GET /bac/practice/{session_id} — get session with questions
   - POST /bac/practice/{session_id}/submit — submit and auto-grade
   - GET /bac/stats — user's Bac practice stats: average score by subject, improvement over time

3. Create a BacService in app/services/bac_service.py:
   - Uses AIService to extract questions from Bac paper PDFs
   - Grades open-ended answers against official rubrics (uses Moroccan marking scheme: 0-20 scale)
   - Gives detailed feedback per question in both Arabic and French

Frontend:
4. Add a dedicated /bac route in the app:
   - Branch selector (SM, SE, SEco, SH...) → Subject selector → Year filter
   - Paper browser with difficulty indicators
   - Timed exam mode: countdown timer, one question at a time, no going back (simulates real exam)
   - Results page: score out of 20, question-by-question breakdown, AI feedback
   - Progress tracker: score history chart per subject over multiple attempts

Show complete backend models, service, routes, and the Bac prep frontend pages.
```

---

### 2.3 Moroccan curriculum alignment by level and branch

```
[paste project context]

Align the curriculum system to the full Moroccan education structure: Primaire → Collège → Lycée, with all official branches and subjects.

Task:

Backend:
1. Expand app/services/curriculum_service.py with the full Moroccan curriculum tree:
   - Levels: primaire (1-6), college (1-3, called 1AC/2AC/3AC), lycee (TC, 1Bac, 2Bac)
   - Lycée branches (2Bac): Sciences Mathématiques A&B, Sciences Expérimentales, Sciences de la Vie et de la Terre, Sciences Économiques et Gestion, Sciences Humaines, Arts Appliqués, Sciences Agro, Lettres
   - Subjects per branch from the official MEN programme

2. Create a moroccan_curriculum table:
   - level, grade, branch, subject, chapter_number, chapter_title_fr, chapter_title_ar, learning_objectives (JSON array), exam_weight (float — % of Bac mark)

3. Add GET /curriculum/tree — returns the full curriculum tree (cached in Redis, 24h TTL)
4. Add GET /curriculum/{level}/{grade}/{branch}/subjects — subjects for a specific track
5. Add POST /curriculum/align — given a list of document chunks, return which curriculum chapters they cover (uses LLM classification)

Frontend:
6. In the group creation flow, add optional curriculum alignment:
   - "What level is this group for?" → level → grade → branch
   - This tags the group and enables curriculum-aligned exam generation
7. In exam generation, show which curriculum objectives the generated questions cover
8. Add a curriculum progress view: show which chapters have been studied and which are missing

Show complete curriculum data structure (at least one full branch), backend routes, and the curriculum alignment UI.
```

---

### 2.4 Local payment integration (CMI)

```
[paste project context]

Add Moroccan local payment methods alongside Stripe and PayPal. Most Moroccan students cannot use Stripe (requires international card).

The primary target is CMI (Centre Monétique Interbancaire) which covers CIH, Attijariwafa, BMCE, Banque Populaire, and Barid Bank cards.

Task:

Backend:
1. Create app/services/payment_service_cmi.py:
   - CMI uses a redirect-based payment flow (similar to PayPal)
   - Implement: initiate_payment(amount, currency='MAD', order_id, return_url, cancel_url) → returns redirect URL
   - Implement: verify_callback(params: dict) → validates HMAC signature from CMI callback
   - CMI sandbox credentials go in .env as CMI_MERCHANT_ID, CMI_STORE_KEY, CMI_API_URL

2. Add POST /api/v1/me/subscribe-cmi:
   - Creates a pending subscription record
   - Calls CMI initiate_payment
   - Returns {redirect_url} for the frontend to redirect to

3. Add POST /api/v1/webhooks/cmi:
   - Receives CMI payment callback (GET or POST with HMAC params)
   - Validates HMAC signature using store key
   - On success: activate subscription, same logic as Stripe webhook handler
   - Returns "ACTION=POSTAUTH" (CMI protocol requirement)

4. Add 'cmi' as a payment_method option in the subscriptions table

Frontend:
5. In the pricing page /pricing:
   - Show "Pay with Moroccan card (CMI)" button alongside Stripe
   - On click: call /me/subscribe-cmi, then redirect to CMI payment page
   - On return from CMI: show success/failure state based on URL params
6. Show "Carte Marocaine" badge with bank logos (CIH, Attijariwafa, BMCE etc.) for Moroccan users

Show complete CMI service, webhook handler, and pricing page payment options.
```

---

### 2.5 Low-bandwidth mode

```
[paste project context]

Add a low-bandwidth mode for students with poor internet connections (rural Morocco).

Task:

Frontend:
1. Detect connection quality using Navigator.connection API (effectiveType: slow-2g, 2g, 3g, 4g)
2. Create a useBandwidth() hook in apps/web/hooks/ that:
   - Reads navigator.connection.effectiveType
   - Listens for 'change' events
   - Returns: { isLowBandwidth: boolean, connectionType: string }

3. When isLowBandwidth is true:
   - Disable auto-playing animations and transitions
   - Replace image thumbnails with text placeholders
   - Disable video previews
   - Use text-only chat mode (disable file preview in chat)
   - Show a banner: "Mode faible connexion activé" with option to override

4. Add a manual toggle in user settings: "Mode connexion lente" — overrides auto-detection

5. In the chat SSE streaming hook (use-streaming-chat.ts):
   - In low-bandwidth mode, buffer the stream and show it in larger chunks (every 500ms) instead of token-by-token — reduces render thrashing on slow devices

6. Add Next.js Image optimization config for quality: 60 in low-bandwidth mode

Backend:
7. Add a low_bandwidth_mode boolean field to users table
8. When low_bandwidth_mode is true, the RAG chat endpoint returns plain text only (no markdown, no citations formatting) — reduces response size by ~40%

Show complete bandwidth hook, settings toggle, and backend streaming adjustment.
```

---

### 2.6 Moroccan textbook pre-loading

```
[paste project context]

Pre-load official Moroccan MEN (Ministère de l'Éducation Nationale) textbooks so students can instantly start studying without uploading anything.

Task:

Backend:
1. Create a system_files table:
   - id, title_fr, title_ar, level, grade, branch, subject, academic_year, source_url, file_path (GCS), status, created_at

2. Create a management command (scripts/seed_textbooks.py):
   - Downloads official textbook PDFs from manuelscolaires.men.gov.ma (publicly available)
   - Uploads to GCS under a system/ prefix
   - Inserts records into system_files
   - Run as a one-time seeder and re-run annually when new editions release

3. Add GET /api/v1/textbooks:
   - Filters: level, grade, branch, subject
   - Returns list of available textbooks (no auth required — public endpoint)

4. Add POST /api/v1/groups/{id}/textbooks/{textbook_id}:
   - Copies the system file into the group (creates a new files record pointing to same GCS object)
   - Triggers process_file_task to embed it into ChromaDB for that group
   - Requires teacher/owner role

5. Cache the textbook list in Redis (TTL 1 hour)

Frontend:
6. Add a "Add textbook" button in the group files section:
   - Opens a modal with level/grade/branch/subject filters
   - Shows matching official textbooks with cover thumbnails
   - One-click to add to group — no upload needed
   - Shows "Official MEN textbook" badge

Show complete backend models, seeder script, routes, and the textbook picker modal.
```

---

## Part 3 — Core Learning Enhancements

### 3.1 AI Socratic tutor mode

```
[paste project context]

Add a Socratic tutor mode to the RAG chat — instead of giving direct answers, the AI guides students to discover answers through questions.

Task:

Backend:
1. Add a chat_mode field to chat_messages (or as a query param): "direct" (current default) | "socratic"
2. In app/services/rag_service.py, add a Socratic system prompt variant:
   - Never directly answer the student's question
   - Ask 1-2 guiding questions that point toward the answer
   - Use the retrieved context to frame questions, not to provide answers
   - If the student is stuck after 3 exchanges, offer a hint (not the full answer)
   - Acknowledge correct reasoning and build on it
   - Language: respond in the same language the student used (Arabic or French)

3. Add POST /api/v1/groups/{id}/chat/mode — saves the user's preferred chat mode per group

Frontend:
4. Add a toggle in the chat header: "Mode direct / Mode Socratique"
   - Persists per group in localStorage and syncs to backend
   - In Socratic mode, show a subtle indicator on the chat input placeholder: "Posez votre question — je vais vous guider..."
5. In Socratic mode, after the AI responds with a question, show suggested response starters as quick-reply chips (e.g., "Je pense que...", "Est-ce que c'est...") to help hesitant students engage

Show complete prompt engineering for Socratic mode, backend changes, and frontend toggle.
```

---

### 3.2 Adaptive difficulty

```
[paste project context]

Make exam generation and flashcard difficulty adapt automatically based on each student's performance history.

Task:

Backend:
1. Create a student_mastery table:
   - user_id, group_id, topic (text — extracted from question), mastery_score (0.0-1.0), last_updated
   - Updated after every exam session submission and flashcard review

2. In app/services/exam_service.py, add adaptive generation:
   - Before generating, query student_mastery for the requesting user in this group
   - Pass mastery scores to the AI prompt: "Student has mastered: [topics]. Student struggles with: [topics]. Generate more questions on weak areas, fewer on mastered areas."
   - Include difficulty distribution in the prompt: e.g., 40% hard on weak topics, 40% medium, 20% easy on mastered topics

3. In app/services/flashcard_service.py, modify SM-2 scheduling:
   - When mastery_score < 0.4 for a topic, halve the SM-2 interval (review sooner)
   - When mastery_score > 0.8, allow the interval to grow 20% faster than standard SM-2

4. After each exam session submission, call update_student_mastery(user_id, group_id, session_results) in background

5. Add GET /api/v1/groups/{id}/my-mastery — returns current mastery by topic as {topic, mastery_score, question_count}

Frontend:
6. Show a mastery radar chart on the student's group page — one axis per major topic, filled based on mastery_score
7. In exam generation form, show "Personalized for your level" toggle — when on, uses adaptive difficulty

Show complete mastery tracking service, adaptive generation prompt, and mastery radar chart component.
```

---

### 3.3 PDF annotation and notes

```
[paste project context]

Let students highlight text in uploaded documents and add personal notes that are searchable and can generate flashcards.

Task:

Backend:
1. Create an annotations table:
   - id, user_id, file_id, page_number, selected_text (text), note (text nullable), color (hex), created_at
   - One user can have many annotations on the same file

2. Add these routes in app/api/v1/annotations.py:
   - POST /files/{fid}/annotations — create annotation (selected_text + optional note + color + page)
   - GET /files/{fid}/annotations — list user's annotations for a file
   - PATCH /files/{fid}/annotations/{aid} — update note text
   - DELETE /files/{fid}/annotations/{aid} — delete annotation
   - POST /files/{fid}/annotations/to-flashcards — convert all annotations for this file into a flashcard set using AI (front = selected_text, back = AI-generated explanation)

3. Add GET /me/annotations — all annotations across all groups (for personal notes view)

Frontend:
4. In the file viewer component, integrate PDF.js for rendering:
   - Allow text selection → show a small popup: highlight color options (yellow, blue, pink, green) + "Add note" input
   - Render existing annotations as colored highlights on the PDF pages
   - Sidebar panel showing all annotations for the current file, grouped by page
   - Click an annotation in the sidebar to jump to that page

5. Add a "My Notes" section in the dashboard showing recent annotations across all groups

6. "Convert to flashcards" button in the annotations panel

Show complete annotations model, routes, PDF.js integration with highlight rendering, and the annotation sidebar component.
```

---

### 3.4 Math equation editor and step-by-step solver

```
[paste project context]

Add LaTeX/KaTeX equation support throughout the platform — critical for Moroccan SM and SE Bac students.

Task:

Frontend:
1. Install react-katex and katex in apps/web
2. Create a MathRenderer component that:
   - Detects $...$ (inline) and $$...$$ (block) LaTeX in any text string
   - Renders them with KaTeX
   - Falls back to plain text on KaTeX parse error
   - Apply MathRenderer to: chat messages, exam questions, flashcard front/back, learning path content

3. Create a MathInput component:
   - Text area with a KaTeX preview below it in real time
   - Toolbar with common math symbols: fractions, integrals, summations, Greek letters, limits
   - Used in: exam question editor, chat input (toggle math mode), flashcard creation

4. In the chat input, add a "∑" button to toggle math mode — wraps typed content in $$ and shows preview

Backend:
5. In app/services/ai_service.py, update system prompts to:
   - Always render math using LaTeX notation ($...$ and $$...$$)
   - For photo-solve and step-by-step: return each step as a separate numbered LaTeX block
   - Format: {"steps": [{"step_number": 1, "explanation": "...", "latex": "$$...$$"}], "final_answer": "$$...$$"}

6. Update POST /files/solve/photo response schema to return the structured step-by-step format above

7. Create a StepByStepSolution frontend component:
   - Shows each step in a card with the explanation and the rendered LaTeX
   - Reveal one step at a time (student tries each step before seeing the next)
   - "Show all steps" button for when they give up

Show complete KaTeX setup, MathRenderer, MathInput, step reveal component, and backend prompt changes.
```

---

## Part 4 — Student Experience

### 4.1 Personal AI study planner

```
[paste project context]

Build an AI-generated personal study schedule based on the student's upcoming exams, weak areas, and available time.

Task:

Backend:
1. Create a study_plans table:
   - id, user_id, week_start (date), generated_at, plan_json (JSONB), status (active/archived)
   - plan_json schema: { days: [{ date, slots: [{ time, duration_minutes, group_id, activity_type, topic, resource_id }] }] }

2. Add these routes in app/api/v1/planner.py:
   - POST /me/study-plan/generate — generates a new week plan
   - GET /me/study-plan — returns current active plan
   - PATCH /me/study-plan/slots/{slot_id}/complete — marks a slot as done (awards XP)
   - GET /me/study-plan/history — past plans and completion rates

3. In app/services/planner_service.py:
   - Gather inputs: upcoming exam deadlines (from exams table), student's mastery scores (weak areas), active flashcard due counts, user's stated available hours per day (from goals table)
   - Build a prompt that generates a balanced week schedule avoiding overload
   - Respect Moroccan school schedule: peak study hours after 16:00, weekend adjustment for Friday prayers
   - Output validated plan_json
   - Store in study_plans

Frontend:
4. Add a /goals/planner page:
   - Weekly calendar view (Mon-Sun) with time slots
   - Each slot shows: subject, activity type icon (flashcards/exam practice/reading), estimated duration
   - Check off completed slots → progress bar for the week
   - "Regenerate plan" button (max once per day)
   - Monday morning notification (WhatsApp/in-app): "Your study plan for this week is ready"

Show complete planner service with prompt, routes, and the weekly calendar frontend component.
```

---

### 4.2 Pomodoro study timer

```
[paste project context]

Add a built-in Pomodoro focus timer that integrates with XP and study tracking.

Task:

Frontend:
1. Create a PomodoroTimer component in components/study/:
   - States: idle → focus (25min) → short break (5min) → long break (15min after 4 pomodoros)
   - Circular progress indicator showing time remaining
   - Sound notification on state transition (use Web Audio API — a gentle bell, not jarring)
   - Auto-starts next phase with a 3-second countdown
   - Visible in a persistent widget at the bottom-right of group pages (like a floating action button)
   - Minimizable — collapses to just a countdown badge

2. Session tracking:
   - On each completed focus block, POST /analytics/reading-event with event_type: "pomodoro_complete", metadata: { group_id, duration: 1500 }
   - After 4 pomodoros (one full cycle), show a congratulations state with XP earned

3. Settings in the timer (gear icon):
   - Focus duration: 15 / 25 / 45 / 60 min
   - Break duration: 5 / 10 / 15 min
   - Saved to localStorage per user

4. Study mode: when Pomodoro is running, dim the sidebar and show a soft focus border on the content area — minimize distractions

Show complete PomodoroTimer component with all states, animations, sound, and the integration tracking call.
```

---

### 4.3 Progress dashboard for students

```
[paste project context]

Build a rich personal progress dashboard for students. Currently /me/kpis exists on the backend but there is no rich frontend visualization.

Task:

Frontend — build a comprehensive dashboard at /analytics (or upgrade the existing page):

1. Summary strip at top (4 metric cards):
   - Total XP earned | Current level | Learning streak | Exams taken this month

2. Mastery by subject radar chart (use recharts RadarChart):
   - One axis per subject across all groups
   - Data from GET /me/weak-areas combined with exam session scores
   - Color: mastered (green fill), learning (amber), not started (gray)

3. Study time chart (recharts AreaChart):
   - Daily study minutes over the last 30 days
   - Annotated with exam dates (vertical dashed lines)
   - Data from user_events (reading events + pomodoro completions)

4. Flashcard retention heatmap (like GitHub contributions grid):
   - Last 52 weeks, each cell = day, color intensity = cards reviewed that day
   - Hover shows: date + cards reviewed count

5. Exam performance trend (recharts LineChart):
   - Score per exam over time, grouped by subject
   - Trendline showing improvement or decline

6. Weak areas panel:
   - Top 5 weak topics as horizontal progress bars
   - Each has a "Practice now" button → creates a targeted flashcard set on the spot

7. Streak calendar:
   - Current month calendar with study days highlighted green
   - Current streak count + longest streak ever

Backend additions needed:
8. GET /me/analytics/study-time — returns daily minutes for last 30 days from user_events
9. GET /me/analytics/flashcard-activity — returns daily review counts for last 52 weeks
Both endpoints should aggregate from user_events hypertable using TimescaleDB time_bucket.

Show complete dashboard page, all chart components, and the two new backend analytics endpoints.
```

---

### 4.4 Offline mode (PWA service worker)

```
[paste project context]

Implement a proper PWA offline mode. sw.js exists in public/ but has no caching strategy.

Task:

1. Replace apps/web/public/sw.js with a full Workbox-based service worker:
   - Cache-first strategy for static assets (JS, CSS, fonts, images)
   - Network-first with cache fallback for API calls to /api/v1/me/* and /api/v1/groups/*
   - Stale-while-revalidate for the Next.js pages
   - Background sync for failed POST requests (review submissions, reading events) — retry when back online

2. Offline-capable features (work without network):
   - Flashcard review: cache the due cards response on page load, submit reviews to background sync queue
   - Read uploaded documents: cache file content after first view
   - View past exam results: cache last 10 sessions

3. Offline indicator in the UI:
   - A subtle banner at the top: "Vous êtes hors ligne — certaines fonctionnalités ne sont pas disponibles"
   - Shows which features work offline (flashcards, documents) vs. which don't (chat, live quiz)

4. Install prompt:
   - Show "Installer l'application" banner on mobile after 3rd visit
   - Uses beforeinstallprompt event
   - Show in both French and Arabic

5. Push notifications:
   - Request notification permission on first use
   - Backend sends Web Push via VAPID for: streak reminder (23:50 UTC), exam deadline tomorrow, new assignment

Show complete sw.js, next.config.js PWA setup, offline indicator component, and push notification integration.
```

---

## Part 5 — Social & Community

### 5.1 Real-time study rooms with WebSocket

```
[paste project context]

Study rooms exist in the database and API but have no real-time functionality. Add WebSocket-based live collaboration.

Task:

Backend:
1. Add a WebSocket endpoint in FastAPI at /api/v1/ws/rooms/{room_id}:
   - Auth: accept Clerk JWT as query param (?token=...) since WebSocket headers are limited
   - Track connected users per room in Redis (key: room:{room_id}:users → sorted set by join_time)
   - Message types (JSON protocol):
     * user_joined: { type, user_id, display_name, avatar }
     * user_left: { type, user_id }
     * chat_message: { type, user_id, content, timestamp }
     * cursor_update: { type, user_id, x, y } — for shared whiteboard
     * whiteboard_draw: { type, stroke_data } — canvas path
     * doc_pointer: { type, user_id, file_id, page, scroll_y } — "I'm reading page 3"
   - Broadcast all messages to all connected users in the room
   - Use Redis pub/sub so broadcasts work across multiple Celery/API instances

2. Room presence: update the rooms table with current_user_count on join/leave

Frontend:
3. In apps/web, install socket.io-client (or use native WebSocket):
   - Create useRoomSocket(roomId) hook in lib/hooks/
   - Manages connection, reconnection, and message dispatch
   - Exposes: { connectedUsers, messages, sendMessage, sendCursorUpdate, isConnected }

4. Build the study room page at groups/[groupId]/rooms/[roomId]:
   - Left panel: list of connected users with avatars and "online" green dot
   - Center: shared chat (separate from group RAG chat — casual study chat)
   - Right panel: "What I'm reading" — shows which file and page each user is on
   - Bottom: shared whiteboard canvas (HTML Canvas, draw with mouse/touch, everyone sees it live)

5. "Invite to room" button copies the invite link and optionally sends WhatsApp message

Show complete WebSocket backend endpoint, Redis pub/sub setup, useRoomSocket hook, and the room page layout.
```

---

### 5.2 Peer Q&A forum

```
[paste project context]

Add a peer Q&A forum inside each group — students ask questions, peers and teachers answer. This replaces informal WhatsApp study groups.

Task:

Backend:
1. Create these tables:
   - forum_questions: id, group_id, user_id, title, body, tags (text[]), views, is_answered, accepted_answer_id, created_at
   - forum_answers: id, question_id, user_id, body, upvotes, is_accepted, created_at
   - forum_votes: user_id, answer_id, value (1 or -1), created_at

2. Add routes in app/api/v1/forum.py:
   - GET/POST /groups/{id}/forum — list/create questions (paginated, sortable by: recent/unanswered/most_votes)
   - GET /groups/{id}/forum/{qid} — question detail + answers
   - POST /groups/{id}/forum/{qid}/answers — post an answer
   - POST /groups/{id}/forum/{qid}/answers/{aid}/vote — upvote/downvote
   - PATCH /groups/{id}/forum/{qid}/answers/{aid}/accept — teacher/question owner marks as accepted
   - GET /groups/{id}/forum/unanswered — feed of unanswered questions (for teachers to prioritize)

3. XP rewards (via GamificationService):
   - Ask a question: +5 XP
   - Answer a question: +15 XP
   - Answer accepted: +50 XP

4. AI-assisted answers: if a question goes 24 hours unanswered, trigger an AI answer using the group's RAG pipeline — marked as "AI suggestion, pending teacher review"

Frontend:
5. Add a Forum tab inside group pages:
   - Question list with filter tabs: All / Unanswered / My Questions
   - Question detail page with answer thread
   - Markdown editor for questions and answers (react-markdown-editor-lite or simple textarea with preview)
   - Tags (e.g., #derivées #chimie #bac) — auto-suggested based on group subject
   - Teacher badge on answers from teachers
   - Accepted answer highlighted in green at the top

Show complete backend models, routes, XP integration, AI auto-answer trigger, and forum frontend components.
```

---

### 5.3 Concept map with React Flow

```
[paste project context]

The concept map backend is complete (knowledge_graph_nodes and edges tables, /concepts/map endpoint). The frontend needs a graph visualization library.

Task:

Frontend:
1. Install @xyflow/react (React Flow v12) in apps/web

2. Build a ConceptMap component in components/concepts/:
   - Fetch data from GET /api/v1/groups/{id}/concepts/map
   - Transform API response to React Flow node + edge format:
     * Nodes: { id, data: { label: concept_name, description }, position }
     * Edges: { id, source, target, label: relationship_type, animated: true }
   - Auto-layout using dagre (install @dagrejs/dagre) for a clean hierarchical left→right layout
   - Node colors by mastery (if student has studied it: green, partial: amber, not started: gray)

3. Interactive features:
   - Click a node → side panel opens showing: concept description, related files, "Study this" button (creates targeted flashcard set)
   - Hover a node → highlight its direct neighbors
   - Minimap in the bottom-right corner
   - Zoom controls
   - "Fit view" button

4. In Arabic mode (RTL), flip the dagre layout direction to right→left

5. Teacher can add/remove concepts and relationships:
   - Double-click empty space → add concept dialog
   - Click edge delete button → remove relationship
   - POST /groups/{id}/concepts and DELETE /groups/{id}/concepts/{id} endpoints (add these to backend if missing)

6. Export concept map as PNG (use React Flow's toBlob() utility)

Show complete React Flow setup, dagre auto-layout, the concept map component, and the node detail side panel.
```

---

## Part 6 — Teacher Tools

### 6.1 Question bank

```
[paste project context]

Add a personal question bank for teachers — a library of reusable questions they can insert into any exam.

Task:

Backend:
1. Create a question_bank table:
   - id, owner_user_id, question_type (MCQ/open/bac), content, options (JSONB), correct_answer, difficulty, subject, tags (text[]), source (manual/ai_generated), usage_count, created_at

2. Add routes in app/api/v1/question_bank.py:
   - GET /me/question-bank — list with filters: type, difficulty, subject, tags, search text. Paginated.
   - POST /me/question-bank — create question manually or import from an existing exam
   - PATCH /me/question-bank/{qid} — edit
   - DELETE /me/question-bank/{qid} — delete
   - POST /me/question-bank/import-from-exam/{exam_id} — bulk import all questions from a past exam into the bank
   - POST /groups/{id}/exams/{eid}/questions/from-bank — insert a question from the bank into an exam

3. When an AI-generated exam is created, optionally save all questions to the teacher's bank (add a save_to_bank: bool field in exam generation request)

Frontend:
4. Add a "Question Bank" page accessible from teacher navigation:
   - Searchable, filterable grid of question cards
   - Each card shows: type badge, difficulty dots, first 80 chars of question, subject tag, usage count
   - Multi-select to insert multiple questions into an exam at once
   - Import from exam button (select past exam from dropdown)

5. In the exam editor (from Part 1.5), add "Add from bank" button:
   - Opens a side drawer with the question bank
   - Search and select questions to insert

Show complete question bank model, routes, the question bank page, and the exam editor integration.
```

---

### 6.2 Student progress report PDF

```
[paste project context]

Add one-click PDF progress report generation per student for teachers.

Task:

Backend:
1. Add GET /api/v1/teacher/groups/{id}/students/{user_id}/report in app/api/v1/teacher.py:
   - Collects: student profile, study time (last 30 days), exam scores with subject breakdown, flashcard retention rate, streak, XP level, top 3 weak areas, attendance (days active)
   - Passes all data to a ReportService

2. Create app/services/report_service.py:
   - Uses ReportLab or WeasyPrint to generate a PDF
   - Layout: school logo area (from group/org settings), student name + photo initial, date range, summary metrics as styled boxes, exam scores table, weak areas bar chart, AI-written paragraph summary ("Based on Ahmed's activity this month, he shows strong understanding of...")
   - PDF generated in French by default, Arabic on request
   - Saved temporarily to GCS with a 24-hour signed URL

3. Dispatch PDF generation to Celery (slides queue) — it can take a few seconds

4. Add GET /api/v1/teacher/groups/{id}/students/{user_id}/report/status — poll until ready

Frontend:
5. In the teacher analytics page (student drill-down view):
   - "Generate Report" button
   - Shows a loading spinner while PDF is generating (polls status endpoint)
   - Once ready: "Download PDF" button + "Send to student via email" option
   - "Send to parent via WhatsApp" option (uses /notifications endpoint with parent's phone from their profile)

Show complete report service, PDF layout code, routes, and the frontend report generation flow.
```

---

## Part 7 — Parent Portal

### 7.1 Parent accounts and portal

```
[paste project context]

Add a parent role that can monitor their child's progress without accessing study content.

Task:

Backend:
1. Add parent_student_links table:
   - parent_user_id, student_user_id, verified (bool), created_at

2. Add 'parent' to the user role enum in users table

3. New routes in app/api/v1/parent.py:
   - POST /parent/link-student — parent provides student's email → sends a verification code to the student
   - POST /parent/link-student/verify — student accepts the link request (verifies from their account)
   - GET /parent/children — list linked students
   - GET /parent/children/{student_id}/overview — summary: weekly study time, exam scores, streak, XP, active groups
   - GET /parent/children/{student_id}/exams — recent exam sessions and scores
   - GET /parent/children/{student_id}/weak-areas — student's identified weak areas
   All parent routes are read-only — parents cannot modify anything

4. Weekly summary Celery task (runs Monday 08:00 Morocco time):
   - For each parent, aggregate child's past week stats
   - Send WhatsApp message via Twilio in French or Arabic (based on parent preference)
   - Message format: "Résumé hebdomadaire de Yassine: ⏱ 4h30 d'étude | 📝 2 examens (14/20 moy.) | 🔥 Série de 7 jours | ⚠️ Points faibles: Derivées, Intégrales"

Frontend:
5. A separate parent dashboard layout at /parent:
   - Clean, simple — no complex study UI, just progress visibility
   - Child switcher at the top if multiple children are linked
   - Cards: weekly study time, current streak, last exam score
   - Recent activity feed: "Yassine completed a flashcard session — 85% retention"
   - Weak areas list with "Help your child practice" → share a specific flashcard link

Show complete parent linking flow, backend routes, weekly summary task, and the parent dashboard.
```

---

## Part 8 — Orientation Features

### 8.1 Post-Bac orientation guide

```
[paste project context]

Build a post-Bac orientation feature — one of the most anxiety-inducing decisions for Moroccan students and families.

Task:

Backend:
1. Create these tables:
   - higher_ed_programs: id, name_fr, name_ar, institution_type (ENSA/ENCG/FST/CPGE/BTS/Faculté/Private), institution_name, city, eligible_branches (text[]), min_bac_average (float), num_seats, description_fr, description_ar, application_url
   - orientation_sessions: id, user_id, bac_branch, bac_average, session_data (JSONB with chat history), recommended_programs (int[]), created_at

2. Add routes in app/api/v1/orientation.py:
   - GET /orientation/programs — list with filters: branch, city, institution_type, min_average
   - POST /orientation/chat — AI-powered orientation chat:
     * Takes: bac_branch, bac_average, interests, preferred_city
     * Returns SSE stream of AI guidance
     * Prompt: acts as a knowledgeable Moroccan orientation counselor (mourchid), knows the system inside out, gives concrete program recommendations with realistic expectations, warns about competitive programs honestly, considers financial situation if mentioned
   - POST /orientation/save — save an orientation session for future reference

Frontend:
3. Add /orientation page (accessible without login, better conversion):
   - Step 1: "Ma filière Bac" — branch selector (SM, SE, SEco...)
   - Step 2: "Ma mention" — average range (Passable 10-11, Assez bien 12-13, Bien 14-15, Très bien 16+)
   - Step 3: "Mes préférences" — city preference, field of interest (tech, business, science, arts, health)
   - Step 4: AI orientation chat — streaming conversation with the AI counselor
   - Programs panel on the side: updates in real-time as AI mentions programs, clickable cards with institution details and application links
   - Save results button (prompts to create account if not logged in)

Show complete orientation service prompt, backend routes, and the multi-step orientation frontend.
```

---

## Part 9 — Infrastructure Fixes

### 9.1 Celery Flower monitoring

```
[paste project context]

Add Flower (Celery monitoring dashboard) to the development and production environments.

Task:

1. Add Flower to docker-compose.yml:
   services:
     flower:
       image: mher/flower:2.0
       command: celery flower --broker=redis://redis:6379/0 --port=5555 --basic_auth=admin:changeme
       ports: ["5555:5555"]
       depends_on: [redis, celery_worker]
   Document this in README — local dev: http://localhost:5555

2. In production (Cloud Run / GCP):
   - Deploy Flower as a separate Cloud Run service
   - Add HTTP Basic Auth via environment variable FLOWER_BASIC_AUTH=user:password
   - Restrict access: add Cloud IAP (Identity-Aware Proxy) in front of Flower

3. Add a Flower iframe or link in the admin panel:
   - GET /admin/health/overview should include task queue stats by calling Flower's API:
     GET http://flower:5555/api/workers — total workers, active tasks, processed count
   - Show these as metric cards in the admin health page

4. Add custom Flower task events:
   - When process_file_task fails permanently, emit a custom event so Flower shows it in a "Failed Tasks" panel

5. Set up Flower persistent event storage (use Redis backend) so history survives Flower restarts

Show complete docker-compose addition, production deployment config, and admin panel task queue integration.
```

---

### 9.2 Malware scanning for uploads

```
[paste project context]

Add malware scanning for all uploaded files before they are ingested into the RAG pipeline.

Task:

1. Add ClamAV to docker-compose.yml:
   services:
     clamav:
       image: clamav/clamav:stable
       ports: ["3310:3310"]
       volumes: ["clamav_db:/var/lib/clamav"]
   volumes:
     clamav_db:

2. Install pyclamd in requirements.txt

3. Create app/services/virus_scanner.py:
   - connect to ClamAV via pyclamd.ClamdNetworkSocket(host='clamav', port=3310)
   - scan_file(file_bytes: bytes) → ScanResult: { clean: bool, threat_name: str | None }
   - Handle connection errors gracefully: if ClamAV is unavailable, log warning and allow file through (don't block uploads because scanner is down)

4. In process_file_task (Celery):
   - After downloading the file from GCS, before any text extraction:
   - Call virus_scanner.scan_file(file_bytes)
   - If threat detected:
     * Update file status to ERROR with error_message: "File rejected: malware detected ({threat_name})"
     * Delete the file from GCS
     * Send in-app notification to the uploader
     * Log to audit_logs with action: "file_malware_rejected"
     * Do NOT process further

5. For production on GCP:
   - Use Google Cloud's VirusTotal API or Security Command Center instead of self-hosted ClamAV
   - Abstract the scanner behind a VirusScannerPort interface so you can swap implementations

Show complete scanner service, process_file_task integration, and GCP cloud scanner variant.
```

---

### 9.3 Log aggregation with structured logging

```
[paste project context]

Set up proper structured log aggregation so logs survive container restarts and are searchable.

Task:

Backend:
1. In app/core/middleware.py, ensure all access logs are structured JSON with fields:
   request_id, method, path, status_code, duration_ms, user_id (if authenticated), ip, user_agent

2. Configure the Python logger in app/main.py to output JSON using python-json-logger:
   - Install python-json-logger
   - Format: {"timestamp": "...", "level": "INFO", "logger": "...", "message": "...", "extra_fields": {}}
   - Log level from APP_ENV: DEBUG in local, INFO in dev/staging, WARNING in prod

3. For GCP Cloud Run (production):
   - Cloud Run automatically ships stdout to Cloud Logging
   - Add these log fields so Cloud Logging parses them correctly: httpRequest.status, httpRequest.latency, httpRequest.requestUrl
   - Create a Log-based metric in GCP for: 5xx error rate, p99 latency, failed Celery tasks

4. For local dev, add a log viewer to docker-compose:
   services:
     dozzle:
       image: amir20/dozzle:latest
       ports: ["9999:8080"]
       volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
   Dozzle provides a live log viewer at http://localhost:9999

5. Add correlation IDs:
   - RequestID middleware already exists — ensure the request_id propagates to Celery tasks via task headers
   - All Celery task logs should include the originating request_id for end-to-end tracing

Show complete logging configuration, Cloud Logging setup, and Celery correlation ID propagation.
```

---

### 9.4 Database backup strategy

```
[paste project context]

Set up automated database backups with point-in-time recovery for the PostgreSQL database.

Task:

For GCP Cloud SQL (if using Cloud SQL PostgreSQL):
1. Enable automated backups in Terraform:
   - In the google_sql_database_instance resource: backup_configuration { enabled = true, start_time = "02:00", point_in_time_recovery_enabled = true, transaction_log_retention_days = 7, backup_retention_settings { retained_backups = 30 } }
   - This gives 30 daily backups + 7-day PITR

2. Add a scheduled export job (Cloud Scheduler → Cloud Run Job):
   - Daily at 03:00 UTC: pg_dump → gzip → upload to a separate GCS bucket (studyforge-backups)
   - Keep 90 days of dumps in GCS
   - Script: scripts/backup_db.sh

3. Document the restore procedure in docs/RESTORE.md:
   - PITR restore (last known good time)
   - Full dump restore from GCS
   - Test restore to a staging instance

For local dev (docker-compose):
4. Add a backup script scripts/backup_local_db.sh:
   - Runs pg_dump inside the postgres container
   - Saves to ./backups/YYYY-MM-DD.sql.gz
   - Add to cron: daily at 02:00

5. Add a CloudWatch / GCP alert:
   - Alert if backup has not run successfully in the last 25 hours
   - Send alert to a dedicated ops email (separate from Sentry)

6. ChromaDB backup:
   - ChromaDB stores data in a volume. Add chroma backup to the daily export job:
   - tar.gz the ChromaDB data directory → upload to same GCS backup bucket

Show complete Terraform backup config, backup script, restore documentation, and GCP alert setup.
```

---

## Part 10 — Additional Quality Features

### 10.1 Full-text search page

```
[paste project context]

The backend has GET /api/v1/search but there is no frontend search page or entry point.

Task:

Backend:
1. Verify GET /search handles: query string, optional group_id filter, type filter (files/exams/flashcards/forum), pagination
2. Ensure it uses PostgreSQL full-text search (tsvector/tsquery) for fast results
3. Results should include a snippet of matching text with the search term highlighted (ts_headline)
4. Add Elasticsearch or use pg_trgm if current search is too slow

Frontend:
5. Add a global search bar in the layout header (keyboard shortcut: Cmd+K / Ctrl+K):
   - Opens a modal overlay (not position:fixed — use the faux viewport pattern)
   - Instant search: debounce 300ms, call /search, show results in the modal
   - Result types: Files (file icon), Exams (clipboard icon), Flashcard sets (cards icon), Forum posts (chat icon)
   - Each result shows: title, snippet with match highlighted, group name, last updated
   - Press Enter or click to navigate to the item
   - Recent searches stored in localStorage

6. Full search results page /search?q=... for when the user wants paginated results:
   - Filter tabs: All / Files / Exams / Flashcards / Forum
   - Group filter dropdown (search within a specific group)
   - Results grid with the same card design as the modal but paginated

Show backend search query (pg full-text), the Cmd+K search modal, and the full search results page.
```

---

### 10.2 WhatsApp-native notifications for parents and students

```
[paste project context]

Leverage the existing Twilio WhatsApp integration more deeply. Most Moroccan users prefer WhatsApp over email.

Task:

1. In app/services/notification_service.py, expand WhatsApp templates:
   - Streak reminder (23:50 UTC): "🔥 N'oublie pas ta série de {streak_days} jours, {first_name}! Fais au moins une carte mémoire avant minuit."
   - Exam deadline tomorrow: "📝 Rappel: l'examen '{exam_title}' est dû demain. Tu as {days} heures pour te préparer."
   - New assignment: "📚 Nouveau devoir dans {group_name}: '{assignment_title}' — à rendre avant le {due_date}."
   - Weekly parent summary: see Parent Portal prompt above
   - At-risk alert to teacher: "⚠️ {student_name} n'a pas étudié depuis {days} jours dans {group_name}. Pensez à vérifier."
   All messages available in both French and Arabic.

2. Add notification_channel preference to user settings:
   - email_enabled (bool, default true)
   - whatsapp_enabled (bool, default true if phone number exists)
   - whatsapp_phone (string) — collected on first use with a verification step (send OTP via WhatsApp)
   - notification_language (fr/ar)

3. Phone number verification flow:
   - GET /me/notifications/verify-phone?phone=+212... — sends WhatsApp OTP
   - POST /me/notifications/verify-phone — verifies OTP, saves phone to user profile

4. In all notification triggers throughout the codebase, check the user's channel preference before sending — never send both email AND WhatsApp for the same event unless the user opted into both

Frontend:
5. In account settings /account:
   - WhatsApp notification section with phone input + verify button + OTP input
   - Per-notification-type toggles: streak reminders, exam deadlines, assignment alerts, weekly summary
   - Preview buttons: "Send a test message" for each type

Show complete notification preference model, verification flow, template messages in FR and AR, and the settings UI.
```

---

*End of prompt library — 28 feature prompts covering all critical fixes, Morocco-specific features, learning enhancements, social tools, teacher tools, parent portal, orientation, and infrastructure.*

*Usage tip: For best results with Claude Code, also paste the relevant file paths from your codebase into each prompt so it can reference your existing patterns directly.*