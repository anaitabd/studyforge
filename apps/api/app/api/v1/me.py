import logging
import re
from datetime import datetime, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.chat import ChatMessage
from app.models.exam import Exam
from app.models.file import File
from app.models.group import GroupMember
from app.models.notification import Subscription
from app.models.school import School
from app.models.user import User
from app.services import learning_path_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/me", tags=["me"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

_LIMITS = {
    "free":     {"chat_day": 20,  "exams_month": 5,   "groups": 1},
    "personal": {"chat_day": 100, "exams_month": 30,  "groups": 10},
    "school":   {"chat_day": 200, "exams_month": 100, "groups": 50},
}

_E164 = re.compile(r"^\+[1-9]\d{6,14}$")


async def _build_account(user: User, db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    chat_today = (await db.execute(
        select(func.count()).select_from(ChatMessage).where(
            ChatMessage.user_id == user.id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= today_start,
        )
    )).scalar_one()

    exams_month = (await db.execute(
        select(func.count()).select_from(Exam).where(
            Exam.creator_id == user.id,
            Exam.created_at >= month_start,
        )
    )).scalar_one()

    groups_owned = (await db.execute(
        select(func.count()).select_from(GroupMember).where(
            GroupMember.user_id == user.id,
            GroupMember.role == "owner",
        )
    )).scalar_one()

    files_total = (await db.execute(
        select(func.count()).select_from(File).where(File.user_id == user.id)
    )).scalar_one()

    limits = _LIMITS.get(user.plan, _LIMITS["free"])

    sub_row = (await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
    )).scalar_one_or_none()

    if sub_row:
        subscription = {
            "status": sub_row.status,
            "plan": sub_row.plan,
            "current_period_end": sub_row.period_end.isoformat() if sub_row.period_end else None,
            "stripe_customer_id": sub_row.stripe_customer_id,
            "cancel_at_period_end": sub_row.cancel_at_period_end,
        }
    else:
        subscription = {
            "status": "none",
            "plan": user.plan,
            "current_period_end": None,
            "stripe_customer_id": None,
            "cancel_at_period_end": False,
        }

    school_name = None
    if user.school_id:
        school = (await db.execute(
            select(School).where(School.id == user.school_id)
        )).scalar_one_or_none()
        school_name = school.name if school else None

    return {
        "id": user.id,
        "clerk_id": user.clerk_id,
        "full_name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "role": user.role,
        "plan": user.plan,
        "school_name": school_name,
        "whatsapp_number": user.wa_number,
        "created_at": user.created_at.isoformat(),
        "usage": {
            "chat_messages_today": chat_today,
            "chat_messages_limit_day": limits["chat_day"],
            "exams_generated_month": exams_month,
            "exams_limit_month": limits["exams_month"],
            "groups_count": groups_owned,
            "groups_limit": limits["groups"],
            "files_uploaded_total": files_total,
        },
        "subscription": subscription,
        "notifications": {
            "email_enabled": user.notif_email,
            "whatsapp_enabled": user.notif_whatsapp,
            "in_app_enabled": user.notif_in_app,
        },
    }


@router.get("/continue-learning")
async def continue_learning(current_user: CurrentUser, db: DB, limit: int = 6):
    limit = max(1, min(limit, 20))
    items = await learning_path_service.get_continue_learning(db=db, user_id=current_user.id, limit=limit)
    return {"items": items}


@router.get("/account")
async def get_account(current_user: CurrentUser, db: DB):
    return await _build_account(current_user, db)


class UpdateAccountRequest(BaseModel):
    full_name: str | None = None
    whatsapp_number: str | None = None


@router.patch("/account")
async def update_account(body: UpdateAccountRequest, current_user: CurrentUser, db: DB):
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()

    if body.full_name is not None:
        name = body.full_name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="full_name cannot be empty")
        user.name = name

    if body.whatsapp_number is not None:
        if body.whatsapp_number == "":
            user.wa_number = None
        elif not _E164.match(body.whatsapp_number):
            raise HTTPException(
                status_code=422,
                detail="whatsapp_number must be in E.164 format (e.g. +12025550100)",
            )
        else:
            user.wa_number = body.whatsapp_number

    await db.commit()
    await db.refresh(user)
    return await _build_account(user, db)


class UpdateNotificationsRequest(BaseModel):
    email_enabled: bool | None = None
    whatsapp_enabled: bool | None = None
    in_app_enabled: bool | None = None


@router.patch("/notifications")
async def update_notifications(body: UpdateNotificationsRequest, current_user: CurrentUser, db: DB):
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()

    if body.email_enabled is not None:
        user.notif_email = body.email_enabled
    if body.whatsapp_enabled is not None:
        if body.whatsapp_enabled and user.plan not in ("school",):
            raise HTTPException(status_code=403, detail="WhatsApp notifications require the School plan")
        user.notif_whatsapp = body.whatsapp_enabled
    if body.in_app_enabled is not None:
        user.notif_in_app = body.in_app_enabled

    await db.commit()
    await db.refresh(user)
    return {
        "email_enabled": user.notif_email,
        "whatsapp_enabled": user.notif_whatsapp,
        "in_app_enabled": user.notif_in_app,
    }


@router.post("/billing-portal")
async def billing_portal(current_user: CurrentUser, db: DB):
    if current_user.plan == "school":
        raise HTTPException(status_code=403, detail="Billing is managed by your school")

    customer_id = current_user.stripe_customer_id
    if not customer_id:
        sub_row = (await db.execute(
            select(Subscription)
            .where(Subscription.user_id == current_user.id)
            .order_by(Subscription.created_at.desc())
        )).scalar_one_or_none()
        if sub_row:
            customer_id = sub_row.stripe_customer_id

    if not customer_id or not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=400, detail="No billing account found. Please upgrade first.")

    try:
        import stripe  # type: ignore[import]
        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.FRONTEND_URL}/account",
        )
        return {"url": session.url}
    except Exception:
        logger.exception("Stripe billing portal error for user %s", current_user.id)
        raise HTTPException(status_code=500, detail="Failed to create billing portal session")


class DeleteAccountRequest(BaseModel):
    confirmation: str


@router.delete("/account", status_code=204)
async def delete_account(body: DeleteAccountRequest, current_user: CurrentUser, db: DB):
    if body.confirmation != "DELETE":
        raise HTTPException(status_code=422, detail='Confirmation must be exactly "DELETE"')

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()

    if settings.CLERK_SECRET_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.delete(
                    f"https://api.clerk.com/v1/users/{user.clerk_id}",
                    headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                )
        except Exception:
            logger.exception("Failed to delete Clerk user %s", user.clerk_id)

    user.name = f"Deleted User {user.id[:8]}"
    user.email = f"deleted_{user.id}@deleted.invalid"
    user.avatar_url = None
    user.wa_number = None
    user.is_active = False
    user.is_deleted = True

    await db.commit()
