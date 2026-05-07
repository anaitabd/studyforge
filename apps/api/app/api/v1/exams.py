import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limiter import rate_limiter
from app.core.security import get_current_user
from app.models.exam import Exam, ExamSession, Question
from app.models.group import GroupMember
from app.services import exam_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["exams"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── helpers ──────────────────────────────────────────────────────────────────

async def _require_group_member(
    group_id: str, user_id: str, db: AsyncSession
) -> GroupMember:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return membership


async def _require_exam_in_group(
    exam_id: str, group_id: str, db: AsyncSession
) -> Exam:
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id, Exam.group_id == group_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found in this group")
    return exam


# ── request / response models ─────────────────────────────────────────────────

class GenerateExamRequest(BaseModel):
    title: str
    question_count: int = Field(default=10, ge=5, le=50)
    difficulty: str = Field(default="mixed", pattern="^(easy|medium|hard|mixed)$")
    question_type: str = Field(
        default="mcq_single",
        pattern="^(mcq_single|mcq_multiple|true_false|fill_blank)$",
    )
    language: str = Field(default="auto", pattern="^(auto|fr|en|ar|es)$")
    file_ids: list[str] | None = None
    topic_focus: str | None = None


class AssignExamRequest(BaseModel):
    starts_at: str | None = None   # ISO 8601
    ends_at: str | None = None     # ISO 8601
    attempt_limit: int = Field(default=1, ge=1, le=10)
    shuffle_questions: bool = False
    shuffle_answers: bool = False


class StartSessionRequest(BaseModel):
    shuffle: bool = False
    room_id: str | None = None


class SaveAnswersRequest(BaseModel):
    answers: dict[str, str]   # {question_id: selected_option}


class SubmitRequest(BaseModel):
    answers: dict[str, str]


# ── routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/groups/{group_id}/exams/generate",
    responses={
        403: {"description": "Not a member of this group"},
        429: {"description": "Monthly QCM limit reached"},
        422: {"description": "No ready files in group"},
    },
)
async def generate_exam(
    group_id: str,
    body: GenerateExamRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)

    allowed, current_count, limit = await rate_limiter.check_and_increment(
        user_id=current_user.id,
        plan=current_user.plan,
        limit_key="qcm_per_month",
        window="month",
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "limit_exceeded",
                "limit_key": "qcm_per_month",
                "current": current_count,
                "limit": limit,
                "current_plan": current_user.plan,
                "message": f"Monthly QCM limit ({limit}) reached. Upgrade for unlimited exams.",
            },
        )

    try:
        result = await exam_service.generate_exam(
            db=db,
            group_id=group_id,
            creator_id=current_user.id,
            title=body.title,
            question_count=body.question_count,
            difficulty=body.difficulty,
            question_type=body.question_type,
            language=body.language,
            file_ids=body.file_ids,
            topic_focus=body.topic_focus,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@router.get(
    "/groups/{group_id}/exams",
    responses={403: {"description": "Not a member of this group"}},
)
async def list_exams(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
    limit: int = 50,
    offset: int = 0,
):
    await _require_group_member(group_id, current_user.id, db)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    result = await db.execute(
        select(Exam)
        .where(Exam.group_id == group_id)
        .order_by(Exam.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    exams = result.scalars().all()
    exam_ids = [e.id for e in exams]

    if exam_ids:
        # Question counts in one query.
        q_rows = (await db.execute(
            select(Question.exam_id, func.count(Question.id))
            .where(Question.exam_id.in_(exam_ids))
            .group_by(Question.exam_id)
        )).all()
        question_count_by_exam = {eid: int(c) for eid, c in q_rows}

        # Per-user submitted sessions in one query.
        s_rows = (await db.execute(
            select(
                ExamSession.exam_id,
                func.count(ExamSession.id),
                func.max(ExamSession.score),
            )
            .where(
                ExamSession.exam_id.in_(exam_ids),
                ExamSession.user_id == current_user.id,
                ExamSession.submitted_at.is_not(None),
            )
            .group_by(ExamSession.exam_id)
        )).all()
        session_stats_by_exam = {
            eid: {"attempts": int(attempts), "best_score": best}
            for eid, attempts, best in s_rows
        }
    else:
        question_count_by_exam = {}
        session_stats_by_exam = {}

    exam_list = [
        {
            "id": exam.id,
            "title": exam.title,
            "status": exam.status,
            "config": exam.config,
            "question_count": question_count_by_exam.get(exam.id, 0),
            "attempt_limit": exam.attempt_limit,
            "starts_at": exam.starts_at.isoformat() if exam.starts_at else None,
            "ends_at": exam.ends_at.isoformat() if exam.ends_at else None,
            "created_at": exam.created_at.isoformat(),
            "my_attempts": session_stats_by_exam.get(exam.id, {}).get("attempts", 0),
            "my_best_score": session_stats_by_exam.get(exam.id, {}).get("best_score"),
        }
        for exam in exams
    ]

    total_result = await db.execute(
        select(func.count(Exam.id)).where(Exam.group_id == group_id)
    )
    total = int(total_result.scalar_one() or 0)

    return {"exams": exam_list, "total": total, "has_more": offset + len(exam_list) < total}


@router.get(
    "/groups/{group_id}/exams/{exam_id}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Exam not found"},
    },
)
async def get_exam(
    group_id: str,
    exam_id: str,
    current_user: CurrentUser,
    db: DB,
):
    membership = await _require_group_member(group_id, current_user.id, db)
    exam = await _require_exam_in_group(exam_id, group_id, db)

    q_result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.order_index)
    )
    questions = q_result.scalars().all()

    is_teacher = membership.role in ("owner", "teacher")

    return {
        "id": exam.id,
        "group_id": exam.group_id,
        "title": exam.title,
        "status": exam.status,
        "config": exam.config,
        "attempt_limit": exam.attempt_limit,
        "starts_at": exam.starts_at.isoformat() if exam.starts_at else None,
        "ends_at": exam.ends_at.isoformat() if exam.ends_at else None,
        "created_at": exam.created_at.isoformat(),
        "questions": [
            {
                "id": q.id,
                "type": q.type,
                "content": q.content,
                "options": q.options,
                "difficulty": q.difficulty,
                "order_index": q.order_index,
                # Only teachers see correct answers before the exam is taken
                **(
                    {
                        "correct_answer": q.correct_answer,
                        "explanation": q.explanation,
                        "source_passage": q.source_passage,
                    }
                    if is_teacher
                    else {}
                ),
            }
            for q in questions
        ],
    }


