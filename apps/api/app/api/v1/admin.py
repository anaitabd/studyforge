import asyncio
import logging
import time
import uuid
from typing import Annotated

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import engine, get_db
from app.core.security import require_role
from app.models.audit_log import AuditLog
from app.models.feature_flag import FeatureFlag
from app.models.file import File
from app.models.school import School
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

SuperAdmin = require_role("super_admin")
DB = Annotated[AsyncSession, Depends(get_db)]

# ─── In-memory health cache (15s TTL) ────────────────────────────────────────

_health_cache: dict = {"data": None, "ts": 0.0}
_HEALTH_TTL = 15.0


async def _check_db() -> dict:
    try:
        pool = engine.pool
        return {
            "status": "ok",
            "pool_size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
        }
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


async def _check_redis() -> dict:
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


async def _check_chroma() -> dict:
    try:
        url = f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v2/heartbeat"
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(url)
        return {"status": "ok" if resp.status_code == 200 else "degraded"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


async def _check_s3() -> dict:
    try:
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            region_name=settings.S3_REGION,
            config=Config(connect_timeout=3, read_timeout=3),
        )
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: s3.head_bucket(Bucket=settings.S3_BUCKET))
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


async def _queue_depth(queue_name: str) -> int:
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        depth = await r.llen(queue_name)
        await r.aclose()
        return int(depth)
    except Exception:
        return -1


# ─── Health endpoints ─────────────────────────────────────────────────────────

@router.get("/health/overview")
async def health_overview(_: Annotated[User, SuperAdmin]):
    now = time.monotonic()
    if _health_cache["data"] and (now - _health_cache["ts"]) < _HEALTH_TTL:
        return _health_cache["data"]

    db_status, redis_status, chroma_status, s3_status = await asyncio.gather(
        _check_db(),
        _check_redis(),
        _check_chroma(),
        _check_s3(),
        return_exceptions=False,
    )

    files_q, slides_q, notif_q = await asyncio.gather(
        _queue_depth("files"),
        _queue_depth("slides"),
        _queue_depth("notifications"),
    )

    data = {
        "services": {
            "api": {"status": "ok"},
            "database": db_status,
            "redis": redis_status,
            "vector_db": chroma_status,
            "storage": s3_status,
            "ai_provider": {"status": "ok", "provider": settings.AI_PROVIDER},
        },
        "queues": {
            "files": files_q,
            "slides": slides_q,
            "notifications": notif_q,
        },
        "checked_at": time.time(),
    }
    _health_cache["data"] = data
    _health_cache["ts"] = now
    return data


@router.get("/health/stuck-files")
async def get_stuck_files(
    _: Annotated[User, SuperAdmin],
    db: DB,
    minutes: int = Query(30, ge=5, le=1440),
):
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    result = await db.execute(
        select(File)
        .where(
            File.status.in_(["uploading", "processing"]),
            File.created_at < cutoff,
        )
        .order_by(File.created_at)
        .limit(100)
    )
    files = result.scalars().all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "status": f.status,
            "group_id": f.group_id,
            "size_bytes": f.size_bytes,
            "created_at": f.created_at.isoformat(),
            "stuck_minutes": int((datetime.now(timezone.utc) - f.created_at).total_seconds() / 60),
        }
        for f in files
    ]


