import logging
import re
import uuid
from datetime import datetime, date, timezone, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.chat import ChatMessage
from app.models.exam import Exam, ExamSession, Question
from app.models.file import File
from app.models.flashcard import Flashcard, FlashcardProgress, FlashcardSet
from app.models.goal import KpiCache, StreakRecord, StudyGoal
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
        "org_id": user.org_id,
        "account_type": user.account_type,
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


# ── individual KPI endpoints ───────────────────────────────────────────────────

async def _compute_streak(user_id: str, db: AsyncSession) -> dict:
    records = (await db.execute(
        select(StreakRecord)
        .where(StreakRecord.user_id == user_id, StreakRecord.has_activity == True)
        .order_by(StreakRecord.date.desc())
        .limit(365)
    )).scalars().all()

    today = date.today()
    record_dates = {r.date for r in records}

    current = 0
    d = today
    while d in record_dates:
        current += 1
        d -= timedelta(days=1)

    longest = 0
    run = 0
    if records:
        prev = records[0].date
        run = 1
        for r in records[1:]:
            if (prev - r.date).days == 1:
                run += 1
            else:
                run = 1
            longest = max(longest, run)
            prev = r.date
        longest = max(longest, run)

    return {
        "current": current,
        "longest": max(longest, current),
        "today_active": today in record_dates,
    }


