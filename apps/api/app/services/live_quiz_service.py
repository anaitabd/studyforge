"""
Live quiz service using Redis pub/sub for real-time state broadcast.
No WebSocket library needed — uses Server-Sent Events (SSE) per client.
Redis channels: live_quiz:{quiz_id} — all state changes broadcast here.
"""
import json
import random
import string
import asyncio
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.live_quiz import LiveQuiz, LiveQuizParticipant, LiveQuizAnswer
from app.models.exam import Exam, Question

logger = logging.getLogger(__name__)


def _generate_pin() -> str:
    return "".join(random.choices(string.digits, k=6))


async def create_live_quiz(
    db: AsyncSession,
    group_id: str,
    host_user_id: str,
    exam_id: str | None = None,
    time_limit_seconds: int = 30,
    points_for_speed: bool = True,
) -> dict:
    pin = _generate_pin()
    quiz = LiveQuiz(
        group_id=group_id,
        host_user_id=host_user_id,
        exam_id=exam_id,
        pin=pin,
        question_time_limit_seconds=time_limit_seconds,
        settings={"points_for_speed": points_for_speed, "show_leaderboard_after_each": True},
    )
    db.add(quiz)
    await db.commit()
    return {"quiz_id": quiz.id, "pin": pin, "status": "lobby"}


async def broadcast_state(quiz_id: str, state: dict):
    """Publish a state update to all subscribers of this quiz."""
    redis = await get_redis()
    await redis.publish(f"live_quiz:{quiz_id}", json.dumps(state))


async def start_next_question(db: AsyncSession, quiz_id: str):
    """Advance to the next question and broadcast."""
    quiz = await db.get(LiveQuiz, quiz_id)
    if not quiz:
        return

    quiz.current_question_index += 1
    quiz.question_started_at = datetime.utcnow()
    quiz.status = f"question_{quiz.current_question_index}"

    # Load question
    if quiz.exam_id:
        q_result = await db.execute(
            select(Question)
            .where(Question.exam_id == quiz.exam_id)
            .order_by(Question.order_index)
            .offset(quiz.current_question_index)
            .limit(1)
        )
        question = q_result.scalar_one_or_none()
    else:
        question = None

    await db.commit()

    state = {
        "event": "question_start",
        "question_index": quiz.current_question_index,
        "question": {
            "content": question.content if question else "",
            "options": question.options if question else {},
            "type": question.type if question else "mcq_single",
            "time_limit_seconds": quiz.question_time_limit_seconds,
        } if question else None,
        "started_at": quiz.question_started_at.isoformat(),
    }
    await broadcast_state(quiz_id, state)

    # Auto-advance after time limit
    asyncio.create_task(_auto_advance(quiz_id, quiz.question_time_limit_seconds))


async def _auto_advance(quiz_id: str, delay: int):
    await asyncio.sleep(delay)
    await broadcast_state(quiz_id, {"event": "time_up", "quiz_id": quiz_id})


async def submit_live_answer(
    db: AsyncSession,
    quiz_id: str,
    participant_id: str,
    answer: str,
    response_time_ms: int,
) -> dict:
    quiz = await db.get(LiveQuiz, quiz_id)
    q_index = quiz.current_question_index

    # Get correct answer
    is_correct = False
    if quiz.exam_id:
        q_result = await db.execute(
            select(Question)
            .where(Question.exam_id == quiz.exam_id)
            .order_by(Question.order_index)
            .offset(q_index)
            .limit(1)
        )
        question = q_result.scalar_one_or_none()
        if question:
            is_correct = answer.strip().upper() == question.correct_answer.strip().upper()

    # Points: base 100, speed bonus up to 100
    base_points = 100 if is_correct else 0
    speed_bonus = 0
    if is_correct and quiz.settings.get("points_for_speed"):
        max_ms = quiz.question_time_limit_seconds * 1000
        speed_bonus = int(100 * max(0, 1 - response_time_ms / max_ms))
    points = base_points + speed_bonus

    db.add(LiveQuizAnswer(
        quiz_id=quiz_id,
        participant_id=participant_id,
        question_index=q_index,
        answer=answer,
        is_correct=is_correct,
        response_time_ms=response_time_ms,
        points_earned=points,
    ))

    # Update participant score
    p_result = await db.execute(
        select(LiveQuizParticipant).where(LiveQuizParticipant.id == participant_id)
    )
    participant = p_result.scalar_one_or_none()
    if participant:
        participant.total_score += points

    await db.commit()
    return {"is_correct": is_correct, "points_earned": points}
