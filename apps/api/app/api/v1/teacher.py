import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.chat import ChatMessage
from app.models.exam import Exam, ExamSession
from app.models.file import File
from app.models.group import Group, GroupMember
from app.models.notification import ReadingEvent
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teacher", tags=["teacher"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/groups/{group_id}/analytics")
async def get_group_analytics(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    # Must be owner or teacher
    membership_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if not membership or membership.role not in ("owner", "teacher"):
        raise HTTPException(status_code=403, detail="Teacher or owner access required")

    # Group info
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # All members
    members_result = await db.execute(
        select(GroupMember, User)
        .join(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id)
    )
    members = members_result.all()

    # Files
    files_result = await db.execute(
        select(func.count(File.id)).where(
            File.group_id == group_id, File.status == "ready"
        )
    )
    file_count = files_result.scalar() or 0

    # Chat messages
    chat_result = await db.execute(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.group_id == group_id,
            ChatMessage.role == "user",
        )
    )
    total_chats = chat_result.scalar() or 0

    # Exams in group
    exams_result = await db.execute(
        select(Exam).where(Exam.group_id == group_id).order_by(Exam.created_at.desc())
    )
    exams = exams_result.scalars().all()

    # All sessions for exams in this group
    exam_ids = [e.id for e in exams]
    sessions_result = await db.execute(
        select(ExamSession).where(
            ExamSession.exam_id.in_(exam_ids),
            ExamSession.submitted_at.is_not(None),
        )
    )
    all_sessions = sessions_result.scalars().all()

    # Reading events for this group's files
    file_ids_result = await db.execute(
        select(File.id, File.name).where(File.group_id == group_id)
    )
    file_rows = file_ids_result.all()
    file_id_to_name = {fid: fname for fid, fname in file_rows}
    file_ids = list(file_id_to_name.keys())

    reading_events: list[ReadingEvent] = []
    if file_ids:
        re_result = await db.execute(
            select(ReadingEvent).where(ReadingEvent.file_id.in_(file_ids))
        )
        reading_events = list(re_result.scalars().all())

    # Per-student analytics
    student_stats: dict[str, dict] = {}
    for member, user in members:
        if member.role not in ("student",):
            continue
        user_sessions = [s for s in all_sessions if s.user_id == user.id]
        avg_score = None
        if user_sessions:
            totals = [s.total for s in user_sessions if s.total]
            scores = [s.score for s in user_sessions if s.score is not None and s.total]
            avg_score = round(
                sum(s / t * 100 for s, t in zip(scores, totals)) / len(scores), 1
            ) if scores else None

        # Chat messages by this user in this group
        user_chat_result = await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.group_id == group_id,
                ChatMessage.user_id == user.id,
                ChatMessage.role == "user",
            )
        )
        user_chat_count = user_chat_result.scalar() or 0

        user_reading = [r for r in reading_events if r.user_id == user.id]
        files_read = len({r.file_id for r in user_reading})
        active_minutes = round(sum(r.active_time_s for r in user_reading) / 60.0, 1)
        last_active = max((r.session_end for r in user_reading), default=None)

        student_stats[user.id] = {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "exams_taken": len(user_sessions),
            "avg_score": avg_score,
            "chat_count": user_chat_count,
            "files_read": files_read,
            "active_minutes": active_minutes,
            "last_active": last_active.isoformat() if last_active else None,
            "joined_at": member.joined_at.isoformat(),
        }

    # Per-exam summary
    exam_summaries = []
    for exam in exams:
        exam_sessions = [s for s in all_sessions if s.exam_id == exam.id]
        avg = None
        if exam_sessions:
            scores = [
                (s.score / s.total * 100)
                for s in exam_sessions
                if s.score is not None and s.total
            ]
            avg = round(sum(scores) / len(scores), 1) if scores else None
        exam_summaries.append({
            "id": exam.id,
            "title": exam.title,
            "status": exam.status,
            "submissions": len(exam_sessions),
            "avg_score": avg,
            "created_at": exam.created_at.isoformat(),
        })

    file_summaries = []
    for fid, fname in file_rows:
        events = [r for r in reading_events if r.file_id == fid]
        unique_readers = len({r.user_id for r in events})
        avg_scroll = (
            round(sum(r.scroll_depth_pct for r in events) / len(events), 1)
            if events else 0.0
        )
        avg_active_minutes = (
            round(sum(r.active_time_s for r in events) / len(events) / 60.0, 1)
            if events else 0.0
        )
        file_summaries.append({
            "file_id": fid,
            "name": fname,
            "unique_readers": unique_readers,
            "avg_scroll_depth": avg_scroll,
            "avg_active_minutes": avg_active_minutes,
            "total_sessions": len(events),
        })

    avg_active_minutes_class = (
        round(sum(r.active_time_s for r in reading_events) / max(len(reading_events), 1) / 60.0, 1)
        if reading_events else 0.0
    )

    return {
        "group_id": group_id,
        "group_name": group.name,
        "member_count": len(members),
        "student_count": len(student_stats),
        "file_count": file_count,
        "total_chats": total_chats,
        "exam_count": len(exams),
        "avg_active_minutes": avg_active_minutes_class,
        "students": list(student_stats.values()),
        "exams": exam_summaries,
        "files": file_summaries,
    }


