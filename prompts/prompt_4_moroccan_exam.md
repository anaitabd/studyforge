# StudyForge — Moroccan Exam System

## Context
You are adding a complete Moroccan curriculum exam system to StudyForge. The existing exam system only handles MCQ, true/false, and fill-blank with binary right/wrong scoring. Moroccan exams (1AC→3AC, Tronc Commun, 1BAC, 2BAC) require open calculations, essays, document analysis, geometric construction grading via photo, partial credit, and scores out of 20.

Read these files completely before writing anything:
```bash
cat backend/app/services/exam_service.py
cat backend/app/services/ai_service.py
cat backend/app/models/exam.py          # or wherever Exam/Question models live
cat backend/app/schemas/exam.py
cat backend/app/api/v1/exams.py
cat backend/app/services/vector_store.py
```

---

## Step 1 — Extend the Question model

Find the `questions` table model. The existing `type` field accepts:
`mcq_single | mcq_multiple | true_false | fill_blank`

Add these new values (do not remove existing ones):
- `open_calculation` — student types calculation steps + final answer
- `essay` — student writes a full paragraph/text response
- `construction_photo` — student uploads a photo of geometric construction
- `document_analysis` — student is shown a document and answers questions about it

Add these new columns to `questions` table via Alembic migration:

```sql
points          FLOAT   DEFAULT 1.0    -- point value for this question (used for /20 scoring)
rubric          JSONB   DEFAULT NULL   -- grading rubric for open questions
subject_area    TEXT    DEFAULT NULL   -- 'math' | 'french' | 'arabic' | 'sciences' | 'histoire_geo' | 'physique'
construction_steps JSONB DEFAULT NULL -- for construction_photo: list of expected steps
```

Add to `exams` table:
```sql
total_points    FLOAT   DEFAULT 20.0  -- always 20 for Moroccan exams
subject_area    TEXT    DEFAULT NULL
level           TEXT    DEFAULT NULL  -- '1AC' | '2AC' | '3AC' | 'TC' | '1BAC' | '2BAC'
grading_mode    TEXT    DEFAULT 'auto' -- 'auto' | 'rubric' | 'manual'
```

Add to `exam_sessions` table:
```sql
score_over_20   FLOAT   DEFAULT NULL  -- the /20 score, computed after grading
per_question_scores JSONB DEFAULT NULL -- {question_id: {score, max, feedback}}
grading_status  TEXT    DEFAULT 'pending' -- 'pending' | 'graded' | 'partial'
```

Create the Alembic migration. Run it.

---

## Step 2 — Subject detection helper

Create `backend/app/services/curriculum_service.py`:

