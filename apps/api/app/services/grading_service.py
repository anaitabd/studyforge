"""
Moroccan exam grading engine.
Handles open_calculation, essay, document_analysis, and construction_photo grading.
Existing MCQ/true_false/fill_blank grading stays in exam_service.py.
"""
import logging
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)


async def grade_open_calculation(
    question: dict,
    student_answer: str,
    max_points: float,
) -> dict:
    """
    Grade an open calculation answer with partial credit.
    Returns {score, max_points, feedback, step_scores}.
    """
    solution_steps = question.get("solution_steps", [])
    final_answer = question.get("final_answer", "")
    partial_rules = question.get("partial_credit_rules", [])

    prompt = (
        f"You are grading a Moroccan math exam. Grade this student's calculation answer.\n\n"
        f"QUESTION: {question.get('question', '')}\n\n"
        f"EXPECTED SOLUTION STEPS:\n"
        + "\n".join(f"  {i+1}. {s}" for i, s in enumerate(solution_steps))
        + f"\n\nEXPECTED FINAL ANSWER: {final_answer}\n\n"
        f"PARTIAL CREDIT RULES:\n"
        + "\n".join(f"  - {r['step_description']}: {r['points']} pts" for r in partial_rules)
        + f"\n\nMAXIMUM POINTS: {max_points}\n\n"
        f"STUDENT ANSWER:\n{student_answer}\n\n"
        "Evaluate the student's answer. For each partial credit rule, determine if the student "
        "performed that step correctly (even if later steps have errors).\n\n"
        "Return a JSON object with:\n"
        '- "total_score": number (the points earned, never exceeding max_points)\n'
        '- "step_scores": array of {step_description, earned, max, correct: bool}\n'
        '- "final_answer_correct": bool\n'
        '- "feedback": 2-3 sentences explaining what was right, what was wrong, '
        'and the correct approach for any wrong steps\n'
        '- "common_error": one-sentence description of the main mistake if any\n'
    )

    result = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description=(
            "object with: total_score (number), step_scores (array of {step_description, earned, max, correct}), "
            "final_answer_correct (bool), feedback (string), common_error (string or null)"
        ),
        max_tokens=1000,
    )

    if not isinstance(result, dict):
        return {"score": 0, "max_points": max_points, "feedback": "Grading error.", "step_scores": []}

    score = min(float(result.get("total_score", 0)), max_points)
    return {
        "score": score,
        "max_points": max_points,
        "feedback": result.get("feedback", ""),
        "common_error": result.get("common_error"),
        "step_scores": result.get("step_scores", []),
        "final_answer_correct": result.get("final_answer_correct", False),
    }


async def grade_essay(
    question: dict,
    student_essay: str,
    max_points: float = 20.0,
    subject: str = "general",
) -> dict:
    """
    Grade an essay using the Moroccan rubric system.
    Returns {score, max_points, category_scores, feedback, corrections}.
    """
    rubric = question.get("rubric", [])
    model_outline = question.get("model_answer_outline", [])

    if not rubric:
        # Fallback: use general rubric
        from app.services.curriculum_service import ESSAY_RUBRIC_CATEGORIES
        rubric = ESSAY_RUBRIC_CATEGORIES.get(subject, ESSAY_RUBRIC_CATEGORIES["general"])

    rubric_text = "\n".join(
        f"  - {r['category']} (max {r['max_points']} pts): {r['description']}"
        for r in rubric
    )
    outline_text = "\n".join(f"  - {point}" for point in model_outline) if model_outline else "Not provided"

    prompt = (
        f"You are a Moroccan {subject} teacher grading a student essay. "
        f"Be fair but rigorous. The exam is out of {max_points} points.\n\n"
        f"ESSAY QUESTION: {question.get('question', '')}\n\n"
        f"STRONG ANSWER OUTLINE (reference only):\n{outline_text}\n\n"
        f"GRADING RUBRIC:\n{rubric_text}\n\n"
        f"STUDENT ESSAY:\n{student_essay}\n\n"
        "Grade the essay on each rubric category independently. Then provide:\n"
        '- "category_scores": array of {category, score, max_points, justification}\n'
        '- "total_score": sum of all category scores\n'
        '- "overall_feedback": 2-3 sentences of overall assessment\n'
        '- "top_corrections": array of exactly 3 specific corrections the student should make '
        "(grammar, argument, structure — be very specific, quote the student's text when relevant)\n"
        '- "strengths": one sentence on what the student did well\n'
    )

    result = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description=(
            "object with: category_scores (array of {category, score, max_points, justification}), "
            "total_score (number), overall_feedback (string), top_corrections (array of strings), "
            "strengths (string)"
        ),
        max_tokens=1500,
    )

    if not isinstance(result, dict):
        return {"score": 0, "max_points": max_points, "feedback": "Grading error.", "category_scores": []}

    score = min(float(result.get("total_score", 0)), max_points)
    return {
        "score": score,
        "max_points": max_points,
        "category_scores": result.get("category_scores", []),
        "overall_feedback": result.get("overall_feedback", ""),
        "top_corrections": result.get("top_corrections", []),
        "strengths": result.get("strengths", ""),
    }


