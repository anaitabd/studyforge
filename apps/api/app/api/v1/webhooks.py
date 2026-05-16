import base64
import hashlib
import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/stripe")
async def stripe_webhook(request: Request, db: DB):
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret not configured")

    from app.services.payment_service import handle_stripe_webhook, upgrade_user_plan
    try:
        await handle_stripe_webhook(payload, signature)
    except Exception as exc:
        logger.warning("Stripe webhook verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Re-parse to extract metadata for plan upgrades
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = settings.STRIPE_SECRET_KEY
        full = stripe_lib.Webhook.construct_event(
            payload, signature, settings.STRIPE_WEBHOOK_SECRET
        )
        event_type = full.type
        if event_type in (
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
        ):
            obj = full.data.object
            metadata = getattr(obj, "metadata", {}) or {}
            user_id = metadata.get("user_id")
            plan = metadata.get("plan")
            if user_id and plan:
                await upgrade_user_plan(db, user_id, plan)
                logger.info("Stripe upgraded user %s to %s", user_id, plan)
    except Exception as exc:
        logger.warning("Could not process Stripe event payload: %s", exc)

    return {"received": True}


@router.post("/cmi")
async def cmi_webhook(request: Request, db: DB):
    """CMI payment gateway callback — form-encoded POST."""
    form = await request.form()
    response_code = form.get("ProcReturnCode", "")
    oid = form.get("oid", "")
    store_key = settings.CMI_STORE_KEY

    if store_key:
        hash_params = form.get("HASH", "")
        hash_input = "|".join([
            form.get("clientid", ""),
            oid,
            form.get("amount", ""),
            form.get("okUrl", ""),
            form.get("failUrl", ""),
            form.get("trantype", ""),
            form.get("instalment", ""),
            form.get("rnd", ""),
            store_key,
        ])
        raw_hex = hmac.new(
            store_key.encode(), hash_input.encode(), hashlib.sha512
        ).hexdigest()
        computed_b64 = base64.b64encode(bytes.fromhex(raw_hex)).decode()
        if not hmac.compare_digest(computed_b64, hash_params):
            logger.warning("CMI webhook HASH mismatch for oid=%s", oid)
            return "ACTION=FAILURE"

    if response_code == "00":
        user_id = form.get("userId", "")
        plan = form.get("plan", "")
        if user_id and plan:
            from app.services.payment_service import upgrade_user_plan
            await upgrade_user_plan(db, user_id, plan)
            logger.info("CMI payment success: upgraded user %s to %s", user_id, plan)
        return "ACTION=POSTAUTH"

    logger.info("CMI payment declined for oid=%s code=%s", oid, response_code)
    return "ACTION=FAILURE"