```python
"""
Moroccan curriculum awareness.
Detects subject area and level from file content or explicit params.
"""

SUBJECT_KEYWORDS = {
    "math": [
        "triangle", "polygone", "fraction", "équation", "algèbre", "géométrie",
        "volume", "aire", "périmètre", "proportionnalité", "statistiques",
        "probabilité", "fonction", "repère", "vecteur", "théorème"
    ],
    "french": [
        "texte", "paragraphe", "expression écrite", "compréhension", "lecture",
        "narration", "description", "argumentation", "connecteurs", "conjugaison",
        "grammaire", "orthographe", "vocabulaire", "style"
    ],
    "arabic": [
        "نص", "فقرة", "تعبير", "قراءة", "إنتاج", "سرد", "وصف", "حجاج",
        "نحو", "صرف", "إملاء", "معجم", "أسلوب"
    ],
    "sciences": [
        "cellule", "organisme", "photosynthèse", "respiration", "nutrition",
        "reproduction", "écosystème", "biodiversité", "ADN", "génétique"
    ],
    "physique": [
        "force", "vitesse", "énergie", "électricité", "circuit", "tension",
        "courant", "optique", "lumière", "chaleur", "réaction chimique"
    ],
    "histoire_geo": [
        "carte", "document", "époque", "civilisation", "guerre", "économie",
        "population", "territoire", "relief", "climat", "ressources"
    ],
}

LEVEL_KEYWORDS = {
    "1AC": ["1ac", "première année", "sixième"],
    "2AC": ["2ac", "deuxième année", "cinquième"],
    "3AC": ["3ac", "troisième année", "quatrième", "brevet"],
    "TC":  ["tronc commun", "tc", "première bac"],
    "1BAC": ["1bac", "première baccalauréat"],
    "2BAC": ["2bac", "terminale", "baccalauréat", "bachibac"],
}

QUESTION_TYPES_BY_SUBJECT = {
    "math": ["open_calculation", "fill_blank", "mcq_single", "construction_photo"],
    "french": ["essay", "fill_blank", "mcq_single", "document_analysis"],
    "arabic": ["essay", "fill_blank", "mcq_single", "document_analysis"],
    "sciences": ["mcq_single", "fill_blank", "document_analysis", "open_calculation"],
    "physique": ["open_calculation", "fill_blank", "mcq_single"],
    "histoire_geo": ["document_analysis", "essay", "mcq_single", "fill_blank"],
}

DEFAULT_POINT_DISTRIBUTION = {
    # question_type → typical points in a /20 exam
    "essay": 8.0,
    "document_analysis": 6.0,
    "open_calculation": 4.0,
    "construction_photo": 3.0,
    "fill_blank": 1.0,
    "mcq_single": 1.0,
    "mcq_multiple": 1.0,
    "true_false": 0.5,
}


def detect_subject(text: str) -> str:
    """Detect subject area from document text. Returns subject key or 'general'."""
    text_lower = text.lower()
    scores = {}
    for subject, keywords in SUBJECT_KEYWORDS.items():
        scores[subject] = sum(1 for kw in keywords if kw in text_lower)
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "general"


def detect_level(text: str) -> str | None:
    """Detect curriculum level from document text."""
    text_lower = text.lower()
    for level, keywords in LEVEL_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return level
    return None


def get_question_types_for_subject(subject: str) -> list[str]:
    return QUESTION_TYPES_BY_SUBJECT.get(subject, ["mcq_single", "fill_blank", "open_calculation"])


def distribute_points(questions: list[dict], total: float = 20.0) -> list[dict]:
    """
    Assign point values to questions so they sum to total (default 20).
    Respects DEFAULT_POINT_DISTRIBUTION weights.
    """
    if not questions:
        return questions

    raw_weights = [DEFAULT_POINT_DISTRIBUTION.get(q.get("type", "mcq_single"), 1.0) for q in questions]
    total_weight = sum(raw_weights)
    scale = total / total_weight

    result = []
    assigned = 0.0
    for i, (q, w) in enumerate(zip(questions, raw_weights)):
        if i == len(questions) - 1:
            pts = round(total - assigned, 2)
        else:
            pts = round(w * scale * 2) / 2  # round to nearest 0.5
            assigned += pts
        result.append({**q, "points": pts})
    return result
```

---

## Step 3 — Exam generation prompt extensions

Open `backend/app/services/exam_service.py`. Find the generation prompt(s). Add these new type-specific prompt builders alongside the existing ones:

### open_calculation prompt
```python
def _build_calculation_prompt(
    context: str, count: int, difficulty: str, subject: str, language: str
) -> str:
    lang = _LANG_INSTRUCTION[language]
    return (
        f"Generate {count} open-ended calculation questions for a Moroccan {subject} exam.\n\n"
        f"Difficulty: {difficulty}. {lang}\n\n"
        "For each question, provide:\n"
        '- "question": the problem statement (include all given values, units, and what to find)\n'
        '- "solution_steps": array of strings, each being one calculation step written out\n'
        '- "final_answer": the exact expected final answer with correct unit\n'
        '- "partial_credit_rules": array of objects {step_description, points} '
        "showing how to award partial credit if a step is correct but later steps are wrong\n"
        '- "difficulty": the difficulty level\n'
        '- "topic": the specific math/science topic this question tests\n\n'
        "Rules:\n"
        "- Each question must be solvable in 3-6 steps maximum\n"
        "- All values must be realistic (not abstract like 'x=100000')\n"
        "- partial_credit_rules must cover every step separately\n"
        "- Do NOT generate questions requiring a geometric drawing to answer\n\n"
        f"COURSE MATERIAL:\n{context}"
    )

_CALCULATION_SCHEMA = (
    "Array of objects, each with: question (string), solution_steps (array of strings), "
    "final_answer (string), partial_credit_rules (array of {step_description: string, points: number}), "
    "difficulty (string), topic (string)"
)
```

