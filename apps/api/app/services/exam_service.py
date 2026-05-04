import logging
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import Exam, ExamSession, Question
from app.models.file import File
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

# JSON schema description handed to the LLM
_MCQ_SINGLE_SCHEMA = (
    "Array of objects, each with: "
    '"question" (string), '
    '"options" (object with keys A, B, C, D, each a string), '
    '"correct_answer" (one of "A","B","C","D"), '
    '"explanation" (2-4 sentences explaining why the correct answer is right '
    "and why the distractors are wrong), "
    '"source_passage" (verbatim excerpt from the provided text that contains the answer), '
    '"difficulty" (one of "easy","medium","hard")'
)

_TRUE_FALSE_SCHEMA = (
    "Array of objects, each with: "
    '"question" (string, a statement to evaluate), '
    '"options" (object: {"A": "True", "B": "False"}), '
    '"correct_answer" (one of "A","B"), '
    '"explanation" (2-4 sentences), '
    '"source_passage" (verbatim excerpt), '
    '"difficulty" (one of "easy","medium","hard")'
)

_FILL_BLANK_SCHEMA = (
    "Array of objects, each with: "
    '"question" (string containing _____ where the answer goes), '
    '"options" (object with keys A, B, C, D, each a string), '
    '"correct_answer" (one of "A","B","C","D"), '
    '"explanation" (2-4 sentences), '
    '"source_passage" (verbatim excerpt), '
    '"difficulty" (one of "easy","medium","hard")'
)

_SCHEMA_BY_TYPE = {
    "mcq_single": _MCQ_SINGLE_SCHEMA,
    "mcq_multiple": _MCQ_SINGLE_SCHEMA,  # same structure, multiple correct allowed
    "true_false": _TRUE_FALSE_SCHEMA,
    "fill_blank": _FILL_BLANK_SCHEMA,
}

_LANGUAGE_INSTRUCTIONS = {
    "fr": "Write all questions, options, explanations, and source passages in French.",
    "ar": "Write all questions, options, explanations, and source passages in Arabic.",
    "es": "Write all questions, options, explanations, and source passages in Spanish.",
    "en": "Write all questions, options, explanations, and source passages in English.",
    "auto": "Match the language of the source material.",
}


