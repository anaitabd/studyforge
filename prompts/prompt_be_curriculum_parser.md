# StudyForge — Moroccan Exam Parser + Full Curriculum Support

## What this prompt builds

1. A parser that understands Moroccan exam documents ("Devoir Surveillé",
   "Devoir de Contrôle", "Baccalauréat") and extracts their structure.
2. Expanded curriculum_service covering every level and branch.
3. Math/science document handling with LaTeX formula detection.

---

## Step 0 — Read first

```bash
cat apps/api/app/services/curriculum_service.py
cat apps/api/app/services/exam_service.py
cat apps/api/app/services/file_processor.py
cat apps/api/app/services/ai_service.py
```

---

## Step 1 — Expand curriculum_service.py

Replace the existing `SUBJECT_KEYWORDS`, `LEVEL_KEYWORDS`, and
`QUESTION_TYPES_BY_SUBJECT` with the complete Moroccan curriculum map.

Add to `apps/api/app/services/curriculum_service.py`:

```python
# ── Moroccan school system ─────────────────────────────────────────────────────

MOROCCAN_LEVELS = {
    # Collège (middle school)
    "1AC": {
        "label": "1ère Année Collège",
        "cycle": "college",
        "subjects": ["math", "french", "arabic", "sciences", "histoire_geo", "physique"],
    },
    "2AC": {
        "label": "2ème Année Collège",
        "cycle": "college",
        "subjects": ["math", "french", "arabic", "sciences", "histoire_geo", "physique"],
    },
    "3AC": {
        "label": "3ème Année Collège — Brevet",
        "cycle": "college",
        "subjects": ["math", "french", "arabic", "sciences", "histoire_geo", "physique"],
        "high_stakes": True,
    },
    # Lycée — Tronc Commun
    "TC_S": {
        "label": "Tronc Commun Sciences",
        "cycle": "lycee",
        "branch": "sciences",
        "subjects": ["math", "physique", "sciences_vie", "french", "arabic"],
    },
    "TC_L": {
        "label": "Tronc Commun Lettres",
        "cycle": "lycee",
        "branch": "lettres",
        "subjects": ["french", "arabic", "histoire_geo", "philosophie"],
    },
    "TC_O": {
        "label": "Tronc Commun Original",
        "cycle": "lycee",
        "branch": "original",
        "subjects": ["arabic", "histoire_geo", "math"],
    },
    # 1BAC
    "1BAC_SE": {
        "label": "1ère Bac Sciences Expérimentales",
        "cycle": "lycee",
        "branch": "sciences_exp",
        "subjects": ["math", "physique_chimie", "sciences_vie_terre", "french", "arabic"],
    },
    "1BAC_SM": {
        "label": "1ère Bac Sciences Math",
        "cycle": "lycee",
        "branch": "sciences_math",
        "subjects": ["math", "physique_chimie", "french", "arabic"],
    },
    "1BAC_SEG": {
        "label": "1ère Bac Sciences Économiques et Gestion",
        "cycle": "lycee",
        "branch": "seg",
        "subjects": ["math", "économie_gestion", "french", "arabic", "histoire_geo"],
    },
    "1BAC_L": {
        "label": "1ère Bac Lettres",
        "cycle": "lycee",
        "branch": "lettres",
        "subjects": ["french", "arabic", "histoire_geo", "philosophie"],
    },
    # 2BAC — the most important level
    "2BAC_SE": {
        "label": "2ème Bac Sciences Expérimentales",
        "cycle": "lycee",
        "branch": "sciences_exp",
        "subjects": ["math", "physique_chimie", "sciences_vie_terre", "french", "arabic"],
        "high_stakes": True,
    },
    "2BAC_SM_A": {
        "label": "2ème Bac Sciences Math A",
        "cycle": "lycee",
        "branch": "sciences_math",
        "subjects": ["math", "physique_chimie", "informatique", "french", "arabic"],
        "high_stakes": True,
    },
    "2BAC_SM_B": {
        "label": "2ème Bac Sciences Math B",
        "cycle": "lycee",
        "branch": "sciences_math",
        "subjects": ["math", "physique_chimie", "french", "arabic"],
        "high_stakes": True,
    },
    "2BAC_SEG": {
        "label": "2ème Bac Sciences Économiques et Gestion",
        "cycle": "lycee",
        "branch": "seg",
        "subjects": ["math", "économie_gestion", "comptabilité", "droit", "french", "arabic"],
        "high_stakes": True,
    },
    "2BAC_SH": {
        "label": "2ème Bac Sciences Humaines",
        "cycle": "lycee",
        "branch": "sciences_humaines",
        "subjects": ["histoire_geo", "philosophie", "french", "arabic", "économie"],
        "high_stakes": True,
    },
    "2BAC_L": {
        "label": "2ème Bac Lettres",
        "cycle": "lycee",
        "branch": "lettres",
        "subjects": ["french", "arabic", "histoire_geo", "philosophie"],
        "high_stakes": True,
    },
}

# Exam types by Moroccan naming convention
MOROCCAN_EXAM_TYPES = {
    "DS": "Devoir Surveillé",      # in-class test (1-2h)
    "DC": "Devoir de Contrôle",    # controlled homework
    "DM": "Devoir Maison",         # take-home
    "DP": "Devoir de Période",     # end of period assessment
    "BAC": "Baccalauréat",         # national exam
    "REGIONAL": "Examen Régional", # regional exam
    "NATIONAL": "Examen National", # national standardized
}

# Math topics by level (for curriculum-aware question generation)
MATH_TOPICS = {
    "1AC": ["nombres_entiers", "fractions", "decimaux", "proportionnalite", "geometrie_plane"],
    "2AC": ["racines_carrees", "equations", "inegalites", "geometrie_espace", "statistiques"],
    "3AC": ["pythagorle_thales", "trigonometrie", "systemes_equations", "probabilites_bases"],
    "TC_S": ["fonctions", "suites", "trigonometrie_avancee", "geometrie_analytique"],
    "1BAC_SE": ["derivation", "integration_bases", "probabilites", "statistiques_avancees"],
    "1BAC_SM": ["derivation", "integration", "complexes_intro", "suites"],
    "1BAC_SEG": ["suites", "probabilites", "statistiques", "fonctions_economiques"],
    "2BAC_SE": ["integration", "equations_differentielles", "probabilites_conditionnelles", "complexes"],
    "2BAC_SM_A": ["integration_avancee", "complexes", "equations_differentielles", "geometrie_espace"],
    "2BAC_SEG": ["suites_financieres", "probabilites_variables_aleatoires", "statistiques_inferentielles"],
    "2BAC_SH": ["statistiques_descriptives", "probabilites_bases", "suites_arithmetiques"],
}

# Point distribution by exam type
EXAM_POINT_DISTRIBUTION = {
    "DS": 20.0,
    "DC": 20.0,
    "DM": 20.0,
    "DP": 20.0,
    "BAC": 20.0,
}


def get_level_info(level: str) -> dict:
    """Get full info for a Moroccan curriculum level."""
    return MOROCCAN_LEVELS.get(level, {})


def get_math_topics(level: str) -> list[str]:
    """Get math topics for a specific level."""
    return MATH_TOPICS.get(level, [])


def is_high_stakes(level: str) -> bool:
    """True for 3AC (Brevet) and 2BAC (Baccalauréat) levels."""
    return MOROCCAN_LEVELS.get(level, {}).get("high_stakes", False)


def detect_exam_type(text: str) -> str | None:
    """Detect the type of Moroccan exam from document text."""
    text_upper = text.upper()
    if "BACCALAURÉAT" in text_upper or "BAC" in text_upper:
        return "BAC"
    if "DEVOIR SURVEILLÉ" in text_upper or "DEVOIR SURVEILLE" in text_upper:
        return "DS"
    if "DEVOIR DE CONTRÔLE" in text_upper or "DEVOIR DE CONTROLE" in text_upper:
        return "DC"
    if "DEVOIR MAISON" in text_upper:
        return "DM"
    if "EXAMEN RÉGIONAL" in text_upper or "EXAMEN REGIONAL" in text_upper:
        return "REGIONAL"
    return None


def detect_branch(text: str) -> str | None:
    """Detect 2BAC branch from document text."""
    text_upper = text.upper()
    mapping = {
        "SEG": "2BAC_SEG",
        "SCIENCES ÉCONOMIQUES": "2BAC_SEG",
        "SCIENCES MATH": "2BAC_SM_A",
        "SCIENCES EXPÉRIMENTALES": "2BAC_SE",
        "SCIENCES HUMAINES": "2BAC_SH",
        "LETTRES": "2BAC_L",
    }
    for keyword, branch in mapping.items():
        if keyword in text_upper:
            return branch
    return None
```