### essay prompt
```python
ESSAY_RUBRIC_CATEGORIES = {
    "french": [
        {"category": "compréhension_et_plan", "max_points": 4,
         "description": "Does the essay respect the subject and follow a logical plan (introduction, body, conclusion)?"},
        {"category": "organisation_et_cohérence", "max_points": 4,
         "description": "Are ideas well organized? Are transitions and connectors used correctly?"},
        {"category": "arguments_et_exemples", "max_points": 4,
         "description": "Are arguments relevant and supported by concrete examples?"},
        {"category": "langue_et_grammaire", "max_points": 4,
         "description": "Is grammar correct? Is spelling correct?"},
        {"category": "vocabulaire_et_style", "max_points": 4,
         "description": "Is vocabulary rich and appropriate? Is the style appropriate for the register?"},
    ],
    "arabic": [
        {"category": "الفهم_والخطة", "max_points": 4,
         "description": "هل يحترم المنتج الموضوع ويتبع خطة منطقية؟"},
        {"category": "التنظيم_والتماسك", "max_points": 4,
         "description": "هل الأفكار منظمة جيداً؟ هل تُستخدم الروابط بشكل صحيح؟"},
        {"category": "الحجج_والأمثلة", "max_points": 4,
         "description": "هل الحجج وثيقة الصلة ومدعومة بأمثلة ملموسة؟"},
        {"category": "اللغة_والنحو", "max_points": 4,
         "description": "هل القواعد صحيحة؟ هل الإملاء سليم؟"},
        {"category": "المعجم_والأسلوب", "max_points": 4,
         "description": "هل المعجم غني ومناسب؟ هل الأسلوب ملائم؟"},
    ],
    "general": [
        {"category": "content_relevance", "max_points": 5,
         "description": "Does the response address the question fully and accurately?"},
        {"category": "organization", "max_points": 5,
         "description": "Is the response well structured with clear progression?"},
        {"category": "argumentation", "max_points": 5,
         "description": "Are claims supported with evidence, examples, or reasoning?"},
        {"category": "language_quality", "max_points": 5,
         "description": "Is language clear, grammatically correct, and appropriate?"},
    ],
}

def _build_essay_question_prompt(context: str, count: int, subject: str, level: str, language: str) -> str:
    lang = _LANG_INSTRUCTION[language]
    rubric = ESSAY_RUBRIC_CATEGORIES.get(subject, ESSAY_RUBRIC_CATEGORIES["general"])
    rubric_text = "\n".join(
        f"  - {r['category']} ({r['max_points']} pts): {r['description']}"
        for r in rubric
    )
    return (
        f"Generate {count} essay question(s) for a Moroccan {subject} exam, level {level}.\n"
        f"{lang}\n\n"
        "For each question provide:\n"
        '- "question": the essay prompt/subject\n'
        '- "word_count_guide": recommended word count (e.g. "150-200 mots")\n'
        '- "rubric": the grading rubric (use the categories below exactly)\n'
        '- "model_answer_outline": a bullet-point outline of what a strong answer would include\n\n'
        f"Grading rubric categories to use (total = 20 points):\n{rubric_text}\n\n"
        "Rules:\n"
        "- Essay question must be open enough for multiple valid approaches\n"
        "- model_answer_outline must have 5-8 bullet points, not a full essay\n"
        "- The question must relate to the course material provided\n\n"
        f"COURSE MATERIAL:\n{context}"
    )
```

### document_analysis prompt
```python
def _build_document_analysis_prompt(
    context: str, count: int, subject: str, language: str
) -> str:
    lang = _LANG_INSTRUCTION[language]
    return (
        f"Generate {count} document analysis question set(s) for a Moroccan {subject} exam.\n"
        f"{lang}\n\n"
        "A document analysis question set presents a document (text, table, or description of a map/chart) "
        "and asks 3-5 sub-questions about it.\n\n"
        "For each question set provide:\n"
        '- "document_text": the document to analyze (excerpt or full text from the course material)\n'
        '- "document_type": "text" | "table" | "chart_description" | "map_description"\n'
        '- "sub_questions": array of sub-questions, each with:\n'
        '    - "question": the question about the document\n'
        '    - "expected_answer": what a correct answer must include\n'
        '    - "points": point value (all sub_questions.points must sum to a round number)\n'
        '    - "answer_type": "short" | "list" | "calculation"\n\n'
        "Rules:\n"
        "- Document must come from the provided course material, not invented\n"
        "- Sub-questions must progress from simpler (locate information) to complex (interpret, evaluate)\n"
        "- Total points across sub-questions must sum to 6 or 8\n\n"
        f"COURSE MATERIAL:\n{context}"
    )
```

