"""Baccalauréat preparation routes."""

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.bac import (
    BacPaper, BacQuestion, BacPracticeSession,
    BAC_BRANCHES, BAC_SESSIONS, BAC_REGIONS,
)
from app.services import bac_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bac", tags=["bac"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


def _is_admin(user) -> bool:
    return getattr(user, "role", "") in ("super_admin", "school_admin")


def _serialize_paper_summary(paper, qcount: int, attempt_count: int, avg_score: float | None) -> dict:
    return {
        "id": paper.id,
        "year": paper.year,
        "branch": paper.branch,
        "subject": paper.subject,
        "region": paper.region,
        "session": paper.session,
        "title": paper.title,
        "duration_minutes": paper.duration_minutes,
        "total_points": paper.total_points,
        "question_count": qcount,
        "my_attempt_count": attempt_count,
        "my_avg_score": round(float(avg_score), 2) if avg_score is not None else None,
    }


def _serialize_session(session, paper, questions, *, include_answers: bool) -> dict:
    return {
        "session_id": session.id,
        "paper": {
            "id": paper.id,
            "year": paper.year,
            "branch": paper.branch,
            "subject": paper.subject,
            "title": paper.title,
            "duration_minutes": paper.duration_minutes,
            "total_points": paper.total_points,
            "region": paper.region,
            "session_type": paper.session,
        },
        "questions": [
            {
                "id": q.id,
                "order_index": q.order_index,
                "part_label": q.part_label,
                "type": q.type,
                "content": q.content,
                "options": q.options,
                "points": q.points,
                "subject_area": q.subject_area,
                **(
                    {
                        "correct_answer": q.correct_answer,
                        "explanation_fr": q.explanation_fr,
                        "explanation_ar": q.explanation_ar,
                        "rubric": q.rubric,
                    }
                    if include_answers else {}
                ),
            }
            for q in questions
        ],
        "started_at": session.started_at.isoformat(),
        "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
        "answers": session.answers,
        "score_over_20": session.score_over_20,
        "per_question_scores": session.per_question_scores if include_answers else None,
        "grading_status": session.grading_status,
        "duration_minutes": session.duration_minutes,
    }


# ── Papers ────────────────────────────────────────────────────────────────────

@router.get("/papers")
async def list_papers(
    current_user: CurrentUser,
    db: DB,
    year: int | None = None,
    branch: str | None = None,
    subject: str | None = None,
    session: str | None = None,
    region: str | None = None,
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0, ge=0),
):
    q = select(BacPaper).where(BacPaper.extraction_status == "ready")
    if year:
        q = q.where(BacPaper.year == year)
    if branch:
        q = q.where(BacPaper.branch == branch)
    if subject:
        q = q.where(BacPaper.subject == subject)
    if session:
        q = q.where(BacPaper.session == session)
    if region:
        q = q.where(BacPaper.region == region)
    q = q.order_by(BacPaper.year.desc(), BacPaper.branch, BacPaper.subject)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    papers = (await db.execute(q.offset(offset).limit(limit))).scalars().all()

    result = []
    for p in papers:
        qcount = (await db.execute(
            select(func.count()).select_from(BacQuestion).where(BacQuestion.paper_id == p.id)
        )).scalar_one()

        attempt_count = (await db.execute(
            select(func.count()).select_from(BacPracticeSession).where(
                BacPracticeSession.user_id == current_user.id,
                BacPracticeSession.paper_id == p.id,
                BacPracticeSession.submitted_at.is_not(None),
            )
        )).scalar_one()

        avg_score = (await db.execute(
            select(func.avg(BacPracticeSession.score_over_20)).where(
                BacPracticeSession.user_id == current_user.id,
                BacPracticeSession.paper_id == p.id,
                BacPracticeSession.grading_status == "graded",
            )
        )).scalar_one()

        result.append(_serialize_paper_summary(p, qcount, attempt_count, avg_score))

    return {"papers": result, "total": total, "offset": offset, "limit": limit}


class CreatePaperRequest(BaseModel):
    year: int = Field(..., ge=2000, le=2030)
    branch: str
    subject: str
    region: str = "nationale"
    session: str = "normale"
    title: str = ""
    duration_minutes: int = Field(default=120, ge=30, le=360)
    file_id: str | None = None


@router.post("/papers", status_code=201)
async def create_paper(body: CreatePaperRequest, current_user: CurrentUser, db: DB):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    if body.branch not in BAC_BRANCHES:
        raise HTTPException(status_code=422, detail=f"branch must be one of: {', '.join(BAC_BRANCHES)}")
    if body.session not in BAC_SESSIONS:
        raise HTTPException(status_code=422, detail=f"session must be one of: {', '.join(BAC_SESSIONS)}")
    if body.region not in BAC_REGIONS:
        raise HTTPException(status_code=422, detail=f"region must be one of: {', '.join(BAC_REGIONS)}")

    title = body.title or f"Bac {body.year} — {body.branch} — {body.subject} ({body.session})"

    paper = BacPaper(
        year=body.year,
        branch=body.branch,
        subject=body.subject,
        region=body.region,
        session=body.session,
        title=title,
        duration_minutes=body.duration_minutes,
        file_id=body.file_id,
        extraction_status="pending",
        created_by=current_user.id,
    )
    db.add(paper)
    await db.commit()
    await db.refresh(paper)

    if body.file_id:
        from app.tasks.bac_tasks import extract_bac_paper
        extract_bac_paper.delay(paper.id, body.file_id)
        paper.extraction_status = "extracting"
        await db.commit()

    return {
        "id": paper.id,
        "title": paper.title,
        "year": paper.year,
        "branch": paper.branch,
        "subject": paper.subject,
        "extraction_status": paper.extraction_status,
    }


