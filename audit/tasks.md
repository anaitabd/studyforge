# Tasks Audit — StudyForge

Celery tasks audited against spec requirements.

---

## Celery App Configuration

**File:** `apps/api/app/tasks/celery_app.py`

| Requirement | Status | Detail |
|---|---|---|
| Queues: files, notifications, slides, analytics | PASS | All four queues declared |
| Beat: `check_exam_deadlines` every 3600s | PASS | Confirmed |
| Beat: `update_streak_records` daily at 23:55 UTC | PASS | Confirmed crontab |
| Beat: `flag_at_risk_students` daily at 06:00 UTC | PASS | Confirmed crontab |
| Broker: Redis | PASS | Configured via `REDIS_URL` |
| Result backend: Redis | PASS | Confirmed |

**Overall: PASS.**

---

## `file_tasks.py`

**File:** `apps/api/app/tasks/file_tasks.py`

| Requirement | Status | Detail |
|---|---|---|
| `max_retries=3` | PASS | Confirmed |
| Retry on exception via `self.retry(exc=exc)` | PASS | Confirmed; exponential backoff via `countdown` |
| `acks_late=True` | FAIL | Not set. Without acks_late, if the worker process dies mid-task the message is lost (already acked on receipt). Spec requires acks_late for reliability. |
| Delegates to `jobs` layer (not direct service call) | PASS | Calls `app.jobs.file_jobs.process_file` |
| Sets `file.status = "error"` on final failure | PASS | Confirmed in exception handler |
| Logging | PASS | Confirmed |

**Issues:**
- **Missing `acks_late=True`**: Task message is acknowledged before processing completes. Worker crash = silent file processing failure with no retry.

---

## `slide_tasks.py`

**File:** `apps/api/app/tasks/slide_tasks.py`

| Requirement | Status | Detail |
|---|---|---|
| `max_retries=3` | FAIL | Actual value: `max_retries=2`. Spec requires 3. |
| `acks_late=True` | FAIL | Not set. Same concern as file_tasks — worker crash loses message. |
| Delegates to `jobs` layer | PASS | Calls `app.jobs.slide_jobs` |
| Sets deck status to "error" on final failure | PASS | Confirmed |
| Logging | PASS | Confirmed |

**Issues:**
- **`max_retries=2` (spec: 3)**: One fewer retry than spec.
- **Missing `acks_late=True`**: Same reliability concern as file_tasks.

---

## `notification_tasks.py`

**File:** `apps/api/app/tasks/notification_tasks.py`

| Requirement | Status | Detail |
|---|---|---|
| `send_email_task` max_retries=2 | PASS | Confirmed |
| `send_whatsapp_task` max_retries=1 | PASS | Confirmed |
| `check_exam_deadlines`: queries `status='assigned'` exams | PASS | Confirmed |
| 24-hour window notification | PASS | Confirmed |
| 2-hour window notification | PASS | Confirmed |
| Double-notify prevention | PASS | Checks for existing Notification row of same type before sending |
| `acks_late=True` on email/whatsapp tasks | FAIL | Not set on either task |

**Issues:**
- **Missing `acks_late=True`** on `send_email_task` and `send_whatsapp_task`: Notifications could be silently dropped if worker dies mid-delivery.

---

## `analytics_tasks.py`

**File:** `apps/api/app/tasks/analytics_tasks.py`

| Requirement | Status | Detail |
|---|---|---|
| `compute_org_kpis` per-org | PASS | Confirmed |
| `compute_org_kpis` per-cohort | PASS | Confirmed |
| `update_streak_records` nightly | PASS | Confirmed; scheduled at 23:55 UTC |
| `flag_at_risk_students` daily | PASS | Confirmed; scheduled at 06:00 UTC |
| At-risk criteria (configurable thresholds) | PASS | Thresholds in task |
| `acks_late=True` | FAIL | Not set on analytics tasks |

**Issues:**
- **Missing `acks_late=True`** on all analytics tasks.

---

## Summary Table

| Task | max_retries | acks_late | Spec compliance |
|---|---|---|---|
| `process_file_task` | 3 ✅ | ❌ | Partial |
| `generate_slides_task` | 2 ❌ (spec: 3) | ❌ | Partial |
| `send_email_task` | 2 ✅ | ❌ | Partial |
| `send_whatsapp_task` | 1 ✅ | ❌ | Partial |
| `check_exam_deadlines` | beat | n/a | Pass |
| `update_streak_records` | beat | n/a | Pass |
| `flag_at_risk_students` | beat | n/a | Pass |
| `compute_org_kpis` | — | ❌ | Partial |

**Global finding**: `acks_late=True` is missing from all tasks. This is the single highest-impact reliability gap — it means any worker crash between task receipt and completion silently drops the job. The fix is a one-line addition (`acks_late = True`) to each task decorator or as a global Celery config setting (`task_acks_late = True` in `celery_app.py`).
