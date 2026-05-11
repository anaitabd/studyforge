import logging
from fastapi import APIRouter, Request, HTTPException, Depends, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from svix.webhooks import Webhook, WebhookVerificationError
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/webhook")
async def clerk_webhook(request: Request, db=Depends(get_db)):
    """Clerk webhook — verifies signature with svix, then upserts/deletes users."""
    if not settings.CLERK_WEBHOOK_SECRET:
        logger.error("CLERK_WEBHOOK_SECRET not configured")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    try:
        wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
        event = wh.verify(payload, headers)
    except WebhookVerificationError as exc:
        logger.warning(f"Invalid Clerk webhook signature: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    event_type = event.get("type")
    data = event.get("data", {})
    clerk_id = data.get("id")
    if not clerk_id:
        return {"status": "ignored", "reason": "no clerk id"}

    if event_type == "session.created":
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            from app.services.analytics_service import track_event
            await track_event(user_id=user.id, event_type="user.login")
        return {"status": "ok", "type": event_type}

    if event_type in ("user.created", "user.updated"):
        primary_id = data.get("primary_email_address_id")
        email = next(
            (e["email_address"] for e in data.get("email_addresses", []) if e.get("id") == primary_id),
            f"{clerk_id}@unknown.local",
        )
        first = data.get("first_name") or ""
        last = data.get("last_name") or ""
        name = f"{first} {last}".strip() or clerk_id
        avatar = data.get("image_url")

        stmt = (
            pg_insert(User)
            .values(clerk_id=clerk_id, email=email, name=name, avatar_url=avatar)
            .on_conflict_do_update(
                index_elements=["clerk_id"],
                set_={"email": email, "name": name, "avatar_url": avatar},
            )
        )
        await db.execute(stmt)
        await db.commit()
        logger.info(f"Synced user {clerk_id} ({email}) via {event_type}")
        return {"status": "ok", "type": event_type}

    if event_type == "user.deleted":
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            user.is_active = False
            await db.commit()
            logger.info(f"Deactivated user {clerk_id}")
        return {"status": "ok", "type": event_type}

    return {"status": "ignored", "type": event_type}
