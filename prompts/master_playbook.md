# StudyForge — Complete Claude Code Playbook

## The 5 prompts you have and what each one does

| # | File | What it builds | When to run |
|---|---|---|---|
| 1 | `prompt_1_foundation.md` | RBAC, TimescaleDB events, Organizations table, ChromaDB refactor | First, everything depends on this |
| 2 | `prompt_2_org_surface.md` | Org admin + teacher + student surfaces, cohorts, KPIs, assignments | After prompt 1 is committed |
| 3 | `prompt_3_service_fixes.md` | Temperature fixes, RAG improvements, flashcard dedup, vision PDF | Can run parallel to 2, but after 1 |
| 4 | `prompt_4_moroccan_exam.md` | New question types, /20 rubric, essay correction, construction photo grading | After prompt 3 |
| 5 | `prompt_5_audit.md` | Full-stack gap closure, verify everything is wired | Last — runs after all features are built |

---

## How Claude Code works (before you start)

Claude Code is a terminal agent. You run it with:
```bash
claude
```
from your project root. It can read files, write files, run bash commands, and see the results. It works in one conversation at a time. A session can handle roughly 50,000–100,000 tokens of context before it starts to lose track of earlier instructions.

**The most important rule:** Claude Code reads what you give it. If you don't tell it to read a file, it will guess what's in it — and guess wrong. Every prompt in this playbook starts with explicit `cat` commands. Do not skip them.

---

## Setting up Claude Code

### Install (if not already installed)
```bash
npm install -g @anthropic-ai/claude-code
```

### First-time setup in your project
```bash
cd your-studyforge-project/
claude
```

### Create a CLAUDE.md file in your project root
This file is read automatically by Claude Code at the start of every session. Put your project context here so you don't repeat it every time:

```markdown
# StudyForge

Full-stack EdTech platform.

## Stack
- Backend: FastAPI 0.111, SQLAlchemy 2 async, Alembic, Pydantic v2, Python 3.11
- Frontend: Next.js 15 App Router, TypeScript, Tailwind CSS, TanStack Query v5, Clerk auth
- Auth: Clerk JWT via JWKS, auto-provisions users row
- AI: OpenAI-compat provider facade in ai_service.py (also NVIDIA + Bedrock)
- Queues: Celery with 3 queues (files, slides, notifications) + Redis
- Vector store: ChromaDB HTTP (separate service)
- Storage: MinIO (local S3-compat)
- DB: PostgreSQL 16

## Key rules
- All PKs are UUIDs as strings
- Never modify existing Alembic migrations
- Never change existing API response shapes
- All new endpoints need Pydantic v2 response models
- Follow existing patterns in the file you are editing

## File locations
- Backend routes: backend/app/api/v1/
- Services: backend/app/services/
- Models: backend/app/models/
- Schemas: backend/app/schemas/
- Celery tasks: backend/app/tasks/
- Frontend hooks: lib/hooks/
- Frontend pages: app/
```

---

## How to run each prompt — exact steps

---

### PROMPT 1 — Foundation
**Estimated time:** 3–5 hours of Claude Code work

**Before you start:**
```bash
git checkout -b feature/foundation
```

**Start Claude Code:**
```bash
claude
```

**Paste this exactly:**
```
Read the file prompts/prompt_1_foundation.md and follow every instruction in it.
Start with Step 0 — read all the listed files before writing anything.
After each phase, tell me which files you created or modified.
Do not start the next phase until you tell me the previous one is done.
```

**Then attach the prompt file:**
```
/add prompts/prompt_1_foundation.md
```

**When Claude Code finishes each phase, verify before saying continue:**
- After Phase 1a: `python -c "from app.core.permissions import require_permission; print('OK')"`
- After Phase 1b: `python -c "from app.services.analytics_service import track_event; print('OK')"`
- After Phase 1c: `alembic upgrade head` must run clean

**When all phases done:**
```bash
git add -A && git commit -m "feat: RBAC, TimescaleDB events, organizations table, ChromaDB refactor"
```

---

### PROMPT 2 — Org Surface
**Estimated time:** 4–6 hours

**Before you start:**
```bash
git checkout -b feature/org-surface
```

**Start a fresh Claude Code session:**
```bash
claude
```

**Paste:**
```
Read the file prompts/prompt_2_org_surface.md and follow every instruction.
Before writing any code, run these reads:
  cat backend/app/core/permissions.py
  cat backend/app/models/organization.py
  cat backend/app/api/v1/groups.py
  find lib/hooks -name "*.ts" | head -20
This is a continuation of work already done. The RBAC system and organizations table already exist.
```

**Add the prompt:**
```
/add prompts/prompt_2_org_surface.md
```

**Key checks after org API is done:**
```bash
# Test org creation
curl -X POST http://localhost:8000/api/v1/org \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test School", "slug": "test-school"}'
# Should return the org object with the caller as admin
```

---

### PROMPT 3 — Service Fixes
**Estimated time:** 2–3 hours

This one can run while prompt 2 is in progress on a separate branch, then merged. It touches different files.

```bash
git checkout -b fix/service-prompts
claude
```

**Paste:**
```
Read the file prompts/prompt_3_service_fixes.md.
Before touching anything, read:
  cat backend/app/services/ai_service.py
  cat backend/app/services/rag_service.py
  cat backend/app/services/flashcard_service.py
  cat backend/app/services/exam_service.py
  cat backend/app/services/slide_service.py
  cat backend/app/services/learning_path_service.py
  cat backend/app/services/file_processor.py
Apply fixes in order. After each fix, show me the diff of what changed.
```

