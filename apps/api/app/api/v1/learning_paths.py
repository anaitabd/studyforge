import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.group import GroupMember
from app.services import learning_path_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["learning-paths"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


async def _require_group_member(group_id: str, user_id: str, db: AsyncSession) -> GroupMember:
    membership = (
        await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return membership


class GeneratePathRequest(BaseModel):
    title: str = Field(default="Course learning path", max_length=255)
    file_ids: list[str] | None = None
    module_count: int = Field(default=6, ge=3, le=12)
    language: str = "auto"


class ModuleCompleteRequest(BaseModel):
    completed: bool = True


@router.post("/groups/{group_id}/learning-paths/generate")
async def generate_path(
    group_id: str, body: GeneratePathRequest, current_user: CurrentUser, db: DB
):
    await _require_group_member(group_id, current_user.id, db)
    try:
        return await learning_path_service.generate_path(
            db=db,
            group_id=group_id,
            user_id=current_user.id,
            title=body.title,
            file_ids=body.file_ids,
            module_count=body.module_count,
            language=body.language,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/groups/{group_id}/learning-paths")
async def list_paths(group_id: str, current_user: CurrentUser, db: DB):
    await _require_group_member(group_id, current_user.id, db)
    paths = await learning_path_service.list_paths(db, group_id, current_user.id)
    return {"paths": paths}


@router.get("/groups/{group_id}/learning-paths/{path_id}")
async def get_path(group_id: str, path_id: str, current_user: CurrentUser, db: DB):
    await _require_group_member(group_id, current_user.id, db)
    try:
        return await learning_path_service.get_path(db, group_id, path_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/groups/{group_id}/learning-paths/{path_id}/modules/{module_id}")
async def get_module(
    group_id: str, path_id: str, module_id: str, current_user: CurrentUser, db: DB
):
    await _require_group_member(group_id, current_user.id, db)
    try:
        return await learning_path_service.get_module(db, path_id, module_id, current_user.id)
    except ValueError as e:
        msg = str(e)
        if "locked" in msg.lower():
            raise HTTPException(status_code=403, detail=msg)
        raise HTTPException(status_code=404, detail=msg)


@router.post("/groups/{group_id}/learning-paths/{path_id}/modules/{module_id}/progress")
async def mark_module_complete(
    group_id: str,
    path_id: str,
    module_id: str,
    body: ModuleCompleteRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)
    try:
        return await learning_path_service.mark_complete(
            db, path_id, module_id, current_user.id, body.completed
        )
    except ValueError as e:
        msg = str(e)
        if "previous modules" in msg.lower():
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=404, detail=msg)


@router.delete("/groups/{group_id}/learning-paths/{path_id}", status_code=204)
async def delete_path(group_id: str, path_id: str, current_user: CurrentUser, db: DB):
    await _require_group_member(group_id, current_user.id, db)
    try:
        await learning_path_service.delete_path(db, group_id, path_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return None
