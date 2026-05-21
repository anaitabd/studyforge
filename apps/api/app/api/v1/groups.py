import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.group import Group, GroupMember
from app.models.file import File
from app.models.user import User
from app.models.gamification import UserLevel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/groups", tags=["groups"])

# Reusable annotated dependency aliases
CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


class CreateGroupRequest(BaseModel):
    name: str
    description: str | None = None
    color: str = "#1A3A5C"


class UpdateGroupRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None


@router.get("")
async def list_groups(
    current_user: CurrentUser,
    db: DB,
):
    result = await db.execute(
        select(GroupMember).where(GroupMember.user_id == current_user.id)
    )
    memberships = result.scalars().all()
    group_ids = [m.group_id for m in memberships]

    if not group_ids:
        return {"groups": []}

    result = await db.execute(
        select(Group)
        .where(Group.id.in_(group_ids), Group.is_archived == False)
        .order_by(Group.created_at.desc())
    )
    groups = result.scalars().all()

    group_list = []
    for g in groups:
        file_result = await db.execute(
            select(File).where(File.group_id == g.id)
        )
        files = file_result.scalars().all()
        member_result = await db.execute(
            select(GroupMember).where(GroupMember.group_id == g.id)
        )
        members = member_result.scalars().all()
        membership = next((m for m in memberships if m.group_id == g.id), None)

        group_list.append({
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "color": g.color,
            "is_archived": g.is_archived,
            "owner_id": g.owner_user_id,
            "owner_user_id": g.owner_user_id,
            "plan": current_user.plan,
            "file_count": len(files),
            "member_count": len(members),
            "my_role": membership.role if membership else "student",
            "created_at": g.created_at.isoformat(),
            "updated_at": g.updated_at.isoformat(),
        })

    return {"groups": group_list}


@router.post(
    "",
    responses={429: {"description": "Free plan group limit exceeded"}},
)
async def create_group(
    body: CreateGroupRequest,
    current_user: CurrentUser,
    db: DB,
):
    if current_user.plan == "free":
        result = await db.execute(
            select(GroupMember).where(
                GroupMember.user_id == current_user.id,
                GroupMember.role == "owner",
            )
        )
        owned = result.scalars().all()
        if len(owned) >= 1:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "limit_exceeded",
                    "limit_key": "groups",
                    "current_plan": "free",
                    "message": "Free plan allows 1 group. Upgrade to create more.",
                },
            )

    group_id = str(uuid.uuid4())
    group = Group(
        id=group_id,
        name=body.name,
        description=body.description,
        color=body.color,
        owner_user_id=current_user.id,
    )
    db.add(group)

    member = GroupMember(
        group_id=group_id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)
    await db.commit()
    await db.refresh(group)

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "color": group.color,
        "owner_id": group.owner_user_id,
        "owner_user_id": group.owner_user_id,
        "plan": current_user.plan,
        "file_count": 0,
        "member_count": 1,
        "my_role": "owner",
        "created_at": group.created_at.isoformat(),
        "updated_at": group.updated_at.isoformat(),
    }


@router.get(
    "/{group_id}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Group not found"},
    },
)
async def get_group(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    member_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    membership = member_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    file_result = await db.execute(
        select(File).where(File.group_id == group_id).order_by(File.created_at.desc())
    )
    files = file_result.scalars().all()

    member_result2 = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id)
    )
    all_members = member_result2.scalars().all()

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "color": group.color,
        "is_archived": group.is_archived,
        "owner_user_id": group.owner_user_id,
        "my_role": membership.role,
        "files": [
            {
                "id": f.id,
                "name": f.name,
                "mime_type": f.mime_type,
                "size_bytes": f.size_bytes,
                "status": f.status,
                "error_message": f.error_message,
                "chunk_count": f.chunk_count,
                "created_at": f.created_at.isoformat(),
            }
            for f in files
        ],
        "member_count": len(all_members),
        "created_at": group.created_at.isoformat(),
    }