async def grade_document_analysis(
    question: dict,
    student_answers: dict,  # {sub_question_index: answer_text}
    max_points: float,
) -> dict:
    """
    Grade a document analysis question set.
    student_answers: dict mapping sub-question index (str) to the student's answer.
    """
    sub_questions = question.get("sub_questions", [])
    document_text = question.get("document_text", "")

    prompt = (
        f"You are grading a Moroccan exam document analysis question.\n\n"
        f"DOCUMENT:\n{document_text}\n\n"
        "SUB-QUESTIONS AND EXPECTED ANSWERS:\n"
    )
    for i, sq in enumerate(sub_questions):
        prompt += (
            f"\n{i+1}. Question: {sq['question']}\n"
            f"   Expected: {sq['expected_answer']}\n"
            f"   Points: {sq['points']}\n"
            f"   Student answered: {student_answers.get(str(i), student_answers.get(i, '(no answer)'))}\n"
        )

    prompt += (
        f"\n\nGrade each sub-question. A correct answer must cover the key points in 'Expected'. "
        "Partial credit is allowed.\n\n"
        "Return:\n"
        '- "sub_scores": array of {question_index, score, max_points, correct, feedback}\n'
        '- "total_score": sum of all sub_scores\n'
        '- "overall_feedback": one sentence\n'
    )

    result = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description=(
            "object with: sub_scores (array of {question_index, score, max_points, correct, feedback}), "
            "total_score (number), overall_feedback (string)"
        ),
        max_tokens=1200,
    )

    if not isinstance(result, dict):
        return {"score": 0, "max_points": max_points, "feedback": "Grading error."}

    score = min(float(result.get("total_score", 0)), max_points)
    return {
        "score": score,
        "max_points": max_points,
        "sub_scores": result.get("sub_scores", []),
        "overall_feedback": result.get("overall_feedback", ""),
    }


async def grade_construction_photo(
    question: dict,
    image_b64: str,
    media_type: str = "image/jpeg",
) -> dict:
    """
    Grade a geometric construction by vision-analyzing a student's photo.
    """
    construction_steps = question.get("construction_steps", [])
    total_points = question.get("total_points", 3.0)

    steps_text = "\n".join(
        f"  Step {s['step_number']}: {s['description']} "
        f"(Look for: {s['verification_clue']}) — {s['points']} pts"
        for s in construction_steps
    )

    vision_prompt = (
        f"You are grading a Moroccan math exam. The student was asked to: {question.get('question', '')}\n\n"
        f"REQUIRED CONSTRUCTION STEPS:\n{steps_text}\n\n"
        "Look at the student's photo carefully. For each step, determine if it was performed correctly "
        "based on the verification clue.\n\n"
        "Return a JSON object with:\n"
        '- "step_results": array of {step_number, description, found: bool, score, max_points, observation}\n'
        "  observation = what you actually see in the photo for this step\n"
        '- "total_score": sum of earned points\n'
        '- "feedback": 2 sentences describing what was done correctly and what is missing\n'
        '- "photo_quality": "clear" | "blurry" | "incomplete" — describe the photo quality\n'
    )

    description = await ai_service.describe_image(
        image_b64=image_b64,
        media_type=media_type,
        prompt=vision_prompt,
    )

    # Parse the JSON from the vision response
    import json, re
    try:
        json_match = re.search(r'\{.*\}', description, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError("No JSON in vision response")
    except Exception as e:
        logger.warning(f"Construction grading parse error: {e}")
        return {
            "score": 0,
            "max_points": total_points,
            "feedback": "Could not analyze the photo. Please ensure the image is clear and shows the full construction.",
            "photo_quality": "unclear",
            "step_results": [],
        }

    score = min(float(result.get("total_score", 0)), total_points)
    return {
        "score": score,
        "max_points": total_points,
        "step_results": result.get("step_results", []),
        "feedback": result.get("feedback", ""),
        "photo_quality": result.get("photo_quality", "unknown"),
    }
