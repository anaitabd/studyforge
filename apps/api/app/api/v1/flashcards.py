import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limiter import rate_limiter
from app.core.security import get_current_user
from app.models.flashcard import Flashcard, FlashcardProgress, FlashcardSet
from app.models.group import GroupMember
from app.services import flashcard_service
from app.services.analytics_service import track_event
from app.services.gamification_service import award_xp

logger = logging.getLogger(__name__)
router = APIRouter(tags=["flashcards"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── helpers ───────────────────────────────────────────────────────────────────

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


async def _require_set_in_group(
    set_id: str, group_id: str, db: AsyncSession
) -> FlashcardSet:
    result = await db.execute(
        select(FlashcardSet).where(
            FlashcardSet.id == set_id,
            FlashcardSet.group_id == group_id,
        )
    )
    card_set = result.scalar_one_or_none()
    if not card_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    return card_set


# ── request models ────────────────────────────────────────────────────────────

class GenerateSetRequest(BaseModel):
    title: str
    file_ids: list[str] | None = None
    max_cards: int = Field(default=40, ge=10, le=100)
    language: str = Field(default="auto", pattern="^(auto|fr|en|ar|es)$")


class ReviewRequest(BaseModel):
    rating: str = Field(pattern="^(again|hard|good|easy)$")


# ── routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/groups/{group_id}/flashcards/generate",
    responses={
        403: {"description": "Not a member of this group or plan does not include flashcards"},
        422: {"description": "No ready files in group"},
    },
)
async def generate_flashcard_set(
    group_id: str,
    body: GenerateSetRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)

    if not rate_limiter.check_feature(current_user.plan, "flashcards"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_not_available",
                "feature": "flashcards",
                "current_plan": current_user.plan,
                "message": "Flashcard generation requires the Personal or School plan.",
            },
        )

    try:
        result = await flashcard_service.generate_set(
            db=db,
            group_id=group_id,
            user_id=current_user.id,
            org_id=current_user.org_id,
            title=body.title,
            file_ids=body.file_ids,
            max_cards=body.max_cards,
            language=body.language,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@router.get(
    "/groups/{group_id}/flashcards",
    responses={403: {"description": "Not a member of this group"}},
)
async def list_flashcard_sets(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)

    result = await db.execute(
        select(FlashcardSet)
        .where(FlashcardSet.group_id == group_id)
        .order_by(FlashcardSet.created_at.desc())
    )
    sets = result.scalars().all()

    output = []
    for s in sets:
        cards_result = await db.execute(
            select(Flashcard).where(Flashcard.set_id == s.id)
        )
        all_cards = cards_result.scalars().all()

        # Count how many cards are due today for this user
        from datetime import date
        today = date.today()
        progress_result = await db.execute(
            select(FlashcardProgress).where(
                FlashcardProgress.card_id.in_([c.id for c in all_cards]),
                FlashcardProgress.user_id == current_user.id,
                FlashcardProgress.due_date <= today,
            )
        )
        due_count = len(progress_result.scalars().all())
        # New cards (no progress record) also count as due
        progress_all = await db.execute(
            select(FlashcardProgress).where(
                FlashcardProgress.card_id.in_([c.id for c in all_cards]),
                FlashcardProgress.user_id == current_user.id,
            )
        )
        studied_ids = {p.card_id for p in progress_all.scalars().all()}
        new_count = sum(1 for c in all_cards if c.id not in studied_ids)

        output.append({
            "id": s.id,
            "title": s.title,
            "group_id": s.group_id,
            "file_id": s.file_id,
            "card_count": len(all_cards),
            "due_count": due_count + new_count,
            "created_at": s.created_at.isoformat(),
        })

    return {"sets": output}


@router.get(
    "/groups/{group_id}/flashcards/{set_id}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Flashcard set not found"},
    },
)
async def get_flashcard_set(
    group_id: str,
    set_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)
    card_set = await _require_set_in_group(set_id, group_id, db)

    cards_result = await db.execute(
        select(Flashcard).where(Flashcard.set_id == set_id).order_by(Flashcard.order_index)
    )
    cards = cards_result.scalars().all()

    progress_result = await db.execute(
        select(FlashcardProgress).where(
            FlashcardProgress.card_id.in_([c.id for c in cards]),
            FlashcardProgress.user_id == current_user.id,
        )
    )
    progress_map = {p.card_id: p for p in progress_result.scalars().all()}

    return {
        "id": card_set.id,
        "title": card_set.title,
        "group_id": card_set.group_id,
        "created_at": card_set.created_at.isoformat(),
        "cards": [
            {
                "id": c.id,
                "front": c.front,
                "back": c.back,
                "source_passage": c.source_passage,
                "order_index": c.order_index,
                "progress": (
                    {
                        "reps": progress_map[c.id].reps,
                        "interval_days": progress_map[c.id].interval_days,
                        "ease_factor": progress_map[c.id].ease_factor,
                        "due_date": progress_map[c.id].due_date.isoformat(),
                    }
                    if c.id in progress_map
                    else None
                ),
            }
            for c in cards
        ],
    }


@router.get(
    "/groups/{group_id}/flashcards/{set_id}/study",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Flashcard set not found"},
    },
)
async def get_due_cards(
    group_id: str,
    set_id: str,
    current_user: CurrentUser,
    db: DB,
    limit: int = 20,
):
    """Return cards due for review today, sorted: new cards first, then most overdue."""
    await _require_group_member(group_id, current_user.id, db)
    await _require_set_in_group(set_id, group_id, db)

    due = await flashcard_service.get_due_cards(
        db=db, set_id=set_id, user_id=current_user.id, limit=limit
    )
    return {"cards": due, "count": len(due)}


@router.post(
    "/groups/{group_id}/flashcards/{set_id}/cards/{card_id}/review",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Card not found in this set"},
        422: {"description": "Invalid rating"},
    },
)
async def review_card(
    group_id: str,
    set_id: str,
    card_id: str,
    body: ReviewRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)

    # Verify card belongs to the set
    result = await db.execute(
        select(Flashcard).where(
            Flashcard.id == card_id,
            Flashcard.set_id == set_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Card not found in this set")

    try:
        progress = await flashcard_service.record_review(
            db=db,
            card_id=card_id,
            user_id=current_user.id,
            rating=body.rating,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    await track_event(
        user_id=current_user.id,
        event_type="flashcard.reviewed",
        resource_type="flashcard_set",
        resource_id=set_id,
        metadata={"card_id": card_id, "rating": body.rating},
    )
    asyncio.create_task(award_xp(db, current_user.id, "flashcard_review",
                                 {"card_id": card_id, "rating": body.rating}))
    return progress


@router.delete(
    "/groups/{group_id}/flashcards/{set_id}",
    responses={
        403: {"description": "Only the set creator can delete it"},
        404: {"description": "Flashcard set not found"},
    },
)
async def delete_flashcard_set(
    group_id: str,
    set_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await _require_group_member(group_id, current_user.id, db)
    card_set = await _require_set_in_group(set_id, group_id, db)

    if card_set.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the set creator can delete it")

    # Cascade: delete progress → cards → set
    cards_result = await db.execute(
        select(Flashcard).where(Flashcard.set_id == set_id)
    )
    card_ids = [c.id for c in cards_result.scalars().all()]

    if card_ids:
        await db.execute(
            delete(FlashcardProgress).where(FlashcardProgress.card_id.in_(card_ids))
        )
        await db.execute(delete(Flashcard).where(Flashcard.set_id == set_id))

    await db.execute(delete(FlashcardSet).where(FlashcardSet.id == set_id))
    await db.commit()

    return {"message": "Flashcard set deleted"}