### construction_photo prompt (question generation only — grading is separate)
```python
def _build_construction_prompt(
    context: str, count: int, language: str
) -> str:
    lang = _LANG_INSTRUCTION[language]
    return (
        f"Generate {count} geometric construction question(s) for a Moroccan math exam.\n"
        f"{lang}\n\n"
        "For each question provide:\n"
        '- "question": the construction task instruction (e.g. "Construire la médiatrice du segment AB")\n'
        '- "given_elements": what is already provided on the figure (e.g. "Segment AB de 6 cm")\n'
        '- "construction_steps": ordered array of steps the student must perform, each with:\n'
        '    - "step_number": 1, 2, 3...\n'
        '    - "description": what the student must draw/mark\n'
        '    - "verification_clue": what to look for in the photo to confirm this step was done\n'
        '    - "points": point value for this step\n'
        '- "total_points": sum of all step points (must be 2, 3, or 4)\n\n'
        "Rules:\n"
        "- Steps must be compass-and-ruler constructible (no protractor unless specified)\n"
        "- verification_clue must describe what is visually visible in a photo of the work\n"
        "- Steps must be in the correct logical order\n"
        "- Only generate constructions mentioned or illustrated in the provided material\n\n"
        f"COURSE MATERIAL:\n{context}"
    )
```

---

## Step 4 — Essay grading engine

Create `backend/app/services/grading_service.py`:

```python
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
```

---

## Step 5 — Wire grading into exam submission endpoint

Open `backend/app/api/v1/exams.py`. Find the exam session submission endpoint (`PUT .../sessions/{session_id}`).

The current endpoint accepts `answers` as a dict and computes a simple score. Extend it:

```python
# In the submission endpoint, after saving answers to DB:

from app.services.grading_service import (
    grade_open_calculation,
    grade_essay,
    grade_document_analysis,
    grade_construction_photo,
)
from app.services.curriculum_service import distribute_points

# Grade each question based on its type
per_question_scores = {}
total_earned = 0.0
total_max = 0.0

for question in exam.questions:
    q_id = str(question.id)
    student_answer = session.answers.get(q_id, {})
    max_pts = float(question.points or 1.0)
    total_max += max_pts

    if question.type in ("mcq_single", "mcq_multiple", "true_false", "fill_blank"):
        # Existing grading logic — keep as-is, just wrap result
        existing_result = _grade_objective_question(question, student_answer)
        grade_result = {
            "score": existing_result["score"] * max_pts,
            "max_points": max_pts,
            "feedback": existing_result.get("feedback", ""),
        }

    elif question.type == "open_calculation":
        grade_result = await grade_open_calculation(
            question=question.rubric or {},
            student_answer=student_answer.get("text", ""),
            max_points=max_pts,
        )

    elif question.type == "essay":
        grade_result = await grade_essay(
            question=question.rubric or {},
            student_essay=student_answer.get("text", ""),
            max_points=max_pts,
            subject=exam.subject_area or "general",
        )

    elif question.type == "document_analysis":
        grade_result = await grade_document_analysis(
            question=question.rubric or {},
            student_answers=student_answer.get("sub_answers", {}),
            max_points=max_pts,
        )

    elif question.type == "construction_photo":
        image_b64 = student_answer.get("image_b64", "")
        if image_b64:
            grade_result = await grade_construction_photo(
                question=question.rubric or {},
                image_b64=image_b64,
            )
        else:
            grade_result = {
                "score": 0,
                "max_points": max_pts,
                "feedback": "No photo submitted for this construction question.",
            }
    else:
        grade_result = {"score": 0, "max_points": max_pts, "feedback": "Unknown question type."}

    per_question_scores[q_id] = grade_result
    total_earned += grade_result["score"]

# Update session with /20 score
score_over_20 = round((total_earned / total_max) * 20, 2) if total_max > 0 else 0.0

session.score = total_earned
session.total = total_max
session.score_over_20 = score_over_20
session.per_question_scores = per_question_scores
session.grading_status = "graded"
session.submitted_at = datetime.utcnow()

await db.commit()
```

---

## Step 6 — Image upload for construction answers

The student must be able to upload a photo for `construction_photo` questions. Add a new endpoint:

```
POST /api/v1/groups/{group_id}/exams/{exam_id}/sessions/{session_id}/answers/{question_id}/photo
```

