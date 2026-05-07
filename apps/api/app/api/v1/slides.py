import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.group import GroupMember
from app.models.slide_deck import Slide, SlideDeck, SlideProgress, SlideQuizAnswer

logger = logging.getLogger(__name__)
router = APIRouter(tags=["slides"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


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


async def _require_teacher(
    group_id: str, user_id: str, db: AsyncSession
) -> GroupMember:
    membership = await _require_group_member(group_id, user_id, db)
    if membership.role not in ("owner", "teacher"):
        raise HTTPException(status_code=403, detail="Teacher or owner access required")
    return membership


async def _get_or_create_progress(
    deck_id: str, user_id: str, db: AsyncSession
) -> SlideProgress:
    progress = (
        await db.execute(
            select(SlideProgress).where(
                SlideProgress.deck_id == deck_id,
                SlideProgress.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if progress is None:
        progress = SlideProgress(
            deck_id=deck_id,
            user_id=user_id,
            current_slide_index=0,
            completed_slide_ids=[],
        )
        db.add(progress)
        await db.flush()
    return progress


# ── request / response models ─────────────────────────────────────────────────

class GenerateDeckRequest(BaseModel):
    title: str = Field(..., max_length=255)
    file_ids: list[str] = Field(..., min_length=1)
    course_name: str = Field(default="", max_length=255)
    professor_name: str = Field(default="", max_length=255)
    style: str = Field(default="academic", max_length=40)
    language: str = Field(default="en", max_length=10)


class ProgressUpdateRequest(BaseModel):
    current_slide_index: int | None = Field(default=None, ge=0)
    mark_slide_completed_id: str | None = None


class QuizAnswerRequest(BaseModel):
    selected_index: int = Field(..., ge=0, le=3)


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/groups/{group_id}/slide-decks")
async def create_deck(
    group_id: str, body: GenerateDeckRequest, current_user: CurrentUser, db: DB
):
    await _require_teacher(group_id, current_user.id, db)

    deck = SlideDeck(
        group_id=group_id,
        user_id=current_user.id,
        title=body.title.strip(),
        course_name=body.course_name.strip(),
        professor_name=body.professor_name.strip(),
        style=body.style,
        language=body.language,
        file_ids=body.file_ids,
        status="generating",
    )
    db.add(deck)
    await db.commit()
    await db.refresh(deck)

    # Late import to avoid Celery side-effects on app import.
    from app.tasks.slide_tasks import generate_slides_task
    generate_slides_task.delay(deck.id)

    return {
        "id": deck.id,
        "status": deck.status,
        "estimated_seconds": 90,
    }


@router.get("/groups/{group_id}/slide-decks")
async def list_decks(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
    limit: int = 50,
    offset: int = 0,
):
    await _require_group_member(group_id, current_user.id, db)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    decks = (
        await db.execute(
            select(SlideDeck)
            .where(SlideDeck.group_id == group_id)
            .order_by(SlideDeck.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    deck_ids = [d.id for d in decks]

    progress_by_deck: dict[str, SlideProgress] = {}
    if deck_ids:
        rows = (
            await db.execute(
                select(SlideProgress).where(
                    SlideProgress.deck_id.in_(deck_ids),
                    SlideProgress.user_id == current_user.id,
                )
            )
        ).scalars().all()
        progress_by_deck = {p.deck_id: p for p in rows}

    items = []
    for d in decks:
        prog = progress_by_deck.get(d.id)
        completed = len(prog.completed_slide_ids or []) if prog else 0
        pct = round(100.0 * completed / d.slide_count) if d.slide_count else 0
        items.append({
            "id": d.id,
            "title": d.title,
            "course_name": d.course_name,
            "status": d.status,
            "error_message": d.error_message,
            "slide_count": d.slide_count,
            "language": d.language,
            "created_at": d.created_at.isoformat(),
            "my_progress_pct": pct,
            "my_completed_slides": completed,
            "my_current_slide_index": prog.current_slide_index if prog else 0,
        })

    total = int((await db.execute(
        select(func.count(SlideDeck.id)).where(SlideDeck.group_id == group_id)
    )).scalar_one() or 0)

    return {"decks": items, "total": total, "has_more": offset + len(items) < total}


@router.get("/groups/{group_id}/slide-decks/{deck_id}")
async def get_deck(
    group_id: str, deck_id: str, current_user: CurrentUser, db: DB
):
    await _require_group_member(group_id, current_user.id, db)
    deck = (
        await db.execute(
            select(SlideDeck).where(
                SlideDeck.id == deck_id, SlideDeck.group_id == group_id
            )
        )
    ).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    slides = (
        await db.execute(
            select(Slide)
            .where(Slide.deck_id == deck_id)
            .order_by(Slide.order_index)
        )
    ).scalars().all()

    progress = await _get_or_create_progress(deck_id, current_user.id, db)
    await db.commit()

    answers = (
        await db.execute(
            select(SlideQuizAnswer).where(
                SlideQuizAnswer.deck_id == deck_id,
                SlideQuizAnswer.user_id == current_user.id,
            )
        )
    ).scalars().all()
    answers_by_slide = {
        a.slide_id: {"selected_index": a.selected_index, "is_correct": a.is_correct}
        for a in answers
    }

    completed_set = set(progress.completed_slide_ids or [])

    def _serialize_quiz_for_user(quiz: dict | None, slide_id: str) -> dict | None:
        if not quiz:
            return None
        # Hide correct_index/rationale until user has answered.
        if slide_id in answers_by_slide:
            return quiz
        return {
            "question": quiz.get("question"),
            "options": quiz.get("options", []),
        }

    slides_out = [
        {
            "id": s.id,
            "order_index": s.order_index,
            "slide_type": s.slide_type,
            "title": s.title,
            "bullets": s.bullets or [],
            "detailed_explanation": s.detailed_explanation,
            "examples": s.examples or [],
            "speaker_notes": s.speaker_notes,
            "source_file": s.source_file,
            "source_pages": s.source_pages or [],
            "quiz": _serialize_quiz_for_user(s.quiz, s.id),
            "completed": s.id in completed_set,
        }
        for s in slides
    ]

    return {
        "id": deck.id,
        "title": deck.title,
        "course_name": deck.course_name,
        "professor_name": deck.professor_name,
        "style": deck.style,
        "language": deck.language,
        "status": deck.status,
        "error_message": deck.error_message,
        "file_ids": deck.file_ids or [],
        "slide_count": deck.slide_count,
        "created_at": deck.created_at.isoformat(),
        "slides": slides_out,
        "my_progress": {
            "current_slide_index": progress.current_slide_index,
            "completed_slide_ids": list(completed_set),
            "progress_pct": round(100.0 * len(completed_set) / deck.slide_count) if deck.slide_count else 0,
        },
        "my_quiz_answers": answers_by_slide,
    }


@router.post("/groups/{group_id}/slide-decks/{deck_id}/progress")
async def update_progress(
    group_id: str,
    deck_id: str,
    body: ProgressUpdateRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)
    deck = (
        await db.execute(
            select(SlideDeck).where(
                SlideDeck.id == deck_id, SlideDeck.group_id == group_id
            )
        )
    ).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    progress = await _get_or_create_progress(deck_id, current_user.id, db)

    if body.current_slide_index is not None:
        max_idx = max(0, deck.slide_count - 1)
        progress.current_slide_index = min(body.current_slide_index, max_idx)

    if body.mark_slide_completed_id:
        # Verify slide belongs to this deck.
        belongs = (
            await db.execute(
                select(Slide.id).where(
                    Slide.id == body.mark_slide_completed_id,
                    Slide.deck_id == deck_id,
                )
            )
        ).scalar_one_or_none()
        if not belongs:
            raise HTTPException(status_code=404, detail="Slide not found in deck")
        completed = list(progress.completed_slide_ids or [])
        if body.mark_slide_completed_id not in completed:
            completed.append(body.mark_slide_completed_id)
            progress.completed_slide_ids = completed

    if deck.slide_count and len(progress.completed_slide_ids or []) >= deck.slide_count:
        progress.completed_at = datetime.now(timezone.utc)

    await db.commit()
    completed_count = len(progress.completed_slide_ids or [])
    return {
        "current_slide_index": progress.current_slide_index,
        "completed_slide_ids": list(progress.completed_slide_ids or []),
        "progress_pct": round(100.0 * completed_count / deck.slide_count) if deck.slide_count else 0,
    }


@router.post("/groups/{group_id}/slide-decks/{deck_id}/slides/{slide_id}/quiz")
async def submit_quiz(
    group_id: str,
    deck_id: str,
    slide_id: str,
    body: QuizAnswerRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)
    slide = (
        await db.execute(
            select(Slide).where(Slide.id == slide_id, Slide.deck_id == deck_id)
        )
    ).scalar_one_or_none()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    if not slide.quiz:
        raise HTTPException(status_code=400, detail="This slide has no quiz")

    correct_index = int(slide.quiz.get("correct_index", 0))
    is_correct = body.selected_index == correct_index

    existing = (
        await db.execute(
            select(SlideQuizAnswer).where(
                SlideQuizAnswer.slide_id == slide_id,
                SlideQuizAnswer.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.selected_index = body.selected_index
        existing.is_correct = is_correct
        existing.answered_at = datetime.now(timezone.utc)
    else:
        db.add(SlideQuizAnswer(
            slide_id=slide_id,
            deck_id=deck_id,
            user_id=current_user.id,
            selected_index=body.selected_index,
            is_correct=is_correct,
        ))
    await db.commit()

    return {
        "is_correct": is_correct,
        "correct_index": correct_index,
        "rationale": slide.quiz.get("rationale", ""),
        "selected_index": body.selected_index,
    }


@router.get("/groups/{group_id}/slide-decks/{deck_id}/pptx")
async def download_pptx(
    group_id: str, deck_id: str, current_user: CurrentUser, db: DB
):
    await _require_group_member(group_id, current_user.id, db)
    deck = (
        await db.execute(
            select(SlideDeck).where(
                SlideDeck.id == deck_id, SlideDeck.group_id == group_id
            )
        )
    ).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    if not deck.pptx_url:
        raise HTTPException(status_code=409, detail="PPTX not yet ready")
    return RedirectResponse(deck.pptx_url, status_code=302)


@router.delete("/groups/{group_id}/slide-decks/{deck_id}", status_code=204)
async def delete_deck(
    group_id: str, deck_id: str, current_user: CurrentUser, db: DB
):
    await _require_teacher(group_id, current_user.id, db)
    deck = (
        await db.execute(
            select(SlideDeck).where(
                SlideDeck.id == deck_id, SlideDeck.group_id == group_id
            )
        )
    ).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    await db.execute(delete(SlideDeck).where(SlideDeck.id == deck_id))
    await db.commit()
    return None