---

## Step 2 — Moroccan exam document parser

Create `apps/api/app/services/exam_parser.py`:

```python
"""
Parses uploaded Moroccan exam documents to extract their structure:
- Header: prof, lycée, classe, durée, note /20
- Exercises with point values
- Sub-questions with individual point values
- Mathematical formulas and tables

This is used to:
1. Pre-populate exam metadata when a DS/DC is uploaded
2. Generate similar exercises from real exam content
3. Display the exam structure in the UI
"""
import re
import logging
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

_HEADER_SCHEMA = (
    "object with: "
    "prof (string or null), "
    "lycee (string or null), "
    "classe (string or null — e.g. '2 Bac SEG', '3AC', '1BAC SM'), "
    "exam_type (string or null — 'DS' | 'DC' | 'DM' | 'BAC'), "
    "exam_number (integer or null — e.g. 3 from 'Devoir N°3'), "
    "subject (string or null), "
    "duration_minutes (integer or null — e.g. 120 from '2h'), "
    "total_points (number — almost always 20), "
    "academic_year (string or null)"
)

_EXERCISE_SCHEMA = (
    "array of objects, each with: "
    "number (integer), "
    "title (string or null), "
    "points (number), "
    "context (string — the problem setup text), "
    "sub_questions (array of objects, each with: "
    "  label (string — e.g. '1.', '1.a', '2.b'), "
    "  text (string — the question text), "
    "  points (number or null), "
    "  has_table (boolean), "
    "  has_formula (boolean), "
    "  expected_answer_type (string — 'calculation' | 'proof' | 'fill_blank' | 'boolean' | 'essay')"
    ")"
)


async def parse_exam_header(text: str) -> dict:
    """
    Extract structured metadata from the first page of a Moroccan exam.
    Works for DS, DC, BAC, regional exams.
    """
    # Take first 500 chars — header is always at the top
    header_text = text[:800]

    result = await ai_service.generate_structured_json(
        prompt=(
            "Extract the exam header information from this Moroccan school exam document.\n\n"
            "The document is in French or Arabic. Extract exactly what is written.\n"
            "For 'classe', extract the full class name (e.g. '2 Bac SEG', '3ème AC', 'TC Sciences').\n"
            "For 'duration_minutes', convert to minutes (1h30 → 90, 2h → 120).\n"
            "For 'exam_number', look for 'N°3', 'numéro 3', '#3' patterns.\n\n"
            f"EXAM HEADER TEXT:\n{header_text}"
        ),
        schema_description=_HEADER_SCHEMA,
        max_tokens=500,
    )
    return result if isinstance(result, dict) else {}


async def parse_exam_exercises(text: str) -> list[dict]:
    """
    Extract all exercises and sub-questions from the exam body.
    """
    # Skip the header (first 200 chars) and parse the rest
    body = text[200:] if len(text) > 200 else text

    result = await ai_service.generate_structured_json(
        prompt=(
            "Extract all exercises and sub-questions from this Moroccan exam.\n\n"
            "Rules:\n"
            "- Each EXERCICE has a number, point value in parentheses (e.g. '(8 points)'), "
            "and a context paragraph describing the problem setup.\n"
            "- Sub-questions are numbered (1., 2., 3.) or lettered (1.a, 1.b, 2.a).\n"
            "- Point values appear next to questions sometimes.\n"
            "- 'has_table' = true if the question involves a probability table or data table.\n"
            "- 'has_formula' = true if the question involves a formula, fraction, or math notation.\n"
            "- expected_answer_type: 'proof' for 'Montrer que', 'calculation' for 'Calculer', "
            "'fill_blank' for table completion, 'boolean' for 'sont-ils indépendants', "
            "'essay' for 'Justifier'.\n\n"
            f"EXAM BODY:\n{body[:4000]}"
        ),
        schema_description=_EXERCISE_SCHEMA,
        max_tokens=3000,
    )
    return result if isinstance(result, list) else []


async def parse_full_exam(text: str) -> dict:
    """
    Full parse: header + exercises. Returns a structured exam object.
    """
    import asyncio
    header, exercises = await asyncio.gather(
        parse_exam_header(text),
        parse_exam_exercises(text),
    )
    return {
        "header": header,
        "exercises": exercises,
        "total_sub_questions": sum(
            len(ex.get("sub_questions", [])) for ex in exercises
        ),
        "has_probability": any(
            "probabilit" in ex.get("context", "").lower()
            or any("probabilit" in sq.get("text", "").lower() for sq in ex.get("sub_questions", []))
            for ex in exercises
        ),
        "has_geometry": any(
            any(word in ex.get("context", "").lower() for word in ["triangle", "cercle", "droite", "angle"])
            for ex in exercises
        ),
    }


# ── Endpoint integration ───────────────────────────────────────────────────────

async def generate_similar_exercise(
    original_exercise: dict,
    level: str,
    subject: str,
    difficulty: str = "same",
) -> dict:
    """
    Given a parsed exercise, generate a new exercise at the same level
    with different numbers/scenarios but the same mathematical concepts.
    """
    sub_q_desc = "\n".join(
        f"  - {sq['label']}: {sq['text']} ({sq['expected_answer_type']})"
        for sq in original_exercise.get("sub_questions", [])
    )

    result = await ai_service.generate_structured_json(
        prompt=(
            f"Generate a new {subject} exercise for Moroccan {level} students "
            f"that tests the SAME mathematical concepts as the original below, "
            f"but with completely different numbers, objects, and scenario.\n\n"
            f"Original exercise context:\n{original_exercise.get('context', '')}\n\n"
            f"Original sub-questions:\n{sub_q_desc}\n\n"
            f"Requirements:\n"
            f"- Same structure (same number of sub-questions, same answer types)\n"
            f"- Same point values\n"
            f"- Different scenario (change urne→sac, boules→cartes, etc.)\n"
            f"- All calculations must be correct and verifiable\n"
            f"- Write in French\n"
            f"- Include the model answer for each sub-question\n\n"
            f"Return a JSON object with the same structure as the input exercise."
        ),
        schema_description=(
            "object with: context (string), points (number), "
            "sub_questions (array of {label, text, points, model_answer (string), answer_type})"
        ),
        max_tokens=2000,
    )
    return result if isinstance(result, dict) else {}
```

