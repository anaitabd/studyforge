from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.send_email")
def send_email_task(to_email: str, subject: str, html_body: str, text_body: str = ""):
    logger.info(f"Sending email to {to_email}: {subject}")
    # Full implementation in Phase 9


@celery_app.task(name="app.tasks.notification_tasks.send_whatsapp")
def send_whatsapp_task(to_number: str, body: str):
    logger.info(f"Sending WhatsApp to {to_number}")
    # Full implementation in Phase 9


@celery_app.task(name="app.tasks.notification_tasks.check_exam_deadlines")
def check_exam_deadlines():
    logger.info("Checking exam deadlines...")
    # Full implementation in Phase 9
