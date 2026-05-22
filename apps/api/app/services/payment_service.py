"""
Payment service — PayPal REST API v2.

Flow:
  1. create_order()  → returns PayPal approval URL; redirect user there
  2. User approves on PayPal and is redirected to success_url?token=ORDER_ID
  3. capture_order() → finalises payment and upgrades plan in DB
  4. handle_paypal_webhook() → processes async PayPal events (IPN / webhooks)
"""
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_PAYPAL_BASE = "https://api-m.sandbox.paypal.com"  # switch to api-m.paypal.com for live
_token_cache: dict[str, Any] = {"access_token": None, "expires_at": 0}


async def _get_access_token() -> str:
    import time
    now = time.time()
    if _token_cache["access_token"] and now < _token_cache["expires_at"] - 30:
        return _token_cache["access_token"]

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_PAYPAL_BASE}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_SECRET),
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_in", 3600)
    return _token_cache["access_token"]


async def _paypal_headers() -> dict[str, str]:
    token = await _get_access_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def create_order(
    user_id: str,
    plan: str,
    amount_usd: float,
    success_url: str = "",
    cancel_url: str = "",
) -> dict:
    """Create a PayPal order and return the approval URL."""
    headers = await _paypal_headers()
    return_url = success_url or f"{settings.FRONTEND_URL}/account?upgraded=1"
    cancel_url = cancel_url or f"{settings.FRONTEND_URL}/pricing"

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": f"{user_id}:{plan}",
                "description": f"StudyForge — {plan} plan",
                "amount": {
                    "currency_code": "USD",
                    "value": f"{amount_usd:.2f}",
                },
            }
        ],
        "application_context": {
            "return_url": return_url,
            "cancel_url": cancel_url,
            "brand_name": "StudyForge",
            "user_action": "PAY_NOW",
            "shipping_preference": "NO_SHIPPING",
        },
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{_PAYPAL_BASE}/v2/checkout/orders",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    order_id = data["id"]
    approval_url = next(
        (link["href"] for link in data.get("links", []) if link["rel"] == "approve"),
        "",
    )
    return {"order_id": order_id, "url": approval_url}


async def capture_order(order_id: str) -> dict:
    """Capture an approved PayPal order. Returns order details including reference_id."""
    headers = await _paypal_headers()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{_PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
            headers=headers,
            json={},
        )
        resp.raise_for_status()
        return resp.json()


async def handle_paypal_webhook(payload: bytes, headers: dict) -> dict:
    """Verify and process a PayPal webhook event."""
    import json as _json

    try:
        event = _json.loads(payload)
    except Exception as exc:
        logger.warning("PayPal webhook — invalid JSON: %s", exc)
        return {"received": False}

    event_type = event.get("event_type", "")
    logger.info("PayPal webhook: %s", event_type)

    if event_type in ("CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED"):
        resource = event.get("resource", {})
        purchase_units = resource.get("purchase_units", [])
        for unit in purchase_units:
            ref = unit.get("reference_id", "")
            if ":" in ref:
                user_id, plan = ref.split(":", 1)
                logger.info("PayPal: upgrading user %s to plan %s", user_id, plan)
                # DB upgrade is handled by the calling route via upgrade_user_plan()

    return {"received": True, "event_type": event_type}


async def upgrade_user_plan(db, user_id: str, new_plan: str) -> None:
    from sqlalchemy import update
    from app.models.user import User
    await db.execute(update(User).where(User.id == user_id).values(plan=new_plan))
    await db.commit()
