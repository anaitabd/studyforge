# StudyForge — Roles & Permissions

## Overview

StudyForge uses **two separate role layers** that work together:

| Layer | Where stored | Scope |
|-------|-------------|-------|
| **Global role** | `users.role` column | Platform-wide — who the user is |
| **Resource permission** | `permissions` table | Per-resource (org, cohort) — what they can do there |
| **Group membership role** | `group_members.role` | Per-group — their role inside that group |

---

## Global Roles (`users.role`)

### `super_admin`

The platform operator. **Bypasses all RBAC checks** — has access to everything everywhere without needing a permission record.

**Exclusive capabilities (admin panel at `/admin`):**
- View system health: database pool, Redis, ChromaDB, S3, AI provider status
- Inspect and retry stuck/failed file processing jobs
- View and replay dead-letter queue messages (files, slides, notifications)
- Search all users by name or email
- Override a user's billing plan (`free` → `personal` → `school`)
- Suspend a user (sets `is_active=false` and revokes all active Clerk sessions)
- Manage feature flags (toggle on/off per plan tier)
- List all registered schools

There is only one hard limit: a super_admin **cannot suspend themselves**.

---

### `student` (default)

Every user starts as a student. This is the role for learners.

**Can do:**
- Create and join groups (free plan: max 2 groups)
- Upload files to groups they belong to (PDF, DOCX, PPTX, TXT — up to 50 MB)
- Chat with uploaded files via RAG
- Take exams assigned to them
- Study flashcard sets
- Follow learning paths
- View slides decks
- Use study rooms (Pomodoro timer, shared notes)
- Track their own XP, streaks, and gamification progress
- Receive in-app, email, and WhatsApp notifications

---

### `teacher`

A teacher is a student who can also manage and observe other students.

**Everything a student can do, plus:**
- Create groups (as owner)
- View per-student analytics for groups they own or teach: exam scores, chat counts, reading time, scroll depth
- View the generation history of a group (exams, flashcards, slides, learning paths created)
- Watch the cohort live view — which students are online and what file they're reading right now
- Fan-out content generation to an entire cohort at once (generate an exam or flashcard set for every student in one request)
- Grade assignments and leave feedback on student submissions

---

### `school_admin`

An administrator for a school or institution. Sits between `teacher` and `super_admin` in authority. Manages the school's users and content through the organization admin dashboard (`/org/[slug]/dashboard`).

This role is handled through the **resource permission** system at the org level (see below) rather than being fully distinct at the global level.

---

## Resource Permissions (`permissions` table)

These are granted **per-resource** (currently: organizations and cohorts). The rank order is:

```
admin (4) > teacher (3) > student (2) > viewer (1)
```

### `admin` (org-level)
Manages the organization.

- Invite members (bulk or individual) by email
- Set and change member roles
- Remove members from the org
- Create, update, and delete cohorts
- Create assignments for cohorts with due dates
- View org-wide KPIs and analytics dashboards
- Update org settings (name, billing email, etc.)

### `teacher` (org-level)
A teacher within the org.

- Same as teacher global role but scoped to org resources
- Can be assigned as cohort teacher to get cohort-level analytics and assignment grading

### `student` (org-level)
Standard learner within the org.

- Same as global `student` capabilities
- Access is restricted to resources within their org

### `viewer` (org-level)
Read-only observer.

- Can view files, chat history, slides
- **Cannot** upload files, generate content, take exams, or interact with active features

---

## Group Membership Roles (`group_members.role`)

Every user in a group has one of three group-level roles:

| Role | Who | What they can do in the group |
|------|-----|-------------------------------|
| `owner` | Creator of the group | Everything — full control, can archive/delete group, invite members, manage roles |
| `teacher` | Assigned by owner | Upload files, generate exams/flashcards/slides/learning paths, view analytics, grade assignments |
| `student` | Default for invitees | Upload files, chat, take exams, study flashcards, view slides and learning paths |

---

## Plans (`users.plan`)

x
| Plan | Group limit | Notes |
|------|------------|-------|
| `free` | 2 groups | Default for new users |
| `personal` | Unlimited | Paid individual subscription |
| `school` | Unlimited | Org/institution subscription, enables full teacher/admin features |

---

## Quick Reference

```
super_admin       → full platform control (no RBAC checks)
  └─ school_admin → org management (invite, cohorts, assignments, analytics)
       └─ teacher → group analytics, cohort generation, grading
            └─ student → chat, files, exams, flashcards, learning paths
                 └─ viewer → read-only
```
