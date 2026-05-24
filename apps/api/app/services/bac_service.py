"""Bac preparation service — question extraction and AI grading."""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bac import BacPaper, BacQuestion, BacPracticeSession
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

_EXTRACT_SCHEMA = """[
  {
    "order_index": 1,
    "part_label": "Exercice 1",
    "type": "open_calculation",
    "content": "Exact question text with all notation",
    "options": null,
    "correct_answer": "Complete model answer with all steps",
    "explanation_fr": "Explication détaillée en français",
    "explanation_ar": "شرح مفصّل باللغة العربية",
    "rubric": [
      {
        "criteria": "Mise en place de la démarche",
        "max_points": 1.0,
        "description_fr": "L'étudiant établit correctement la formule",
        "description_ar": "يضع الطالب الصيغة بشكل صحيح"
      }
    ],
    "points": 4.0,
    "subject_area": "Fonctions dérivées"
  }
]"""

_GRADE_SCHEMA = """{
  "score": 2.5,
  "feedback_fr": "Feedback en français sur la réponse",
  "feedback_ar": "ملاحظات باللغة العربية حول الإجابة",
  "criteria_scores": [
    {"criteria": "Étape 1", "awarded": 1.0, "max": 1.0, "comment_fr": "Correct"}
  ]
}"""


