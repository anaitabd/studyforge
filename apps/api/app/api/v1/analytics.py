import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.file import File
from app.models.group import GroupMember
from app.models.notification import ReadingEvent
from app.services.analytics_service import track_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


class ReadingEventBody(BaseModel):
    file_id: str
    group_id: str | None = None
    scroll_depth_pct: float = Field(0.0, ge=0.0, le=1.0)
    active_time_seconds: int = Field(0, ge=0)


@router.post("/reading-event", status_code=status.HTTP_204_NO_CONTENT)
async def track_reading(
    body: ReadingEventBody,
    current_user: CurrentUser,
    db: DB,
):
    """
    Upsert a reading session for the current user + file.
    Coalesces with the most recent session if it ended within the last 5 minutes,
    otherwise opens a new session row.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=5)

    file_result = await db.execute(
        select(File.group_id).where(File.id == body.file_id)
    )
    group_id = file_result.scalar_one_or_none()
    if not group_id:
        raise HTTPException(status_code=404, detail="File not found")

    member_result = await db.execute(
        select(GroupMember.id).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="File not found")

    result = await db.execute(
        select(ReadingEvent)
        .where(
            ReadingEvent.file_id == body.file_id,
            ReadingEvent.user_id == current_user.id,
            ReadingEvent.session_start >= cutoff,
        )
        .order_by(ReadingEvent.session_start.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.scroll_depth_pct = max(existing.scroll_depth_pct, int(body.scroll_depth_pct * 100))
        existing.active_time_s = max(existing.active_time_s, body.active_time_seconds)
        existing.session_end = now
    else:
        ev = ReadingEvent(
            file_id=body.file_id,
            user_id=current_user.id,
            session_start=now,
            session_end=now,
            scroll_depth_pct=int(body.scroll_depth_pct * 100),
            active_time_s=body.active_time_seconds,
        )
        db.add(ev)
    await db.commit()

    await track_event(
        user_id=current_user.id,
        event_type="file.read",
        resource_type="file",
        resource_id=body.file_id,
        metadata={"scroll_depth_pct": body.scroll_depth_pct, "active_time_s": body.active_time_seconds},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