---

## Step 3 — Wire exam parser into file upload

When a PDF or DOCX is uploaded to a group, detect if it looks like an exam
and auto-parse it. Update `apps/api/app/jobs/file_jobs.py`:

```python
from app.services.exam_parser import parse_full_exam
from app.services.curriculum_service import detect_exam_type

# After text extraction, before chunking:
combined_text = " ".join(p["text"] for p in pages[:3])
exam_type = detect_exam_type(combined_text)

if exam_type:
    logger.info(f"Detected Moroccan exam type '{exam_type}' in file {file_id}")
    exam_parse = await parse_full_exam(combined_text + " ".join(p["text"] for p in pages))
    # Store parsed structure in file metadata
    file_obj = await db.get(File, file_id)
    if file_obj:
        file_obj.exam_metadata = exam_parse  # add this JSONB column to File model
        await db.flush()
```

Add `exam_metadata JSONB DEFAULT NULL` to the `files` table via a new
Alembic migration.

---

## Step 4 — New API endpoints for parsed exams

Add to `apps/api/app/api/v1/files.py`:

```
GET /groups/{group_id}/files/{file_id}/exam-structure
  — returns the parsed exam structure (header + exercises) if available
  — response: {header: {...}, exercises: [...], has_probability: bool}

POST /groups/{group_id}/files/{file_id}/generate-similar
  — generates a similar exercise to a specified exercise in the file
  — body: {exercise_index: int, difficulty: "same" | "easier" | "harder"}
  — response: {context, sub_questions, model_answers}
```

---

## Step 5 — Verification

```bash
python -c "
from app.services.exam_parser import parse_exam_header, parse_exam_exercises
from app.services.curriculum_service import (
    detect_exam_type, detect_branch, is_high_stakes,
    MOROCCAN_LEVELS, get_math_topics
)

# Verify all levels loaded
print(f'Levels: {len(MOROCCAN_LEVELS)}')
assert '2BAC_SEG' in MOROCCAN_LEVELS
assert '3AC' in MOROCCAN_LEVELS

# Verify exam type detection
sample = 'Prof: EL AMRANI IKRAM  Devoir Surveillé N°3  Classe: 2 Bac SEG'
print(f'Exam type: {detect_exam_type(sample)}')  # DS
print(f'Branch: {detect_branch(sample)}')          # 2BAC_SEG
print(f'High stakes: {is_high_stakes(\"2BAC_SEG\")}')  # True
print(f'Math topics 2BAC_SEG: {get_math_topics(\"2BAC_SEG\")}')
print('Curriculum service: OK')
"
```
