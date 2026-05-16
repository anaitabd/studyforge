import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.exam import Exam
from app.models.file import File
from app.models.flashcard import FlashcardSet
from app.models.group import Group, GroupMember

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["search"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("")
async def global_search(
    current_user: CurrentUser,
    db: DB,
    q: str = Query(..., min_length=2, max_length=100),
):
    q_lower = f"%{q.lower()}%"
    user_id = current_user.id

    user_group_ids_q = select(GroupMember.group_id).where(GroupMember.user_id == user_id)
    user_group_ids = (await db.execute(user_group_ids_q)).scalars().all()

    groups = (await db.execute(
        select(Group).where(
            Group.id.in_(user_group_ids),
            or_(Group.name.ilike(q_lower), Group.description.ilike(q_lower)),
        ).limit(5)
    )).scalars().all()

    files = (await db.execute(
        select(File).where(
            File.group_id.in_(user_group_ids),
            File.filename.ilike(q_lower),
        ).limit(5)
    )).scalars().all()

    exams = (await db.execute(
        select(Exam).where(
            Exam.group_id.in_(user_group_ids),
            Exam.title.ilike(q_lower),
        ).limit(5)
    )).scalars().all()

    flashcard_sets = (await db.execute(
        select(FlashcardSet).where(
            FlashcardSet.group_id.in_(user_group_ids),
            FlashcardSet.title.ilike(q_lower),
        ).limit(5)
    )).scalars().all()

    return {
        "query": q,
        "results": {
            "groups": [
                {"id": str(g.id), "name": g.name, "type": "group"} for g in groups
            ],
            "files": [
                {"id": str(f.id), "name": f.filename, "group_id": str(f.group_id), "type": "file"}
                for f in files
            ],
            "exams": [
                {"id": str(e.id), "title": e.title, "group_id": str(e.group_id), "type": "exam"}
                for e in exams
            ],
            "flashcard_sets": [
                {"id": str(s.id), "title": s.title, "group_id": str(s.group_id), "type": "flashcard_set"}
                for s in flashcard_sets
            ],
        },
        "total": len(groups) + len(files) + len(exams) + len(flashcard_sets),
    }