async def extract_questions_from_paper(paper_id: str, text_content: str, db: AsyncSession) -> None:
    """Parse a Bac paper PDF text into structured questions using AI."""
    result = await db.execute(select(BacPaper).where(BacPaper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        logger.warning("BacPaper %s not found", paper_id)
        return

    paper.extraction_status = "extracting"
    await db.commit()

    try:
        prompt = f"""You are extracting questions from an official Moroccan Baccalauréat exam paper.

Paper details:
- Branch: {paper.branch}
- Subject: {paper.subject}
- Year: {paper.year}
- Session: {paper.session}
- Total points: {paper.total_points}

Extract EVERY question and sub-question from the paper below. For each item:
- Preserve the exact question text including any mathematical notation (LaTeX is fine)
- For open/calculation questions: provide a complete step-by-step model answer
- Build a detailed rubric with partial-credit criteria; criteria max_points must sum to question points
- Write explanations in both French and Arabic (MSA)
- Identify the specific concept/topic tested
- The sum of all question points MUST equal {paper.total_points}

For question types use only: mcq_single, open_calculation, essay, document_analysis, fill_blank

Paper content:
{text_content[:10000]}"""

        questions_data = await ai_service.generate_structured_json(
            prompt=prompt,
            schema_description=_EXTRACT_SCHEMA,
        )

        if not isinstance(questions_data, list):
            raise ValueError(f"Expected list, got {type(questions_data)}")

        # Wipe any previously extracted questions
        old_qs = (await db.execute(
            select(BacQuestion).where(BacQuestion.paper_id == paper_id)
        )).scalars().all()
        for q in old_qs:
            await db.delete(q)
        await db.flush()

        total_pts = 0.0
        for i, q_data in enumerate(questions_data):
            pts = float(q_data.get("points", 1.0))
            total_pts += pts
            q = BacQuestion(
                paper_id=paper_id,
                order_index=int(q_data.get("order_index", i + 1)),
                part_label=q_data.get("part_label"),
                type=q_data.get("type", "open_calculation"),
                content=str(q_data.get("content", "")),
                options=q_data.get("options"),
                correct_answer=str(q_data.get("correct_answer", "")),
                explanation_fr=str(q_data.get("explanation_fr", "")),
                explanation_ar=str(q_data.get("explanation_ar", "")),
                rubric=q_data.get("rubric"),
                points=pts,
                subject_area=q_data.get("subject_area"),
            )
            db.add(q)

        paper.extraction_status = "ready"
        paper.total_points = round(total_pts, 2) if total_pts > 0 else paper.total_points
        await db.commit()
        logger.info("Extracted %d questions for BacPaper %s", len(questions_data), paper_id)

    except Exception as exc:
        logger.exception("Question extraction failed for BacPaper %s: %s", paper_id, exc)
        paper.extraction_status = "error"
        await db.commit()


async def _grade_open(question: BacQuestion, student_answer: str) -> dict:
    """AI-grade a single open-ended Bac question against its rubric."""
    rubric_lines = ""
    if question.rubric and isinstance(question.rubric, list):
        rubric_lines = "\n".join(
            f"  • {c.get('criteria','')}: {c.get('max_points',0)} pts — {c.get('description_fr','')}"
            for c in question.rubric
        )

    prompt = f"""Grade this Moroccan Baccalauréat answer using the official rubric.
Apply the 0–20 Moroccan scale proportionally (points awarded / total ≤ question points).

Question ({question.points} pts):
{question.content}

Model answer:
{question.correct_answer}

Rubric (partial credit):
{rubric_lines or "Grade holistically based on correctness and reasoning."}

Student answer:
{student_answer.strip() if student_answer else "(no answer)"}

Award partial credit for correct steps. Be strict on numerical accuracy.
Return ONLY valid JSON — no markdown, no explanation."""

    try:
        result = await ai_service.generate_structured_json(
            prompt=prompt,
            schema_description=_GRADE_SCHEMA,
        )
        awarded = min(float(result.get("score", 0)), question.points)
        return {
            "score": round(awarded, 2),
            "max_points": question.points,
            "feedback_fr": str(result.get("feedback_fr", "")),
            "feedback_ar": str(result.get("feedback_ar", "")),
            "criteria_scores": result.get("criteria_scores", []),
            "correct_answer": question.correct_answer,
            "explanation_fr": question.explanation_fr,
            "explanation_ar": question.explanation_ar,
        }
    except Exception as exc:
        logger.warning("AI grading failed for question %s: %s", question.id, exc)
        return {
            "score": 0.0,
            "max_points": question.points,
            "feedback_fr": "Correction automatique indisponible.",
            "feedback_ar": "التصحيح التلقائي غير متاح.",
            "criteria_scores": [],
            "correct_answer": question.correct_answer,
            "explanation_fr": question.explanation_fr,
            "explanation_ar": question.explanation_ar,
        }


_AUTO_GRADE_TYPES = {"mcq_single", "true_false", "fill_blank"}


async def grade_session(session_id: str, db: AsyncSession) -> None:
    """Grade all answers in a BacPracticeSession and compute score /20."""
    sess_result = await db.execute(
        select(BacPracticeSession).where(BacPracticeSession.id == session_id)
    )
    session = sess_result.scalar_one_or_none()
    if not session or session.grading_status == "graded":
        return

    session.grading_status = "grading"
    await db.commit()

    try:
        questions = (await db.execute(
            select(BacQuestion)
            .where(BacQuestion.paper_id == session.paper_id)
            .order_by(BacQuestion.order_index)
        )).scalars().all()

        per_q: dict[str, dict] = {}
        total_earned = 0.0
        total_possible = sum(q.points for q in questions)

        for q in questions:
            answer = str((session.answers or {}).get(q.id, "")).strip()

            if q.type in _AUTO_GRADE_TYPES:
                correct = q.correct_answer.strip().upper()
                is_ok = answer.upper() == correct
                score = q.points if is_ok else 0.0
                per_q[q.id] = {
                    "score": score,
                    "max_points": q.points,
                    "feedback_fr": "Correct." if is_ok else f"Réponse incorrecte. Bonne réponse : {q.correct_answer}",
                    "feedback_ar": "صحيح." if is_ok else f"إجابة خاطئة. الإجابة الصحيحة: {q.correct_answer}",
                    "criteria_scores": [],
                    "correct_answer": q.correct_answer,
                    "explanation_fr": q.explanation_fr,
                    "explanation_ar": q.explanation_ar,
                }
            else:
                per_q[q.id] = await _grade_open(q, answer)

            total_earned += per_q[q.id]["score"]

        score_over_20 = round((total_earned / total_possible * 20) if total_possible > 0 else 0, 2)
        session.per_question_scores = per_q
        session.score_over_20 = score_over_20
        session.grading_status = "graded"
        await db.commit()
        logger.info("Session %s graded: %.2f/20", session_id, score_over_20)

    except Exception as exc:
        logger.exception("Grading failed for session %s: %s", session_id, exc)
        session.grading_status = "error"
        await db.commit()
