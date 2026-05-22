import logging

logger = logging.getLogger(__name__)


def send_whatsapp(to_number: str, body: str):
    from app.core.config import settings

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.debug(f"Twilio not configured — skipping WhatsApp to {to_number}")
        return

    from twilio.rest import Client

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    to = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
    client.messages.create(body=body, from_=settings.TWILIO_WHATSAPP_FROM, to=to)
