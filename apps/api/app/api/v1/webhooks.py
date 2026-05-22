import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/paypal")
async def paypal_webhook(request: Request, db: DB):
    """PayPal webhook — handles order and payment capture events."""
    payload = await request.body()
    headers = dict(request.headers)

    from app.services.payment_service import handle_paypal_webhook, upgrade_user_plan
    try:
        result = await handle_paypal_webhook(payload, headers)
    except Exception as exc:
        logger.warning("PayPal webhook processing error: %s", exc)
        raise HTTPException(status_code=400, detail="Webhook processing failed")

    event_type = result.get("event_type", "")
    if event_type in ("CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED"):
        import json as _json
        try:
            event = _json.loads(payload)
            resource = event.get("resource", {})
            purchase_units = resource.get("purchase_units", [])
            for unit in purchase_units:
                ref = unit.get("reference_id", "")
                if ":" in ref:
                    user_id, plan = ref.split(":", 1)
                    await upgrade_user_plan(db, user_id, plan)
                    logger.info("PayPal upgraded user %s to %s", user_id, plan)
        except Exception as exc:
            logger.warning("Could not process PayPal event payload: %s", exc)

    return {"received": True}


@router.post("/clerk")
async def clerk_webhook(request: Request, db: DB):
    """Clerk user lifecycle webhooks (user.created, user.deleted, etc.)."""
    from app.core.security import handle_clerk_webhook
    payload = await request.body()
    svix_id = request.headers.get("svix-id", "")
    svix_ts = request.headers.get("svix-timestamp", "")
    svix_sig = request.headers.get("svix-signature", "")

    try:
        await handle_clerk_webhook(db, payload, svix_id, svix_ts, svix_sig)
    except Exception as exc:
        logger.warning("Clerk webhook error: %s", exc)
        raise HTTPException(status_code=400, detail="Webhook error")

    return {"received": True}
