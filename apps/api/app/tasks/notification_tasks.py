import asyncio
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _send_whatsapp(to_number: str, body: str):
    from app.core.config import settings
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.debug(f"Twilio not configured — skipping WhatsApp to {to_number}")
        return
    from twilio.rest import Client
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    to = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
    client.messages.create(body=body, from_=settings.TWILIO_WHATSAPP_FROM, to=to)


@celery_app.task(name="app.tasks.notification_tasks.send_whatsapp", bind=True, max_retries=1, default_retry_delay=600)
def send_whatsapp_task(self, to_number: str, body: str):
    try:
        _send_whatsapp(to_number, body)
    except Exception as exc:
        logger.error(f"WhatsApp send failed for {to_number}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.notification_tasks.check_exam_deadlines")
def check_exam_deadlines():
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
            result = await db.execute(
                select(Exam).where(
                    Exam.status == "assigned",
                    Exam.ends_at >= now + low,
                    Exam.ends_at <= now + high,
                )
            )
            exams = result.scalars().all()
            for exam in exams:
                try:
                    await notify_exam_deadline(
                        db=db,
                        group_id=exam.group_id,
                        exam_id=exam.id,
                        exam_title=exam.title,
                        hours_until=label_hours,
                    )
                except Exception as e:
                    logger.error(f"Deadline notification failed for exam {exam.id}: {e}")
