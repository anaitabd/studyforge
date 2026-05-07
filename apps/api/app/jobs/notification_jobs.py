import logging

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_body: str, text_body: str = "", idempotency_key: str | None = None):
    from app.core.config import settings

    if not settings.SENDGRID_API_KEY:
        logger.debug(f"SendGrid not configured — skipping email to {to_email}")
        return

    import sendgrid
    from sendgrid.helpers.mail import Mail, Content, To

    sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    message = Mail(from_email="noreply@studyforge.app", to_emails=To(to_email), subject=subject)
    if idempotency_key:
        message.custom_args = {"idempotency_key": idempotency_key}
    message.add_content(Content("text/html", html_body))
    if text_body:
        message.add_content(Content("text/plain", text_body))
    sg.send(message)


def send_whatsapp(to_number: str, body: str):
    from app.core.config import settings

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.debug(f"Twilio not configured — skipping WhatsApp to {to_number}")
        return

    from twilio.rest import Client

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    to = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
    client.messages.create(body=body, from_=settings.TWILIO_WHATSAPP_FROM, to=to)
