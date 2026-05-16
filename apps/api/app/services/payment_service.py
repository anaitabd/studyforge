"""
Payment service supporting:
1. Stripe (international cards, Apple Pay, Google Pay)
2. CMI (Moroccan cards — Visa/Mastercard issued by Moroccan banks)
3. CashPlus (cash-in at partner stores — common in Morocco)
"""
import uuid
import logging
import stripe as stripe_lib
from app.core.config import settings
from app.core.plans import PLANS

logger = logging.getLogger(__name__)


def _stripe():
    stripe_lib.api_key = settings.STRIPE_SECRET_KEY
    return stripe_lib


async def create_checkout_session(
    user_id: str,
    plan: str,
    payment_method: str = "stripe",  # "stripe" | "cmi" | "cashplus"
    success_url: str = "",
    cancel_url: str = "",
) -> dict:
    plan_config = PLANS.get(plan, {})

    if payment_method == "stripe":
        price_id = plan_config.get("stripe_price_id", "")
        if not price_id or not settings.STRIPE_SECRET_KEY:
            raise ValueError("Stripe not configured or invalid plan")
        session = _stripe().checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url or f"{settings.FRONTEND_URL}/account?upgraded=1",
            cancel_url=cancel_url or f"{settings.FRONTEND_URL}/pricing",
            metadata={"user_id": user_id, "plan": plan},
            payment_method_types=["card"],
            locale="fr",
        )
        return {"url": session.url, "session_id": session.id}

    elif payment_method == "cmi":
        # CMI integration — redirect to CMI hosted payment page
        cmi_payload = {
            "clientid": settings.CMI_CLIENT_ID,
            "amount": f"{plan_config.get('price_mad', 0):.2f}",
            "currency": "504",  # MAD ISO 4217
            "lang": "fr",
            "callbackUrl": f"{settings.API_BASE_URL}/api/v1/webhooks/cmi",
            "okUrl": success_url or f"{settings.FRONTEND_URL}/account?upgraded=1",
            "failUrl": cancel_url or f"{settings.FRONTEND_URL}/pricing",
            "shopurl": settings.FRONTEND_URL,
            "trantype": "PreAuth",
            "storetype": "3d_pay_hosting",
            "hashAlgorithm": "ver3",
            "rnd": str(uuid.uuid4()),
        }
        return {"url": settings.CMI_PAYMENT_URL, "form_data": cmi_payload}

    elif payment_method == "cashplus":
        return {
            "payment_code": f"SF-{uuid.uuid4().hex[:8].upper()}",
            "amount_mad": plan_config.get("price_mad", 0),
            "expires_hours": 48,
            "instructions": "Présentez ce code dans un point CashPlus partenaire",
            "find_stores_url": "https://www.cashplus.ma/trouver-un-point",
        }

    raise ValueError(f"Unknown payment method: {payment_method}")


async def handle_stripe_webhook(payload: bytes, signature: str) -> dict:
    """Process Stripe webhooks for subscription lifecycle."""
    event = _stripe().Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )
    logger.info("Stripe webhook: %s", event.type)
    return {"received": True, "event_type": event.type}


async def upgrade_user_plan(db, user_id: str, new_plan: str) -> None:
    """Upgrade a user's plan in the DB — called from webhooks."""
    from sqlalchemy import update
    from app.models.user import User
    await db.execute(update(User).where(User.id == user_id).values(plan=new_plan))
    await db.commit()