@router.get("/papers/meta")
async def papers_meta(_: CurrentUser):
    """Return available branches, subjects per branch, years range, and session types."""
    from app.models.bac import BAC_SUBJECTS_BY_BRANCH
    return {
        "branches": BAC_BRANCHES,
        "subjects_by_branch": BAC_SUBJECTS_BY_BRANCH,
        "sessions": BAC_SESSIONS,
        "regions": BAC_REGIONS,
        "year_range": {"min": 2010, "max": 2025},
    }


# ── Practice Sessions ─────────────────────────────────────────────────────────

class StartPracticeRequest(BaseModel):
    paper_id: str


@router.post("/practice", status_code=201)
async def start_practice(body: StartPracticeRequest, current_user: CurrentUser, db: DB):
    paper = (await db.execute(
        select(BacPaper).where(BacPaper.id == body.paper_id)
    )).scalar_one_or_none()

    if not paper:
        raise HTTPException(status_code=404, detail="paper_not_found")
    if paper.extraction_status != "ready":
        raise HTTPException(status_code=409, detail="paper_not_ready")

    # Resume an existing unsubmitted session
    active = (await db.execute(
        select(BacPracticeSession).where(
            BacPracticeSession.user_id == current_user.id,
            BacPracticeSession.paper_id == body.paper_id,
            BacPracticeSession.submitted_at.is_(None),
        )
    )).scalar_one_or_none()

    questions = (await db.execute(
        select(BacQuestion).where(BacQuestion.paper_id == body.paper_id).order_by(BacQuestion.order_index)
    )).scalars().all()

    if active:
        return _serialize_session(active, paper, questions, include_answers=False)

    session = BacPracticeSession(
        user_id=current_user.id,
        paper_id=body.paper_id,
        duration_minutes=paper.duration_minutes,
        answers={},
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return _serialize_session(session, paper, questions, include_answers=False)


@router.get("/practice/{session_id}")
async def get_practice_session(session_id: str, current_user: CurrentUser, db: DB):
    session = (await db.execute(
        select(BacPracticeSession).where(
            BacPracticeSession.id == session_id,
            BacPracticeSession.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="session_not_found")

    paper = (await db.execute(
        select(BacPaper).where(BacPaper.id == session.paper_id)
    )).scalar_one()

    questions = (await db.execute(
        select(BacQuestion).where(BacQuestion.paper_id == session.paper_id).order_by(BacQuestion.order_index)
    )).scalars().all()

    return _serialize_session(
        session, paper, questions,
        include_answers=session.submitted_at is not None,
    )


class SubmitPracticeRequest(BaseModel):
    answers: dict[str, str]  # {question_id: answer_text}
    time_spent_s: int | None = None


@router.post("/practice/{session_id}/submit")
async def submit_practice(session_id: str, body: SubmitPracticeRequest, current_user: CurrentUser, db: DB):
    session = (await db.execute(
        select(BacPracticeSession).where(
            BacPracticeSession.id == session_id,
            BacPracticeSession.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="session_not_found")
    if session.submitted_at is not None:
        raise HTTPException(status_code=409, detail="already_submitted")

    session.answers = body.answers
    session.submitted_at = datetime.now(timezone.utc)
    session.time_spent_s = body.time_spent_s
    await db.commit()

    # Inline grading (AI calls for open questions — may take 30-90 s)
    await bac_service.grade_session(session_id, db)
    await db.refresh(session)

    return {
        "session_id": session.id,
        "score_over_20": session.score_over_20,
        "grading_status": session.grading_status,
        "per_question_scores": session.per_question_scores,
        "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
    }


@router.get("/stats")
async def get_bac_stats(current_user: CurrentUser, db: DB):
    rows = (await db.execute(
        select(BacPracticeSession, BacPaper)
        .join(BacPaper, BacPaper.id == BacPracticeSession.paper_id)
        .where(
            BacPracticeSession.user_id == current_user.id,
            BacPracticeSession.grading_status == "graded",
            BacPracticeSession.score_over_20.is_not(None),
        )
        .order_by(BacPracticeSession.submitted_at.asc())
    )).all()

    by_subject: dict[str, list[float]] = {}
    history = []

    for sess, paper in rows:
        by_subject.setdefault(paper.subject, []).append(sess.score_over_20)
        history.append({
            "date": sess.submitted_at.date().isoformat() if sess.submitted_at else None,
            "score": sess.score_over_20,
            "subject": paper.subject,
            "branch": paper.branch,
            "paper_title": paper.title,
            "session_id": sess.id,
        })

    subject_averages = {
        subj: round(sum(scores) / len(scores), 2)
        for subj, scores in by_subject.items()
    }

    overall = round(sum(h["score"] for h in history) / len(history), 2) if history else None

    return {
        "overall_average": overall,
        "total_sessions": len(history),
        "subject_averages": subject_averages,
        "score_history": history[-50:],
    }
