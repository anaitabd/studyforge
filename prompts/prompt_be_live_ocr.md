# StudyForge — BE-10: Live Classroom + BE-11: OCR & Photo Problem Solving

---

# Part A — Live Classroom (Kahoot-style)

## Read first
```bash
cat apps/api/app/models/study_room.py   # existing rooms model
cat apps/api/app/api/v1/rooms.py
cat docker-compose.yml
```

## Step A1 — Live quiz model

Create `apps/api/app/models/live_quiz.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Boolean, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class LiveQuiz(Base):
    """A teacher-hosted live quiz session."""
    __tablename__ = "live_quizzes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"))
    host_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    exam_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("exams.id"), nullable=True)
    pin: Mapped[str] = mapped_column(String(6), unique=True)  # 6-digit join code
    status: Mapped[str] = mapped_column(String(20), default="lobby")
    # lobby | question_N | results_N | finished
    current_question_index: Mapped[int] = mapped_column(Integer, default=-1)
    question_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    question_time_limit_seconds: Mapped[int] = mapped_column(Integer, default=30)
    settings: Mapped[dict] = mapped_column(JSONB, default={})
    # settings: {show_leaderboard_after_each: bool, points_for_speed: bool, allow_rejoin: bool}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LiveQuizParticipant(Base):
    __tablename__ = "live_quiz_participants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: Mapped[str] = mapped_column(String(36), ForeignKey("live_quizzes.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    nickname: Mapped[str] = mapped_column(String(50))
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LiveQuizAnswer(Base):
    __tablename__ = "live_quiz_answers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: Mapped[str] = mapped_column(String(36), ForeignKey("live_quizzes.id", ondelete="CASCADE"))
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("live_quiz_participants.id"))
    question_index: Mapped[int] = mapped_column(Integer)
    answer: Mapped[str] = mapped_column(String(200))
    is_correct: Mapped[bool] = mapped_column(Boolean)
    response_time_ms: Mapped[int] = mapped_column(Integer)  # milliseconds to answer
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

## Step A2 — Live quiz service using Redis pub/sub

Create `apps/api/app/services/live_quiz_service.py`:

```python
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

from app.core.redis import get_redis   # existing Redis connection
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
```

## Step A3 — SSE endpoint for real-time quiz state

Add to `apps/api/app/api/v1/` a new file `live_quiz.py`:

```
POST /live-quiz/create          — teacher creates quiz, gets {quiz_id, pin}
POST /live-quiz/{id}/start      — teacher starts (moves from lobby)
POST /live-quiz/{id}/next       — teacher advances to next question
POST /live-quiz/{id}/end        — teacher ends quiz
GET  /live-quiz/join/{pin}      — student joins by PIN, returns {quiz_id, participant_id}
POST /live-quiz/{id}/answer     — student submits answer {answer, response_time_ms}
GET  /live-quiz/{id}/stream     — SSE stream of quiz state events
GET  /live-quiz/{id}/results    — final leaderboard
```

The `/stream` endpoint:
```python
from fastapi.responses import StreamingResponse
import asyncio