@router.get("/{group_id}/members")
async def list_group_members(group_id: str, current_user: CurrentUser, db: DB):
    membership_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this group")

    result = await db.execute(
        select(GroupMember, User)
        .join(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.joined_at)
    )
    rows = result.all()
    return {
        "members": [
            {
                "user_id": member.user_id,
                "role": member.role,
                "joined_at": member.joined_at.isoformat(),
                "full_name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
            }
            for member, user in rows
        ]
    }


@router.delete(
    "/{group_id}",
    responses={403: {"description": "Only the owner can delete a group"}},
)
async def delete_group(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    member_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "owner",
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only the owner can delete a group")

    from app.services.vector_store import vector_store
    vector_store.delete_group(group_id)

    await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))
    await db.execute(delete(Group).where(Group.id == group_id))
    await db.commit()

    return {"message": "Group deleted"}


@router.post(
    "/{group_id}/invite-link",
    responses={403: {"description": "Only teachers/owners can generate invite links"}},
)
async def get_invite_link(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    member_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role.in_(["owner", "teacher"]),
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only teachers/owners can generate invite links")

    from app.core.config import settings
    import time
    from jose import jwt
    payload = {"group_id": group_id, "exp": int(time.time()) + 72 * 3600}
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    return {
        "invite_url": f"{settings.FRONTEND_URL}/join/{token}",
        "expires_in_hours": 72,
    }


@router.post(
    "/join",
    responses={
        400: {"description": "invite_token required or invalid/expired invite link"},
    },
)
async def join_group(
    body: dict,
    current_user: CurrentUser,
    db: DB,
):
    from jose import jwt, JWTError
    from app.core.config import settings

    token = body.get("invite_token")
    if not token:
        raise HTTPException(status_code=400, detail="invite_token required")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        group_id = payload["group_id"]
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")

    existing = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "Already a member", "group_id": group_id}

    member = GroupMember(
        group_id=group_id,
        user_id=current_user.id,
        role="student",
    )
    db.add(member)
    await db.commit()

    return {"message": "Joined group successfully", "group_id": group_id}


@router.get(
    "/{group_id}/leaderboard",
    responses={403: {"description": "Not a member of this group"}},
)
async def get_leaderboard(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    """Top 10 members by XP + current user's rank even if outside top 10."""
    member_result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id)
    )
    all_members = member_result.scalars().all()
    member_ids = [m.user_id for m in all_members]

    if current_user.id not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Fetch user info and XP for all members
    users_result = await db.execute(
        select(User).where(User.id.in_(member_ids))
    )
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    levels_result = await db.execute(
        select(UserLevel).where(UserLevel.user_id.in_(member_ids))
    )
    levels_by_id = {ul.user_id: ul for ul in levels_result.scalars().all()}

    # Build and sort
    ranked = sorted(
        member_ids,
        key=lambda uid: levels_by_id[uid].total_xp if uid in levels_by_id else 0,
        reverse=True,
    )

    def _entry(rank: int, uid: str) -> dict:
        u = users_by_id.get(uid)
        ul = levels_by_id.get(uid)
        return {
            "rank": rank,
            "user_id": uid,
            "name": u.name if u else "Unknown",
            "avatar_url": u.avatar_url if u else None,
            "total_xp": ul.total_xp if ul else 0,
            "level": ul.level if ul else 1,
            "level_title": ul.level_title if ul else "Débutant",
        }

    top10 = [_entry(i + 1, uid) for i, uid in enumerate(ranked[:10])]

    my_rank = next((i + 1 for i, uid in enumerate(ranked) if uid == current_user.id), len(ranked))
    my_ul = levels_by_id.get(current_user.id)
    my_xp = my_ul.total_xp if my_ul else 0

    return {"members": top10, "my_rank": my_rank, "my_xp": my_xp}