@router.post("/health/stuck-files/{file_id}/retry")
async def retry_stuck_file(
    file_id: str,
    _: Annotated[User, SuperAdmin],
    db: DB,
):
    result = await db.execute(select(File).where(File.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.status not in ("uploading", "processing", "error"):
        raise HTTPException(status_code=400, detail="File is not in a retryable state")

    f.status = "processing"
    await db.commit()

    try:
        from app.tasks.file_tasks import process_file_task
        process_file_task.apply_async(args=[file_id], queue="files")
    except Exception as exc:
        logger.warning(f"Could not enqueue file {file_id} retry: {exc}")
        raise HTTPException(status_code=500, detail="Failed to enqueue retry")

    return {"ok": True, "file_id": file_id}


@router.post("/health/stuck-files/{file_id}/mark-error")
async def mark_file_error(
    file_id: str,
    _: Annotated[User, SuperAdmin],
    db: DB,
):
    result = await db.execute(select(File).where(File.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    f.status = "error"
    await db.commit()
    return {"ok": True, "file_id": file_id}


# ─── DLQ endpoints ────────────────────────────────────────────────────────────

def _get_sqs_client():
    import boto3
    return boto3.client("sqs", region_name=settings.AWS_REGION)


def _dlq_url_for(queue_name: str) -> str:
    urls = {
        "files": settings.TASK_SQS_FILE_QUEUE_URL,
        "slides": settings.TASK_SQS_SLIDE_QUEUE_URL,
        "notifications": settings.TASK_SQS_NOTIFICATION_QUEUE_URL,
    }
    return urls.get(queue_name, "")


@router.get("/health/dlq")
async def get_dlq_messages(
    _: Annotated[User, SuperAdmin],
    queue: str = Query("files", regex="^(files|slides|notifications)$"),
    max_messages: int = Query(10, ge=1, le=20),
):
    dlq_url = _dlq_url_for(queue)
    if not dlq_url:
        return {"messages": [], "queue": queue, "note": "DLQ URL not configured"}

    try:
        loop = asyncio.get_event_loop()
        sqs = _get_sqs_client()
        dlq_base = dlq_url.rstrip("/")
        dlq_actual = dlq_base + "-dlq" if not dlq_base.endswith("-dlq") else dlq_base

        response = await loop.run_in_executor(
            None,
            lambda: sqs.receive_message(
                QueueUrl=dlq_actual,
                MaxNumberOfMessages=max_messages,
                AttributeNames=["All"],
                MessageAttributeNames=["All"],
                VisibilityTimeout=30,
                WaitTimeSeconds=1,
            ),
        )
        messages = response.get("Messages", [])
        return {
            "queue": queue,
            "messages": [
                {
                    "message_id": m["MessageId"],
                    "receipt_handle": m["ReceiptHandle"],
                    "body": m.get("Body", ""),
                    "sent_at": m.get("Attributes", {}).get("SentTimestamp"),
                    "receive_count": m.get("Attributes", {}).get("ApproximateReceiveCount"),
                }
                for m in messages
            ],
        }
    except Exception as exc:
        logger.warning(f"DLQ fetch error: {exc}")
        return {"messages": [], "queue": queue, "error": str(exc)}


class DlqRetryRequest(BaseModel):
    receipt_handle: str
    queue: str = "files"


@router.post("/health/dlq/{message_id}/retry")
async def retry_dlq_message(
    message_id: str,
    body: DlqRetryRequest,
    _: Annotated[User, SuperAdmin],
):
    source_url = _dlq_url_for(body.queue)
    if not source_url:
        raise HTTPException(status_code=400, detail="DLQ URL not configured for this queue")

    try:
        loop = asyncio.get_event_loop()
        sqs = _get_sqs_client()
        dlq_actual = source_url.rstrip("/")
        if not dlq_actual.endswith("-dlq"):
            dlq_actual += "-dlq"

        await loop.run_in_executor(
            None,
            lambda: sqs.change_message_visibility(
                QueueUrl=dlq_actual,
                ReceiptHandle=body.receipt_handle,
                VisibilityTimeout=0,
            ),
        )
        return {"ok": True, "message_id": message_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/health/dlq/{message_id}")
async def delete_dlq_message(
    message_id: str,
    _: Annotated[User, SuperAdmin],
    receipt_handle: str = Query(...),
    queue: str = Query("files"),
):
    source_url = _dlq_url_for(queue)
    if not source_url:
        raise HTTPException(status_code=400, detail="DLQ URL not configured for this queue")

    try:
        loop = asyncio.get_event_loop()
        sqs = _get_sqs_client()
        dlq_actual = source_url.rstrip("/")
        if not dlq_actual.endswith("-dlq"):
            dlq_actual += "-dlq"

        await loop.run_in_executor(
            None,
            lambda: sqs.delete_message(
                QueueUrl=dlq_actual,
                ReceiptHandle=receipt_handle,
            ),
        )
        return {"ok": True, "message_id": message_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── AI cost tracking ─────────────────────────────────────────────────────────

@router.get("/health/ai-costs")
async def get_ai_costs(_: Annotated[User, SuperAdmin]):
    return {
        "tracking_enabled": False,
        "note": "AI cost tracking is not yet implemented. Enable it by instrumenting LLM calls with token counters.",
        "total_cost_usd": None,
        "top_consumers": [],
        "daily_chart": [],
    }


# ─── User search & operations ─────────────────────────────────────────────────

@router.get("/users/search")
async def search_users(
    _: Annotated[User, SuperAdmin],
    db: DB,
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
):
    like = f"%{q}%"
    result = await db.execute(
        select(User)
        .where(
            User.is_deleted == False,  # noqa: E712
            (User.email.ilike(like) | User.name.ilike(like)),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
    )
    users = result.scalars().all()

    school_ids = {u.school_id for u in users if u.school_id}
    school_names: dict[str, str] = {}
    if school_ids:
        schools_result = await db.execute(
            select(School).where(School.id.in_(school_ids))
        )
        for s in schools_result.scalars().all():
            school_names[s.id] = s.name

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "plan": u.plan,
            "school": school_names.get(u.school_id) if u.school_id else None,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


class PlanOverrideRequest(BaseModel):
    plan: str
    reason: str | None = None


@router.post("/users/{user_id}/override-plan")
async def override_user_plan(
    user_id: str,
    body: PlanOverrideRequest,
    current_user: Annotated[User, SuperAdmin],
    db: DB,
    request: Request,
):
    valid_plans = ("free", "personal", "school")
    if body.plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Plan must be one of: {', '.join(valid_plans)}")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    old_plan = target.plan
    target.plan = body.plan
    await db.commit()

    log = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_id=user_id,
        action="override_plan",
        reason=body.reason,
        ip=request.client.host if request.client else None,
        meta={"old_plan": old_plan, "new_plan": body.plan},
    )
    db.add(log)
    await db.commit()

    return {"ok": True, "user_id": user_id, "plan": body.plan}


class SuspendRequest(BaseModel):
    reason: str | None = None


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    body: SuspendRequest,
    current_user: Annotated[User, SuperAdmin],
    db: DB,
    request: Request,
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")

    target.is_active = False
    await db.commit()

    try:
        async with httpx.AsyncClient() as client:
            await client.delete(
                f"https://api.clerk.com/v1/users/{target.clerk_id}/sessions",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                timeout=10,
            )
    except Exception as exc:
        logger.warning(f"Failed to revoke Clerk sessions for {target.clerk_id}: {exc}")

    log = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_id=user_id,
        action="suspend_user",
        reason=body.reason,
        ip=request.client.host if request.client else None,
        metadata={"clerk_id": target.clerk_id, "email": target.email},
    )
    db.add(log)
    await db.commit()

    return {"ok": True, "user_id": user_id}


# ─── Feature flags ────────────────────────────────────────────────────────────

@router.get("/feature-flags")
async def list_feature_flags(
    _: Annotated[User, SuperAdmin],
    db: DB,
):
    result = await db.execute(select(FeatureFlag).order_by(FeatureFlag.key))
    flags = result.scalars().all()
    return [
        {
            "key": f.key,
            "label": f.label,
            "description": f.description,
            "enabled": f.enabled,
            "enabled_for_plans": f.enabled_for_plans or [],
            "updated_at": f.updated_at.isoformat(),
        }
        for f in flags
    ]


class FlagUpdateRequest(BaseModel):
    enabled: bool
    enabled_for_plans: list[str] | None = None


@router.patch("/feature-flags/{key}")
async def update_feature_flag(
    key: str,
    body: FlagUpdateRequest,
    current_user: Annotated[User, SuperAdmin],
    db: DB,
    request: Request,
):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    old_enabled = flag.enabled
    flag.enabled = body.enabled
    if body.enabled_for_plans is not None:
        flag.enabled_for_plans = body.enabled_for_plans
    await db.commit()

    log = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_id=None,
        action="update_feature_flag",
        ip=request.client.host if request.client else None,
        metadata={"flag": key, "old_enabled": old_enabled, "new_enabled": body.enabled},
    )
    db.add(log)
    await db.commit()

    return {
        "key": flag.key,
        "label": flag.label,
        "enabled": flag.enabled,
        "enabled_for_plans": flag.enabled_for_plans or [],
        "updated_at": flag.updated_at.isoformat(),
    }


# ─── Schools (existing) ───────────────────────────────────────────────────────

@router.get("/schools")
async def list_schools(
    _: Annotated[User, SuperAdmin],
    db: DB,
):
    result = await db.execute(select(School).order_by(School.name))
    schools = result.scalars().all()
    return {
        "schools": [
            {"id": s.id, "name": s.name, "created_at": s.created_at.isoformat()}
            for s in schools
        ]
    }
