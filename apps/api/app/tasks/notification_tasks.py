import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.notification_tasks.send_email",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def send_email_task(self, to_email: str, subject: str, html_body: str, text_body: str = ""):
    """Send a transactional email via SendGrid. Silently skips if API key is not set."""
    from app.core.config import settings

    if not settings.SENDGRID_API_KEY:
        logger.debug(f"SendGrid not configured — skipping email to {to_email}")
        return

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Content, To

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email="noreply@studyforge.app",
            to_emails=To(to_email),
            subject=subject,
        )
        message.add_content(Content("text/html", html_body))
        if text_body:
            message.add_content(Content("text/plain", text_body))

        response = sg.send(message)
        logger.info(f"Email sent to {to_email}: status {response.status_code}")
    except Exception as exc:
        logger.error(f"Email send failed for {to_email}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.notification_tasks.send_whatsapp",
    bind=True,
    max_retries=1,
    default_retry_delay=600,  # retry once after 10 min (WhatsApp rate limits)
)
def send_whatsapp_task(self, to_number: str, body: str):
    """Send a WhatsApp message via Twilio. Silently skips if credentials are not set."""
    from app.core.config import settings

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.debug(f"Twilio not configured — skipping WhatsApp to {to_number}")
        return

    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # Ensure number is in whatsapp: format
        to = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number

        message = client.messages.create(
            body=body,
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to,
        )
        logger.info(f"WhatsApp sent to {to_number}: SID {message.sid}")
    except Exception as exc:
        logger.error(f"WhatsApp send failed for {to_number}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.notification_tasks.check_exam_deadlines")
def check_exam_deadlines():
    """
    Hourly beat task: find exams closing in ~24h or ~2h and send reminders
    to students who haven't submitted yet.
    """
    import asyncio
    asyncio.run(_check_deadlines_async())


async def _check_deadlines_async():
    from datetime import datetime, timezone, timedelta

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.exam import Exam
    from app.models.group import GroupMember
    from app.services.notification_service import notify_exam_deadline

    now = datetime.now(timezone.utc)

    # Windows: find exams whose deadline falls inside the next 24–25h or 2–3h
    windows = [
        (timedelta(hours=24), timedelta(hours=25), 24),
        (timedelta(hours=2),  timedelta(hours=3),  2),
    ]

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
                # Fetch group_id via the exam directly
                try:
                    await notify_exam_deadline(
                        db=db,
                        group_id=exam.group_id,
                        exam_id=exam.id,
                        exam_title=exam.title,
                        hours_until=label_hours,
                    )
                except Exception as e:
                    logger.error(
                        f"Deadline notification failed for exam {exam.id}: {e}"
                    )

    logger.info("Exam deadline check complete")