@router.get("/kpis")
async def get_personal_kpis(current_user: CurrentUser, db: DB):
    """
    Personal KPI panel — all computed live from user_events + OLTP tables.
    Returns the shape documented in the implementation spec.
    """
    user_id = current_user.id
    today = date.today()
    day_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    # ── active minutes today (from reading_events) ─────────────────────────
    from app.models.notification import ReadingEvent
    active_s_today = (await db.execute(
        select(func.sum(ReadingEvent.active_time_s)).where(
            ReadingEvent.user_id == user_id,
            ReadingEvent.session_start >= day_start,
        )
    )).scalar() or 0
    active_minutes_today = round(active_s_today / 60)

    # ── flashcard retention ────────────────────────────────────────────────
    total_reviews = (await db.execute(
        select(func.count(FlashcardProgress.id)).where(FlashcardProgress.user_id == user_id)
    )).scalar() or 0

    # "good" or "easy" reviews: ease_factor > 2.5 (default is 2.5, increases on good answers)
    good_reviews = (await db.execute(
        select(func.count(FlashcardProgress.id)).where(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.ease_factor > 2.5,
        )
    )).scalar() or 0
    retention_rate = round(good_reviews / total_reviews, 4) if total_reviews else None

    # ── cards due / overdue ────────────────────────────────────────────────
    cards_due = (await db.execute(
        select(func.count(FlashcardProgress.id)).where(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.due_date <= today,
        )
    )).scalar() or 0

    yesterday = today - timedelta(days=1)
    cards_overdue = (await db.execute(
        select(func.count(FlashcardProgress.id)).where(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.due_date <= yesterday,
        )
    )).scalar() or 0

    # ── exam score trend (last 10 submitted sessions) ──────────────────────
    sessions = (await db.execute(
        select(ExamSession)
        .where(ExamSession.user_id == user_id, ExamSession.submitted_at.is_not(None))
        .order_by(ExamSession.submitted_at.desc())
        .limit(10)
    )).scalars().all()
    score_trend = [
        {
            "date": s.submitted_at.date().isoformat(),
            "score": round(s.score / s.total, 4) if s.score is not None and s.total else None,
        }
        for s in reversed(sessions)
    ]

    # ── streak ─────────────────────────────────────────────────────────────
    streak = await _compute_streak(user_id, db)

    # ── active study goal ──────────────────────────────────────────────────
    goal = (await db.execute(
        select(StudyGoal)
        .where(StudyGoal.user_id == user_id, StudyGoal.status == "active")
        .order_by(StudyGoal.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    goal_out = None
    if goal:
        days_left = (goal.target_date - today).days if goal.target_date else None
        on_pace = (days_left is not None and days_left > 0 and active_minutes_today >= 30)
        goal_out = {
            "id": goal.id,
            "title": goal.title,
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "target_score": goal.target_score,
            "days_remaining": days_left,
            "on_pace": on_pace,
        }

    return {
        "active_minutes_today": active_minutes_today,
        "active_minutes_goal": 60,
        "flashcard_retention_rate": retention_rate,
        "cards_due_today": cards_due,
        "cards_overdue": cards_overdue,
        "exam_score_trend": score_trend,
        "streak": streak,
        "weak_areas": [],  # populated by /me/weak-areas endpoint
        "study_goal": goal_out,
    }


class GoalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    target_date: str | None = None  # ISO date
    target_score: float | None = Field(default=None, ge=0.0, le=1.0)
    subject: str | None = None
    file_ids: list[str] = Field(default_factory=list)


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    target_date: str | None = None
    target_score: float | None = Field(default=None, ge=0.0, le=1.0)
    status: str | None = Field(default=None, pattern=r"^(active|achieved|abandoned)$")


@router.post("/goals")
async def create_goal(body: GoalCreate, current_user: CurrentUser, db: DB):
    """Create a personal study goal."""
    goal = StudyGoal(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title=body.title,
        target_date=date.fromisoformat(body.target_date) if body.target_date else None,
        target_score=body.target_score,
        subject=body.subject,
        file_ids=body.file_ids,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return {
        "id": goal.id, "title": goal.title,
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "status": goal.status, "created_at": goal.created_at.isoformat(),
    }


@router.get("/goals")
async def list_goals(current_user: CurrentUser, db: DB):
    """List study goals with progress percentage."""
    goals = (await db.execute(
        select(StudyGoal)
        .where(StudyGoal.user_id == current_user.id)
        .order_by(StudyGoal.created_at.desc())
    )).scalars().all()

    today = date.today()
    result = []
    for g in goals:
        days_left = (g.target_date - today).days if g.target_date else None
        result.append({
            "id": g.id, "title": g.title, "subject": g.subject,
            "target_date": g.target_date.isoformat() if g.target_date else None,
            "target_score": g.target_score,
            "status": g.status,
            "days_remaining": days_left,
            "file_ids": g.file_ids or [],
            "created_at": g.created_at.isoformat(),
        })

    return {"goals": result}


@router.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, body: GoalUpdate, current_user: CurrentUser, db: DB):
    """Update or mark a study goal achieved/abandoned."""
    goal = (await db.execute(
        select(StudyGoal).where(StudyGoal.id == goal_id, StudyGoal.user_id == current_user.id)
    )).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="goal_not_found")

    if body.title is not None:
        goal.title = body.title
    if body.target_date is not None:
        goal.target_date = date.fromisoformat(body.target_date)
    if body.target_score is not None:
        goal.target_score = body.target_score
    if body.status is not None:
        goal.status = body.status

    await db.commit()
    return {
        "id": goal.id, "title": goal.title, "status": goal.status,
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
    }


@router.get("/streak")
async def get_streak(current_user: CurrentUser, db: DB):
    """Current streak, longest streak, and whether user has activity today."""
    return await _compute_streak(current_user.id, db)


@router.get("/weak-areas")
async def get_weak_areas(current_user: CurrentUser, db: DB):
    """
    AI-identified weak concepts from the last 10 wrong exam answers.
    Uses generate_structured_json with the existing ai_service pattern.
    """
    wrong_answers = (await db.execute(
        select(ExamSession, Question)
        .join(Question, Question.exam_id == ExamSession.exam_id)
        .where(
            ExamSession.user_id == current_user.id,
            ExamSession.submitted_at.is_not(None),
        )
        .order_by(ExamSession.submitted_at.desc())
        .limit(5)
    )).all()

    wrong_texts = []
    for session, question in wrong_answers:
        user_answer = (session.answers or {}).get(question.id)
        if user_answer and user_answer.upper() != question.correct_answer.upper():
            wrong_texts.append(f"Q: {question.content[:200]} | Wrong: {user_answer} | Correct: {question.correct_answer}")

    if not wrong_texts:
        return {"weak_areas": []}

    try:
        from app.services.ai_service import ai_service
        prompt = (
            "Based on these wrong exam answers, identify 3-5 specific concepts the student "
            "struggles with. Return only the concept names, no explanations.\n\n"
            + "\n".join(wrong_texts[:10])
        )
        result = await ai_service.generate_structured_json(
            prompt=prompt,
            schema_description='["concept name", "concept name", ...]',
            max_tokens=256,
        )
        weak_areas = result if isinstance(result, list) else []
    except Exception as exc:
        logger.warning("weak-areas AI call failed: %s", exc)
        weak_areas = []

    return {"weak_areas": [str(w) for w in weak_areas[:5]]}