This endpoint:
1. Accepts `multipart/form-data` with a single image file (JPEG or PNG, max 10MB)
2. Validates MIME type
3. Converts to base64 in memory (do NOT store in S3 — it's temporary for grading only)
4. Stores base64 in `exam_sessions.answers` under `{question_id: {image_b64: "..."}}`
5. Returns `{"status": "uploaded", "question_id": question_id}`

```python
@router.post("/{group_id}/exams/{exam_id}/sessions/{session_id}/answers/{question_id}/photo")
async def upload_construction_photo(
    group_id: str,
    exam_id: str,
    session_id: str,
    question_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Only JPEG, PNG, or WebP images are accepted.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(400, "Image must be under 10MB.")

    import base64
    image_b64 = base64.b64encode(contents).decode("utf-8")

    # Load session, update answers dict
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found.")

    answers = session.answers or {}
    answers[question_id] = {
        **answers.get(question_id, {}),
        "image_b64": image_b64,
        "media_type": file.content_type,
    }
    session.answers = answers
    await db.commit()

    return {"status": "uploaded", "question_id": question_id}
```

---

## Step 7 — Update exam generation endpoint

Find `POST /groups/{id}/exams/generate`. Extend it to:
1. Accept `subject_area` and `level` as optional parameters
2. If not provided, detect them from file content using `curriculum_service.detect_subject()` and `detect_level()`
3. Accept `question_types` as optional list. If not provided, use `curriculum_service.get_question_types_for_subject()`
4. After generating all questions, call `distribute_points(questions, total=20.0)` to assign /20 point values
5. Store `subject_area`, `level`, and `total_points=20.0` on the `Exam` row

Updated request schema:
```python
class GenerateExamRequest(BaseModel):
    file_ids: list[str] | None = None
    question_count: int = 10
    difficulty: str = "mixed"         # easy | medium | hard | mixed
    question_types: list[str] | None = None  # if None, auto-detected from subject
    subject_area: str | None = None   # if None, auto-detected from files
    level: str | None = None          # if None, auto-detected from files
    language: str = "auto"
    title: str | None = None
```

---

## Step 8 — Results endpoint extension

Find `GET .../sessions/{session_id}/results`. Extend the response to include:

```json
{
  "session_id": "...",
  "score_over_20": 14.5,
  "score_raw": 14.5,
  "total_raw": 20.0,
  "percentage": 72.5,
  "passed": true,
  "grading_status": "graded",
  "questions": [
    {
      "id": "...",
      "type": "open_calculation",
      "question": "...",
      "points_earned": 3.5,
      "points_max": 4.0,
      "feedback": "...",
      "step_scores": [...],
      "correct_answer": "..."
    },
    {
      "id": "...",
      "type": "essay",
      "question": "...",
      "points_earned": 12.0,
      "points_max": 16.0,
      "category_scores": [...],
      "overall_feedback": "...",
      "top_corrections": ["...", "...", "..."],
      "strengths": "..."
    }
  ],
  "ai_summary": "...",
  "weak_areas": ["..."],
  "study_recommendations": ["..."]
}
```

The `ai_summary` and `study_recommendations` are generated by one final call to `generate_structured_json` after all individual grades are computed, summarizing the student's overall performance and recommending what to study.

Moroccan passing threshold: `score_over_20 >= 10.0` → `"passed": true`.

---

## Step 9 — Verification

```bash
# 1. Migration runs clean
alembic upgrade head

# 2. Import check
python -c "from app.services.grading_service import grade_essay; from app.services.curriculum_service import detect_subject; print('OK')"

# 3. Subject detection works
python -c "
from app.services.curriculum_service import detect_subject, detect_level
print(detect_subject('triangle polygone géométrie aire'))   # should print: math
print(detect_subject('texte expression écrite grammaire'))  # should print: french
print(detect_level('1AC première année collège'))           # should print: 1AC
"

# 4. Point distribution sums to 20
python -c "
from app.services.curriculum_service import distribute_points
qs = [{'type': 'essay'}, {'type': 'open_calculation'}, {'type': 'fill_blank'}, {'type': 'fill_blank'}]
result = distribute_points(qs, 20.0)
total = sum(q['points'] for q in result)
print(f'Total: {total}')  # must be 20.0
assert total == 20.0, f'Expected 20.0, got {total}'
print('PASS')
"
```

---

## Rules
- Do not remove existing question types (mcq_single, mcq_multiple, true_false, fill_blank)
- Do not change existing binary grading for objective questions
- The `score_over_20` field is additive — existing sessions without it return null, not 0
- `grade_essay` and `grade_open_calculation` must never throw — always return a dict with at least {score, max_points, feedback}
- Construction photo base64 is stored in session.answers only — never written to S3