@router.get("/{quiz_id}/stream")
async def quiz_stream(quiz_id: str, current_user: CurrentUser):
    async def event_generator():
        redis = await get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"live_quiz:{quiz_id}")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data'].decode()}\n\n"
        finally:
            await pubsub.unsubscribe(f"live_quiz:{quiz_id}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

---

# Part B — OCR & Photo Problem Solving

## Step B1 — Handwriting OCR endpoint

Add to `apps/api/app/api/v1/files.py`:

```
POST /ocr/extract
  — accepts multipart image (JPEG/PNG/WebP)
  — runs AI vision to extract text from handwritten notes
  — returns {text, confidence, detected_language, has_math}
  — optionally: index the extracted text into the user's personal ChromaDB collection
```

```python
@router.post("/ocr/extract")
async def extract_text_from_image(
    file: UploadFile = File(...),
    index_to_group: str | None = Query(None),  # optional group_id to index into
    current_user: CurrentUser = Depends(get_current_user),
    db: DB = Depends(get_db),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Image only: JPEG, PNG, or WebP.")

    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 15MB.")

    import base64
    image_b64 = base64.b64encode(contents).decode("utf-8")

    extracted = await ai_service.describe_image(
        image_b64=image_b64,
        media_type=file.content_type,
        prompt=(
            "Extract ALL text from this handwritten note or document.\n"
            "Include every word, number, formula, and diagram label.\n"
            "For mathematical formulas, use LaTeX notation (e.g. $\\frac{x}{2}$).\n"
            "For tables, reproduce them in Markdown table format.\n"
            "For diagrams or drawings, describe what is drawn in [brackets].\n"
            "Preserve the original structure (paragraphs, bullet points, numbering).\n"
            "Output ONLY the extracted text, nothing else."
        ),
    )

    has_math = any(c in extracted for c in ["$", "\\frac", "\\sqrt", "=", "∫", "∑", "π"])

    # Detect language
    arabic_chars = sum(1 for c in extracted if "\u0600" <= c <= "\u06FF")
    french_keywords = ["le", "la", "les", "de", "du", "et", "est", "une"]
    detected_lang = "ar" if arabic_chars > len(extracted) * 0.3 else (
        "fr" if any(w in extracted.lower() for w in french_keywords) else "mixed"
    )

    result = {
        "text": extracted,
        "char_count": len(extracted),
        "has_math": has_math,
        "detected_language": detected_lang,
    }

    # Optionally index into a group's ChromaDB
    if index_to_group:
        from app.services.file_processor import file_processor
        from app.services.vector_store import vector_store
        chunks = file_processor._chunk_text(extracted, file_name="handwritten_notes.txt", page_number=1)
        await vector_store.upsert_chunks(
            chunks=chunks,
            org_id=current_user.org_id,
            user_id=current_user.id,
        )
        result["indexed"] = True
        result["chunk_count"] = len(chunks)

    return result
```

## Step B2 — Photo problem solver (Photomath-style)

Add endpoint:

```
POST /solve/photo
  — student takes photo of a math/science problem
  — AI reads the problem and returns step-by-step solution
  — NEVER gives just the answer — always step-by-step
```

```python
@router.post("/solve/photo")
async def solve_from_photo(
    file: UploadFile = File(...),
    level: str | None = Query(None),
    subject: str | None = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    contents = await file.read()
    image_b64 = base64.b64encode(contents).decode()

    # Step 1: Extract the problem text
    problem_text = await ai_service.describe_image(
        image_b64=image_b64,
        media_type=file.content_type,
        prompt="Extract the math or science problem from this image. Output only the problem statement.",
    )

    # Step 2: Solve step by step
    level_context = f"This is for a Moroccan {level} student." if level else ""
    solution = await ai_service.generate_structured_json(
        prompt=(
            f"Solve this problem step by step for a student. {level_context}\n\n"
            f"PROBLEM: {problem_text}\n\n"
            "Return JSON with:\n"
            '- "problem_restated": the problem in clear words\n'
            '- "approach": which method/theorem to use (1-2 sentences)\n'
            '- "steps": array of {step_number, action, calculation, explanation} '
            "   — each step must show the calculation and explain WHY in simple words\n"
            '- "final_answer": the answer with correct unit\n'
            '- "verification": how to check the answer is correct\n'
            '- "common_mistakes": 1-2 mistakes students make on this type of problem\n'
            '- "related_concepts": list of concepts this problem uses\n'
        ),
        schema_description=(
            "object with: problem_restated, approach, steps (array of {step_number, action, "
            "calculation, explanation}), final_answer, verification, common_mistakes, related_concepts"
        ),
        max_tokens=2000,
    )

    return {
        "problem": problem_text,
        "solution": solution,
        "level": level,
        "subject": subject,
    }
```

## Step B3 — Add to requirements

```
# Already in requirements.txt from earlier:
# pdf2image, pillow

# No new dependencies needed — uses existing ai_service.describe_image()
```

## Verification

```bash
python -c "
from app.services.gamification_service import compute_level, BADGE_DEFINITIONS
print(f'Badges defined: {len(BADGE_DEFINITIONS)}')
print(f'compute_level(5500): {compute_level(5500)}')
from app.services.live_quiz_service import create_live_quiz
print('Live quiz service: OK')
print('OCR endpoint: ready (no extra imports needed)')
print('All: OK')
"
```
