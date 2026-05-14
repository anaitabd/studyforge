"""
Plan limit enforcement.

Limits are defined here as a dict (matching what will later live in plan_limits table).
check_plan_limit() raises HTTP 429 with structured detail when a limit is exceeded.
enforce_limit() is a FastAPI Depends factory for use as a route dependency.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

# None = unlimited
PLAN_LIMITS: dict[str, dict[str, Any]] = {
    "free": {
        "max_groups": 1,
        "max_files_per_group": 3,
        "max_chat_per_day": 10,
        "max_exams_per_month": 1,
        "max_students": 5,
        "can_use_whatsapp": False,
        "can_generate_slides": False,
        "storage_gb": 0.5,
    },
    "personal": {  # legacy plan name in existing DB
        "max_groups": 10,
        "max_files_per_group": 20,
        "max_chat_per_day": 100,
        "max_exams_per_month": 20,
        "max_students": 50,
        "can_use_whatsapp": False,
        "can_generate_slides": True,
        "storage_gb": 5.0,
    },
    "teacher_solo": {
        "max_groups": 10,
        "max_files_per_group": 20,
        "max_chat_per_day": 100,
        "max_exams_per_month": 20,
        "max_students": 50,
        "can_use_whatsapp": False,
        "can_generate_slides": True,
        "storage_gb": 5.0,
    },
    "school": {  # legacy plan name in existing DB
        "max_groups": 50,
        "max_files_per_group": 50,
        "max_chat_per_day": None,
        "max_exams_per_month": 200,
        "max_students": 200,
        "can_use_whatsapp": True,
        "can_generate_slides": True,
        "storage_gb": 20.0,
    },
    "school_starter": {
        "max_groups": 50,
        "max_files_per_group": 50,
        "max_chat_per_day": None,
        "max_exams_per_month": 200,
        "max_students": 200,
        "can_use_whatsapp": True,
        "can_generate_slides": True,
        "storage_gb": 20.0,
    },
    "school_pro": {
        "max_groups": None,
        "max_files_per_group": None,
        "max_chat_per_day": None,
        "max_exams_per_month": None,
        "max_students": 600,
        "can_use_whatsapp": True,
        "can_generate_slides": True,
        "storage_gb": 100.0,
    },
    "enterprise": {
        "max_groups": None,
        "max_files_per_group": None,
        "max_chat_per_day": None,
        "max_exams_per_month": None,
        "max_students": None,
        "can_use_whatsapp": True,
        "can_generate_slides": True,
        "storage_gb": 500.0,
    },
}

_FREE_LIMITS = PLAN_LIMITS["free"]


def get_limits(plan: str) -> dict[str, Any]:
    return PLAN_LIMITS.get(plan, _FREE_LIMITS)


async def check_plan_limit(
    user,
    limit_key: str,
    current_count: int,
) -> None:
    """
    Raises HTTP 429 if current_count >= the plan's limit for limit_key.
    None limit = unlimited (never raises).
    """
    plan = getattr(user, "plan", "free") or "free"
    limits = get_limits(plan)
    max_val = limits.get(limit_key)

    if max_val is not None and current_count >= max_val:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "LIMIT_REACHED",
                "limit": limit_key,
                "current": current_count,
                "max": max_val,
                "plan": plan,
                "upgrade_url": f"{settings.FRONTEND_URL}/billing",
            },
        )


async def check_feature_flag(user, feature_key: str) -> None:
    """
    Raises HTTP 429 if the plan doesn't include a boolean feature (e.g. can_generate_slides).
    """
    plan = getattr(user, "plan", "free") or "free"
    limits = get_limits(plan)
    if not limits.get(feature_key, False):
        raise HTTPException(
            status_code=429,
            detail={
                "code": "FEATURE_NOT_AVAILABLE",
                "feature": feature_key,
                "plan": plan,
                "upgrade_url": f"{settings.FRONTEND_URL}/billing",
            },
        )


def enforce_limit(limit_key: str, count_fn: Callable):
    """
    FastAPI Depends factory.

    Usage:
        @router.post("/", dependencies=[Depends(enforce_limit("max_groups", count_user_groups))])

    count_fn signature: async (db: AsyncSession, user) -> int
    """
    async def dep(
        db: AsyncSession = Depends(get_db),
        user=Depends(get_current_user),
    ):
        count = await count_fn(db, user)
        await check_plan_limit(user, limit_key, count)

    return dep


def enforce_feature(feature_key: str):
    """
    FastAPI Depends factory for boolean plan features.

    Usage:
        @router.post("/generate", dependencies=[Depends(enforce_feature("can_generate_slides"))])
    """
    async def dep(user=Depends(get_current_user)):
        await check_feature_flag(user, feature_key)

    return dep
