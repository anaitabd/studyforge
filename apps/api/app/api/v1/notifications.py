import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.pagination import Pagination, encode_cursor
from app.core.security import get_current_user
from app.models.notification import Notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("")
async def list_notifications(
    current_user: CurrentUser,
    db: DB,
    pagination: Pagination,
    unread_only: bool = False,
):
    """Return the current user's notifications (newest first)."""
    cursor_dt, cursor_id = pagination.decode()

    base_filter = [Notification.user_id == current_user.id]
    if unread_only:
        base_filter.append(Notification.is_read == False)  # noqa: E712

    page_filter = list(base_filter)
    if cursor_dt is not None:
        page_filter.append(
            or_(
                Notification.created_at < cursor_dt,
                and_(Notification.created_at == cursor_dt, Notification.id < cursor_id),
            )
        )

    items = (await db.execute(
        select(Notification)
        .where(*page_filter)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(pagination.limit)
    )).scalars().all()

    total = int((await db.execute(
        select(func.count(Notification.id)).where(*base_filter)
    )).scalar_one() or 0)

    unread_count = int((await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )).scalar_one() or 0)

    next_cursor = encode_cursor(items[-1].created_at, items[-1].id) if len(items) == pagination.limit else None

    return {
        "items": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ],
        "next_cursor": next_cursor,
        "total": total,
        "unread_count": unread_count,
    }


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(current_user: CurrentUser, db: DB):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