@router.patch(
    "/groups/{group_id}/exams/{exam_id}/assign",
    responses={
        403: {"description": "Only teachers/owners can assign exams"},
        404: {"description": "Exam not found"},
    },
)
async def assign_exam(
    group_id: str,
    exam_id: str,
    body: AssignExamRequest,
    current_user: CurrentUser,
    db: DB,
):
    membership = await _require_group_member(group_id, current_user.id, db)
    if membership.role not in ("owner", "teacher"):
        raise HTTPException(status_code=403, detail="Only teachers/owners can assign exams")

    exam = await _require_exam_in_group(exam_id, group_id, db)

    from datetime import datetime, timezone

    if body.starts_at:
        exam.starts_at = datetime.fromisoformat(body.starts_at)
    if body.ends_at:
        exam.ends_at = datetime.fromisoformat(body.ends_at)

    exam.attempt_limit = body.attempt_limit
    exam.status = "assigned"
    exam.config = {
        **exam.config,
        "shuffle_questions": body.shuffle_questions,
        "shuffle_answers": body.shuffle_answers,
    }
    await db.commit()

    # Notify group students about the new exam (fire-and-forget)
    try:
        from app.services.notification_service import notify_exam_assigned
        ends_at_display = exam.ends_at.strftime("%b %d at %H:%M") if exam.ends_at else None
        await notify_exam_assigned(
            db=db,
            group_id=group_id,
            exam_id=exam.id,
            exam_title=exam.title,
            teacher_name=getattr(current_user, "name", "Your teacher"),
            ends_at_str=ends_at_display,
        )
    except Exception as e:
        logger.warning(f"Exam-assigned notification failed for exam {exam.id}: {e}")

    return {
        "id": exam.id,
        "status": exam.status,
        "starts_at": exam.starts_at.isoformat() if exam.starts_at else None,
        "ends_at": exam.ends_at.isoformat() if exam.ends_at else None,
        "attempt_limit": exam.attempt_limit,
    }