def _sample_chunks(chunks: list[dict], target_count: int) -> list[dict]:
    """
    Stratified sample from a list of chunks: take proportionally from
    the beginning, middle, and end to ensure broad coverage.
    """
    if len(chunks) <= target_count:
        return chunks

    third = target_count // 3
    remainder = target_count - third * 3

    n = len(chunks)
    start = chunks[: n // 3]
    mid = chunks[n // 3 : 2 * n // 3]
    end = chunks[2 * n // 3 :]

    sampled = (
        random.sample(start, min(third + remainder, len(start)))
        + random.sample(mid, min(third, len(mid)))
        + random.sample(end, min(third, len(end)))
    )
    return sampled


def _build_generation_prompt(
    chunks: list[dict],
    count: int,
    difficulty: str,
    question_type: str,
    language: str,
    topic_focus: str | None,
) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks):
        meta = chunk.get("metadata", {})
        file_name = meta.get("file_name", "Unknown file")
        page = meta.get("page_number", "?")
        context_parts.append(
            f"[Source {i + 1} — {file_name}, page {page}]\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    difficulty_instruction = (
        f"Generate questions of difficulty: {difficulty}. "
        if difficulty != "mixed"
        else "Mix easy, medium, and hard questions evenly. "
    )

    topic_instruction = (
        f"Focus specifically on the topic: {topic_focus}. "
        if topic_focus
        else "Cover a broad range of topics from the material. "
    )

    type_instruction = {
        "mcq_single": "Each question has exactly one correct answer.",
        "mcq_multiple": "Some questions may have multiple correct answers; indicate the first correct one as correct_answer.",
        "true_false": "Each question is a statement the student evaluates as True or False.",
        "fill_blank": "Each question has a blank (___) that the student fills in.",
    }.get(question_type, "Each question has exactly one correct answer.")

    lang_instruction = _LANGUAGE_INSTRUCTIONS.get(language, _LANGUAGE_INSTRUCTIONS["auto"])

    return (
        f"Generate exactly {count} {question_type.replace('_', ' ')} questions "
        f"based ONLY on the following course material excerpts.\n\n"
        f"{difficulty_instruction}"
        f"{topic_instruction}"
        f"{type_instruction} "
        f"{lang_instruction}\n\n"
        "Rules:\n"
        "- Every question MUST be answerable from the provided text excerpts only.\n"
        "- source_passage must be a verbatim quote from one of the excerpts above.\n"
        "- Do NOT invent facts not present in the material.\n"
        "- Make each question exam-quality: unambiguous wording, one clearly best interpretation, and no trivia phrasing.\n"
        "- Make distractors plausible but clearly wrong to a student who read the material.\n"
        "- Vary the question style (definition, application, comparison, consequence).\n"
        "- Ensure broad coverage: avoid repeating near-identical concepts across questions.\n"
        "- Include at least 30% higher-order questions (application, analysis, or troubleshooting) when source allows.\n\n"
        f"COURSE MATERIAL:\n\n{context}"
    )


async def generate_exam(
    db: AsyncSession,
    group_id: str,
    creator_id: str,
    title: str,
    question_count: int = 10,
    difficulty: str = "mixed",
    question_type: str = "mcq_single",
    language: str = "auto",
    file_ids: list[str] | None = None,
    topic_focus: str | None = None,
) -> dict:
    """
    Generate an exam from group files and persist it to the DB.
    Returns the exam dict including all questions (with correct answers —
    only expose to the caller, not directly to students taking the exam).
    """
    question_count = max(5, min(50, question_count))

    # Resolve which files to use
    if file_ids:
        result = await db.execute(
            select(File).where(
                File.id.in_(file_ids),
                File.group_id == group_id,
                File.status == "ready",
            )
        )
        files = result.scalars().all()
        if not files:
            raise ValueError("No ready files found for the specified file IDs.")
        resolved_file_ids = [f.id for f in files]
    else:
        result = await db.execute(
            select(File).where(File.group_id == group_id, File.status == "ready")
        )
        files = result.scalars().all()
        if not files:
            raise ValueError("No ready files found in this group. Upload and process files first.")
        resolved_file_ids = [f.id for f in files]

    # Fetch chunks from ChromaDB
    all_chunks = vector_store.get_all_chunks_for_files(group_id, resolved_file_ids)
    if not all_chunks:
        raise ValueError("No indexed content found. The files may still be processing.")

    # Sample proportionally while keeping the LLM prompt bounded. Large PDFs can
    # otherwise turn exam generation into a multi-minute request.
    target_chunks = min(len(all_chunks), max(8, min(question_count + 4, 16)))
    sampled = _sample_chunks(all_chunks, target_chunks)

    schema = _SCHEMA_BY_TYPE.get(question_type, _MCQ_SINGLE_SCHEMA)
    prompt = _build_generation_prompt(
        sampled, question_count, difficulty, question_type, language, topic_focus
    )

    logger.info(
        f"Generating {question_count} {difficulty} {question_type} questions "
        f"for group {group_id} using {len(sampled)} chunks"
    )

    raw_questions = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description=schema,
        max_tokens=min(8192, max(4096, question_count * 650)),
    )

    if not isinstance(raw_questions, list):
        raise ValueError("AI returned unexpected format for questions.")

    # Persist exam
    exam_id = str(uuid.uuid4())
    exam = Exam(
        id=exam_id,
        group_id=group_id,
        creator_id=creator_id,
        title=title,
        config={
            "question_count": question_count,
            "difficulty": difficulty,
            "question_type": question_type,
            "language": language,
            "file_ids": resolved_file_ids,
            "topic_focus": topic_focus,
        },
        status="draft",
        attempt_limit=1,
    )
    db.add(exam)

    # Persist questions
    questions_out = []
    for i, q in enumerate(raw_questions):
        if not isinstance(q, dict):
            continue
        if not all(k in q for k in ("question", "options", "correct_answer")):
            continue

        q_id = str(uuid.uuid4())
        question = Question(
            id=q_id,
            exam_id=exam_id,
            type=question_type,
            content=q.get("question", ""),
            options=q.get("options", {}),
            correct_answer=q.get("correct_answer", "A"),
            explanation=q.get("explanation", ""),
            source_passage=q.get("source_passage", ""),
            difficulty=q.get("difficulty", difficulty if difficulty != "mixed" else "medium"),
            order_index=i,
        )
        db.add(question)
        questions_out.append({
            "id": q_id,
            "type": question_type,
            "content": question.content,
            "options": question.options,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation,
            "source_passage": question.source_passage,
            "difficulty": question.difficulty,
            "order_index": i,
        })

    await db.commit()

    return {
        "id": exam_id,
        "group_id": group_id,
        "title": title,
        "status": "draft",
        "config": exam.config,
        "question_count": len(questions_out),
        "questions": questions_out,
        "created_at": exam.created_at.isoformat() if exam.created_at else None,
    }


async def start_session(
    db: AsyncSession,
    exam_id: str,
    user_id: str,
    room_id: str | None = None,
    shuffle: bool = False,
) -> dict:
    """
    Start a new exam session for a student.
    Returns the exam questions WITHOUT correct answers or explanations.
    """
    # Load exam
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam:
        raise ValueError("Exam not found.")

    # Check attempt limit
    existing_sessions = await db.execute(
        select(ExamSession).where(
            ExamSession.exam_id == exam_id,
            ExamSession.user_id == user_id,
            ExamSession.submitted_at.is_not(None),
        )
    )
    completed_count = len(existing_sessions.scalars().all())
    if exam.attempt_limit > 0 and completed_count >= exam.attempt_limit:
        raise ValueError(f"Attempt limit reached ({exam.attempt_limit}).")

    # Check if exam window is open
    now = datetime.now(timezone.utc)
    if exam.starts_at and now < exam.starts_at:
        raise ValueError("Exam has not started yet.")
    if exam.ends_at and now > exam.ends_at:
        raise ValueError("Exam deadline has passed.")

    # Load questions
    q_result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.order_index)
    )
    questions = q_result.scalars().all()
    if not questions:
        raise ValueError("Exam has no questions.")

    if shuffle:
        questions = list(questions)
        random.shuffle(questions)

    # Create session
    session_id = str(uuid.uuid4())
    session = ExamSession(
        id=session_id,
        exam_id=exam_id,
        user_id=user_id,
        room_id=room_id,
        answers={},
        score=None,
        total=None,
    )
    db.add(session)
    await db.commit()

    # Return questions without correct_answer / explanation (revealed after submission)
    return {
        "session_id": session_id,
        "exam_id": exam_id,
        "exam_title": exam.title,
        "config": exam.config,
        "ends_at": exam.ends_at.isoformat() if exam.ends_at else None,
        "questions": [
            {
                "id": q.id,
                "type": q.type,
                "content": q.content,
                "options": q.options,
                "difficulty": q.difficulty,
                "order_index": q.order_index,
            }
            for q in questions
        ],
        "started_at": session.started_at.isoformat(),
    }