**Add the prompt:**
```
/add prompts/prompt_3_service_fixes.md
```

**Verify temperatures after:**
```bash
grep -n "temperature=" backend/app/services/ai_service.py
grep -n "temperature=" backend/app/services/rag_service.py
# generate_structured_json must be 0.1
# rag chat_completion must be 0.25
```

---

### PROMPT 4 — Moroccan Exam System
**Estimated time:** 3–4 hours

**Depends on:** Prompt 3 must be merged first (uses `ai_service.describe_image` added in prompt 3)

```bash
git checkout -b feature/moroccan-exam
claude
```

**Paste:**
```
Read the file prompts/prompt_4_moroccan_exam.md.
Before writing anything, read:
  cat backend/app/services/exam_service.py
  cat backend/app/services/ai_service.py
  cat backend/app/models/exam.py
  cat backend/app/api/v1/exams.py
The ai_service already has a describe_image() method — use it, don't recreate it.
```

**Add the prompt:**
```
/add prompts/prompt_4_moroccan_exam.md
```

**Verify after:**
```bash
python -c "
from app.services.curriculum_service import distribute_points
qs = [{'type': 'essay'}, {'type': 'open_calculation'}, {'type': 'fill_blank'}]
result = distribute_points(qs, 20.0)
total = sum(q['points'] for q in result)
assert total == 20.0
print('PASS: points sum to 20')
"
```

---

### PROMPT 5 — Full-Stack Audit
**Estimated time:** 4–8 hours

**Run this last, after all features are merged to main.**

```bash
git checkout main
git pull
claude
```

**Paste:**
```
Read the file prompts/prompt_5_audit.md.
Before doing anything else, perform Step 0 — read the entire codebase as instructed.
Write audit/master_map.md before fixing anything.
Show me master_map.md when it's done so I can review it before you start fixing.
```

**Add the prompt:**
```
/add prompts/prompt_5_audit.md
```

**After master_map.md is written, review it yourself before saying "continue".**
Look for any gaps where the audit found something you disagree with. Tell Claude Code which ones to skip.

---

## How to talk to Claude Code during a session

### Starting a session right
Always start with what to READ, not what to write:
```
Read [file list]. Do not write any code yet. Tell me what you found.
```

Wait for the summary. Then say:
```
Now start Phase 1.
```

### When Claude Code gets confused
If it starts making things up or going in the wrong direction:
```
Stop. Read [specific file] again and tell me what the current implementation is.
```

### When you want to check progress
```
Show me the current state of [filename]. What have you changed so far?
```

### When a phase produces errors
```
This error occurred: [paste error]. Do not change anything else. Fix only this error.
```

### When Claude Code tries to refactor things you didn't ask for
```
Do not refactor. Only fix what was explicitly listed in the prompt. Revert [filename] to how it was.
```

### Limiting scope
If the session is getting too long and Claude Code is drifting:
```
Stop work on everything else. Only finish [specific task] then stop and wait for me.
```

---

## Session length management

Claude Code sessions have a context limit. When a session runs too long, Claude Code starts forgetting earlier instructions. Signs of this:
- It starts ignoring constraints from the prompt
- It creates files it already created earlier
- It contradicts earlier decisions

**When this happens:**
1. End the session
2. Commit what's done: `git add -A && git commit -m "wip: [describe what's done]"`
3. Start a new session
4. Paste this at the start of the new session:

```
We are continuing work on StudyForge. 
Here is what has been done so far: [list completed phases]
Here is what still needs to be done: [list remaining phases from the prompt]
Read these files before continuing: [list the relevant files]
```

As a rule of thumb: start a new session after every 2–3 phases, even if you don't see signs of drift.

---

## File organization for your prompts

Create a `prompts/` folder in your project root:
```
your-project/
  CLAUDE.md                        ← auto-read by Claude Code every session
  prompts/
    prompt_1_foundation.md
    prompt_2_org_surface.md
    prompt_3_service_fixes.md
    prompt_4_moroccan_exam.md
    prompt_5_audit.md
  audit/                           ← created by prompt 5
    master_map.md
    services.md
    hooks.md
    fixes_applied.md
    summary.md
```

---

## Recommended order with git branching

```
main
  └── feature/foundation          ← Prompt 1
        └── merged to main
  └── fix/service-prompts         ← Prompt 3 (can start after prompt 1)
        └── merged to main
  └── feature/org-surface         ← Prompt 2 (needs prompt 1)
        └── merged to main
  └── feature/moroccan-exam       ← Prompt 4 (needs prompt 3)
        └── merged to main
  └── chore/audit                 ← Prompt 5 (needs everything merged)
        └── merged to main
```

Do not run prompt 5 (audit) until all features are merged. It will flag gaps that don't exist yet as real gaps.

---

## Tips that actually matter

**Commit between phases, not just between prompts.** If Claude Code breaks something in Phase 3, you want to revert to the end of Phase 2, not the start of the entire prompt.

**The CLAUDE.md file is your best tool.** Anything you find yourself repeating at the start of sessions — put it in CLAUDE.md. Claude Code reads it automatically.

**Never say "and also".** One task per message. "Fix the temperature AND add the dedup function AND update the prompt" leads to Claude Code partially doing all three and finishing none of them.

**Read before you trust.** After Claude Code says it "fixed" something, ask it to show you the relevant function. It sometimes reports success without having actually made the change.

**Verification steps are not optional.** Every prompt ends with verification commands. Run them. If they fail, paste the error back and say "fix only this, nothing else."

**When Claude Code asks for clarification, answer specifically.** "Do whatever you think is best" leads to unexpected choices. Give a direct answer.