@router.post(
    "/groups/{group_id}/exams/{exam_id}/sessions",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Exam not found"},
        422: {"description": "Attempt limit reached or exam window closed"},
    },
)
async def start_session(
    group_id: str,
    exam_id: str,
    body: StartSessionRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)
    await _require_exam_in_group(exam_id, group_id, db)

    try:
        result = await exam_service.start_session(
            db=db,
            exam_id=exam_id,
            user_id=current_user.id,
            room_id=body.room_id,
            shuffle=body.shuffle,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@router.put(
    "/groups/{group_id}/exams/{exam_id}/sessions/{session_id}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Session not found"},
        422: {"description": "Session already submitted"},
    },
)
async def autosave_answers(
    group_id: str,
    exam_id: str,
    session_id: str,
    body: SaveAnswersRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)

    try:
        result = await exam_service.autosave_answers(
            db=db,
            session_id=session_id,
            user_id=current_user.id,
            answers=body.answers,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@router.post(
    "/groups/{group_id}/exams/{exam_id}/sessions/{session_id}/submit",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Session not found"},
        422: {"description": "Session already submitted"},
    },
)
async def submit_exam(
    group_id: str,
    exam_id: str,
    session_id: str,
    body: SubmitRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)

    try:
        result = await exam_service.submit_and_grade(
            db=db,
            session_id=session_id,
            user_id=current_user.id,
            answers=body.answers,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@router.get(
    "/groups/{group_id}/exams/{exam_id}/sessions/{session_id}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Session not found"},
    },
)
async def get_session(
    group_id: str,
    exam_id: str,
    session_id: str,
    current_user: CurrentUser,
    db: DB,
):
    """Retrieve an existing session — used to restore auto-saved answers if connection drops."""
    await _require_group_member(group_id, current_user.id, db)

    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.exam_id == exam_id,
            ExamSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Calculate percentage
    percentage = 0
    if session.total and session.total > 0:
        percentage = round((session.score / session.total) * 100)

    # Build corrections from questions and answers (only if submitted)
    corrections = []
    if session.submitted_at:
        q_result = await db.execute(
            select(Question)
            .where(Question.exam_id == exam_id)
            .order_by(Question.order_index)
        )
        questions = q_result.scalars().all()
        
        for q in questions:
            student_answer = session.answers.get(q.id)
            is_correct = (
                student_answer is not None
                and student_answer.upper() == q.correct_answer.upper()
            )
            corrections.append({
                "question_id": q.id,
                "question": q.content,
                "options": q.options,
                "student_answer": student_answer,
                "correct_answer": q.correct_answer,
                "is_correct": is_correct,
                "explanation": q.explanation,
                "source_passage": q.source_passage,
                "difficulty": q.difficulty,
            })

    return {
        "session_id": session.id,
        "exam_id": session.exam_id,
        "answers": session.answers,
        "score": session.score or 0,
        "total": session.total or 0,
        "percentage": percentage,
        "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
        "started_at": session.started_at.isoformat(),
        "time_spent_s": session.time_spent_s or 0,
        "corrections": corrections,
    }