async def autosave_answers(
    db: AsyncSession,
    session_id: str,
    user_id: str,
    answers: dict,
) -> dict:
    """
    Persist the student's in-progress answers. Idempotent.
    answers: {question_id: selected_option_key}
    """
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found.")
    if session.submitted_at is not None:
        raise ValueError("Session already submitted.")

    session.answers = answers
    await db.commit()
    return {"session_id": session_id, "saved": True, "answer_count": len(answers)}


async def submit_and_grade(
    db: AsyncSession,
    session_id: str,
    user_id: str,
    answers: dict,
) -> dict:
    """
    Submit exam answers, grade them, persist results, and return full corrections.
    answers: {question_id: selected_option_key}
    """
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found.")
    if session.submitted_at is not None:
        raise ValueError("Session already submitted.")

    # Load questions
    q_result = await db.execute(
        select(Question)
        .where(Question.exam_id == session.exam_id)
        .order_by(Question.order_index)
    )
    questions = q_result.scalars().all()

    # Grade each question
    score = 0
    corrections = []
    for q in questions:
        student_answer = answers.get(q.id)
        is_correct = (
            student_answer is not None
            and student_answer.upper() == q.correct_answer.upper()
        )
        if is_correct:
            score += 1

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

    total = len(questions)
    percentage = round((score / total) * 100) if total > 0 else 0

    # Calculate time spent
    now = datetime.now(timezone.utc)
    started = session.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    time_spent_s = int((now - started).total_seconds())

    # Persist
    session.answers = answers
    session.score = score
    session.total = total
    session.submitted_at = now
    session.time_spent_s = time_spent_s
    await db.commit()

    return {
        "session_id": session_id,
        "score": score,
        "total": total,
        "percentage": percentage,
        "time_spent_s": time_spent_s,
        "corrections": corrections,
    }
