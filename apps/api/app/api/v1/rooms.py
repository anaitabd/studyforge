import logging
import random
import string
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.group import GroupMember
from app.models.room import RoomMember, StudyRoom

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rooms", tags=["rooms"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


def _make_code(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class CreateRoomRequest(BaseModel):
    group_id: str
    name: str


async def _require_group_member(group_id: str, user_id: str, db: AsyncSession) -> GroupMember:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return m


@router.post("", responses={403: {"description": "Not a member of this group"}})
async def create_room(body: CreateRoomRequest, current_user: CurrentUser, db: DB):
    await _require_group_member(body.group_id, current_user.id, db)

    room = StudyRoom(
        group_id=body.group_id,
        name=body.name.strip(),
        invite_code=_make_code(),
        created_by=current_user.id,
    )
    db.add(room)
    await db.flush()

    # Creator joins automatically
    db.add(RoomMember(room_id=room.id, user_id=current_user.id, is_online=True))
    await db.commit()

    return {
        "id": room.id,
        "group_id": room.group_id,
        "name": room.name,
        "invite_code": room.invite_code,
        "is_active": room.is_active,
        "created_at": room.created_at.isoformat(),
        "member_count": 1,
    }


@router.get("/group/{group_id}")
async def list_rooms(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
    limit: int = 50,
    offset: int = 0,
):
    await _require_group_member(group_id, current_user.id, db)

    online_expr = func.coalesce(
        func.sum(case((RoomMember.is_online.is_(True), 1), else_=0)), 0
    )
    total_expr = func.count(RoomMember.id)

    result = await db.execute(
        select(
            StudyRoom,
            total_expr.label("member_count"),
            online_expr.label("online_count"),
        )
        .outerjoin(RoomMember, RoomMember.room_id == StudyRoom.id)
        .where(StudyRoom.group_id == group_id, StudyRoom.is_active.is_(True))
        .group_by(StudyRoom.id)
        .order_by(StudyRoom.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()

    output = [
        {
            "id": r.id,
            "group_id": r.group_id,
            "name": r.name,
            "invite_code": r.invite_code,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
            "member_count": int(member_count or 0),
            "online_count": int(online_count or 0),
        }
        for r, member_count, online_count in rows
    ]

    total_result = await db.execute(
        select(func.count(StudyRoom.id)).where(
            StudyRoom.group_id == group_id, StudyRoom.is_active.is_(True)
        )
    )
    total = int(total_result.scalar_one() or 0)

    return {"rooms": output, "total": total, "has_more": offset + len(output) < total}


@router.post(
    "/join/{invite_code}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Room not found or inactive"},
    },
)
async def join_room(invite_code: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(StudyRoom).where(
            StudyRoom.invite_code == invite_code.upper(),
            StudyRoom.is_active == True,  # noqa: E712
        )
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found or inactive")

    # Must be a group member to join
    await _require_group_member(room.group_id, current_user.id, db)

    # Upsert membership
    existing = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room.id,
            RoomMember.user_id == current_user.id,
        )
    )
    member = existing.scalar_one_or_none()
    if member:
        member.is_online = True
    else:
        db.add(RoomMember(room_id=room.id, user_id=current_user.id, is_online=True))
    await db.commit()

    return {
        "id": room.id,
        "group_id": room.group_id,
        "name": room.name,
        "invite_code": room.invite_code,
    }


@router.delete(
    "/{room_id}",
    responses={
        403: {"description": "Only the room creator can close it"},
        404: {"description": "Room not found"},
    },
)
async def close_room(room_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(select(StudyRoom).where(StudyRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the room creator can close it")

    room.is_active = False
    await db.commit()
    return {"message": "Room closed"}
