import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import get_current_user
from app.models.group import GroupMember
from app.models.live_quiz import LiveQuiz, LiveQuizAnswer, LiveQuizParticipant
from app.services import live_quiz_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/live-quiz", tags=["live-quiz"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


async def _require_host(quiz_id: str, user_id: str, db: AsyncSession) -> LiveQuiz:
    quiz = await db.get(LiveQuiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.host_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the quiz host can perform this action")
    return quiz


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CreateQuizRequest(BaseModel):
    group_id: str
    exam_id: str | None = None
    time_limit_seconds: int = 30
    points_for_speed: bool = True


class JoinQuizRequest(BaseModel):
    nickname: str


class SubmitAnswerRequest(BaseModel):
    participant_id: str
    answer: str
    response_time_ms: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/create")
async def create_quiz(body: CreateQuizRequest, current_user: CurrentUser, db: DB):
    """Teacher creates a live quiz session. Returns quiz_id and 6-digit PIN."""
    membership = await _require_group_member(body.group_id, current_user.id, db)
    if membership.role not in ("owner", "teacher"):
        raise HTTPException(status_code=403, detail="Only teachers/owners can host live quizzes")

    result = await live_quiz_service.create_live_quiz(
        db=db,
        group_id=body.group_id,
        host_user_id=current_user.id,
        exam_id=body.exam_id,
        time_limit_seconds=body.time_limit_seconds,
        points_for_speed=body.points_for_speed,
    )
    return result


@router.post("/{quiz_id}/start")
async def start_quiz(quiz_id: str, current_user: CurrentUser, db: DB):
    """Teacher starts the quiz — moves from lobby to first question."""
    quiz = await _require_host(quiz_id, current_user.id, db)
    if quiz.status != "lobby":
        raise HTTPException(status_code=400, detail="Quiz is not in lobby state")

    await live_quiz_service.start_next_question(db, quiz_id)
    return {"status": "started", "quiz_id": quiz_id}


@router.post("/{quiz_id}/next")
async def next_question(quiz_id: str, current_user: CurrentUser, db: DB):
    """Teacher advances to the next question."""
    await _require_host(quiz_id, current_user.id, db)
    await live_quiz_service.start_next_question(db, quiz_id)
    return {"status": "advanced", "quiz_id": quiz_id}


@router.post("/{quiz_id}/end")
async def end_quiz(quiz_id: str, current_user: CurrentUser, db: DB):
    """Teacher ends the quiz and broadcasts final results."""
    quiz = await _require_host(quiz_id, current_user.id, db)
    quiz.status = "finished"
    quiz.ended_at = datetime.now(timezone.utc)
    await db.commit()

    await live_quiz_service.broadcast_state(quiz_id, {"event": "quiz_finished", "quiz_id": quiz_id})
    return {"status": "finished", "quiz_id": quiz_id}


@router.get("/join/{pin}")
async def join_by_pin(pin: str, current_user: CurrentUser, db: DB, nickname: str = Query(..., max_length=50)):
    """Student joins a quiz by PIN and chosen nickname."""
    result = await db.execute(
        select(LiveQuiz).where(LiveQuiz.pin == pin, LiveQuiz.status != "finished")
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or already finished")

    # Check not already joined
    existing = await db.execute(
        select(LiveQuizParticipant).where(
            LiveQuizParticipant.quiz_id == quiz.id,
            LiveQuizParticipant.user_id == current_user.id,
        )
    )
    participant = existing.scalar_one_or_none()
    if participant:
        participant.is_online = True
        participant.nickname = nickname
    else:
        participant = LiveQuizParticipant(
            quiz_id=quiz.id,
            user_id=current_user.id,
            nickname=nickname,
        )
        db.add(participant)

    await db.commit()
    await db.refresh(participant)

    # Announce new participant
    await live_quiz_service.broadcast_state(quiz.id, {
        "event": "participant_joined",
        "participant_id": participant.id,
        "nickname": nickname,
    })

    return {
        "quiz_id": quiz.id,
        "participant_id": participant.id,
        "status": quiz.status,
        "pin": pin,
    }


@router.post("/{quiz_id}/answer")
async def submit_answer(quiz_id: str, body: SubmitAnswerRequest, current_user: CurrentUser, db: DB):
    """Student submits their answer for the current question."""
    result = await live_quiz_service.submit_live_answer(
        db=db,
        quiz_id=quiz_id,
        participant_id=body.participant_id,
        answer=body.answer,
        response_time_ms=body.response_time_ms,
    )
    return result


@router.get("/{quiz_id}/stream")
async def quiz_stream(quiz_id: str, current_user: CurrentUser):
    """SSE stream — clients subscribe here to receive all quiz state events."""
    async def event_generator():
        redis = await get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"live_quiz:{quiz_id}")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode()
                    yield f"data: {data}\n\n"
        finally:
            await pubsub.unsubscribe(f"live_quiz:{quiz_id}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{quiz_id}/results")
async def quiz_results(quiz_id: str, current_user: CurrentUser, db: DB):
    """Final leaderboard — ordered by total score descending."""
    quiz = await db.get(LiveQuiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    p_result = await db.execute(
        select(LiveQuizParticipant)
        .where(LiveQuizParticipant.quiz_id == quiz_id)
        .order_by(LiveQuizParticipant.total_score.desc())
    )
    participants = p_result.scalars().all()

    leaderboard = [
        {
            "rank": i + 1,
            "participant_id": p.id,
            "nickname": p.nickname,
            "total_score": p.total_score,
            "is_online": p.is_online,
        }
        for i, p in enumerate(participants)
    ]

    return {
        "quiz_id": quiz_id,
        "status": quiz.status,
        "leaderboard": leaderboard,
        "ended_at": quiz.ended_at.isoformat() if quiz.ended_at else None,
    }
