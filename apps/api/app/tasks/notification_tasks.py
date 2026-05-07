import asyncio
import logging

from app.jobs.notification_jobs import send_email, send_whatsapp
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.send_email", bind=True, max_retries=2, default_retry_delay=30)
def send_email_task(self, to_email: str, subject: str, html_body: str, text_body: str = "", idempotency_key: str | None = None):
    try:
        send_email(to_email, subject, html_body, text_body, idempotency_key=idempotency_key)
    except Exception as exc:
        logger.error(f"Email send failed for {to_email}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.notification_tasks.send_whatsapp", bind=True, max_retries=1, default_retry_delay=600)
def send_whatsapp_task(self, to_number: str, body: str):
    try:
        send_whatsapp(to_number, body)
    except Exception as exc:
        logger.error(f"WhatsApp send failed for {to_number}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.notification_tasks.check_exam_deadlines")
def check_exam_deadlines():
    import asyncio
    asyncio.run(_check_deadlines_async())


async def _check_deadlines_async():
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.exam import Exam
    from app.services.notification_service import notify_exam_deadline

    now = datetime.now(timezone.utc)
    windows = [(timedelta(hours=24), timedelta(hours=25), 24), (timedelta(hours=2), timedelta(hours=3), 2)]
    async with AsyncSessionLocal() as db:
        for low, high, label_hours in windows:
            result = await db.execute(select(Exam).where(Exam.status == "assigned", Exam.ends_at >= now + low, Exam.ends_at <= now + high))
            exams = result.scalars().all()
            for exam in exams:
                try:
                    await notify_exam_deadline(db=db, group_id=exam.group_id, exam_id=exam.id, exam_title=exam.title, hours_until=label_hours)
                except Exception as e:
                    logger.error(f"Deadline notification failed for exam {exam.id}: {e}")
