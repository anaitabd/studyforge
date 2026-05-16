# StudyForge — Universal Education Expansion

## Read first
```bash
cat apps/api/app/services/curriculum_service.py
cat apps/api/app/services/exam_service.py
cat apps/api/app/services/grading_service.py
cat apps/api/app/models/exam.py
```

---

## Part 1 — Universal curriculum service

Replace the Moroccan-only `curriculum_service.py` with a universal one
that treats Moroccan levels as one of many supported systems.

```python
# apps/api/app/services/curriculum_service.py

"""
Universal curriculum awareness.
Supports: Moroccan national curriculum, international curricula,
university levels, professional certifications, corporate training.
"""

# ── Education systems ──────────────────────────────────────────────────────────

EDUCATION_SYSTEMS = {

    # ── Moroccan national curriculum (already built) ───────────────────────────
    "MA": {
        "name": "Maroc — Curriculum National",
        "language": "fr",
        "levels": {
            "1AC": {"label": "1ère Année Collège", "cycle": "college"},
            "2AC": {"label": "2ème Année Collège", "cycle": "college"},
            "3AC": {"label": "3ème Année Collège", "cycle": "college", "high_stakes": True},
            "TC_S": {"label": "Tronc Commun Sciences", "cycle": "lycee"},
            "TC_L": {"label": "Tronc Commun Lettres", "cycle": "lycee"},
            "1BAC_SE": {"label": "1ère Bac Sc. Exp.", "cycle": "lycee"},
            "1BAC_SM": {"label": "1ère Bac Sc. Math", "cycle": "lycee"},
            "1BAC_SEG": {"label": "1ère Bac SEG", "cycle": "lycee"},
            "2BAC_SE": {"label": "2ème Bac Sc. Exp.", "cycle": "lycee", "high_stakes": True},
            "2BAC_SM_A": {"label": "2ème Bac SM A", "cycle": "lycee", "high_stakes": True},
            "2BAC_SM_B": {"label": "2ème Bac SM B", "cycle": "lycee", "high_stakes": True},
            "2BAC_SEG": {"label": "2ème Bac SEG", "cycle": "lycee", "high_stakes": True},
            "2BAC_SH": {"label": "2ème Bac Sc. Hum.", "cycle": "lycee", "high_stakes": True},
            "2BAC_L": {"label": "2ème Bac Lettres", "cycle": "lycee", "high_stakes": True},
        }
    },

    # ── French curriculum ──────────────────────────────────────────────────────
    "FR": {
        "name": "France — Éducation Nationale",
        "language": "fr",
        "levels": {
            "6e": {"label": "6ème", "cycle": "college"},
            "5e": {"label": "5ème", "cycle": "college"},
            "4e": {"label": "4ème", "cycle": "college"},
            "3e": {"label": "3ème — Brevet", "cycle": "college", "high_stakes": True},
            "2nde": {"label": "Seconde", "cycle": "lycee"},
            "1ere_G": {"label": "Première Générale", "cycle": "lycee"},
            "1ere_STMG": {"label": "Première STMG", "cycle": "lycee"},
            "Tle_G": {"label": "Terminale Générale — Bac", "cycle": "lycee", "high_stakes": True},
            "Tle_STMG": {"label": "Terminale STMG", "cycle": "lycee", "high_stakes": True},
        }
    },

    # ── British curriculum ─────────────────────────────────────────────────────
    "UK": {
        "name": "UK — National Curriculum",
        "language": "en",
        "levels": {
            "KS3_Y7": {"label": "Year 7", "cycle": "secondary"},
            "KS3_Y8": {"label": "Year 8", "cycle": "secondary"},
            "KS3_Y9": {"label": "Year 9", "cycle": "secondary"},
            "GCSE_Y10": {"label": "GCSE Year 10", "cycle": "gcse"},
            "GCSE_Y11": {"label": "GCSE Year 11", "cycle": "gcse", "high_stakes": True},
            "ALEVEL_Y12": {"label": "A-Level Year 12 (AS)", "cycle": "alevel"},
            "ALEVEL_Y13": {"label": "A-Level Year 13", "cycle": "alevel", "high_stakes": True},
        }
    },

    # ── IB ─────────────────────────────────────────────────────────────────────
    "IB": {
        "name": "International Baccalaureate",
        "language": "en",
        "levels": {
            "MYP_1": {"label": "MYP Year 1", "cycle": "myp"},
            "MYP_5": {"label": "MYP Year 5", "cycle": "myp"},
            "DP_1": {"label": "DP Year 1", "cycle": "dp"},
            "DP_2": {"label": "DP Year 2 — IB Exams", "cycle": "dp", "high_stakes": True},
        }
    },

    # ── University ─────────────────────────────────────────────────────────────
    "UNIV": {
        "name": "University / Higher Education",
        "language": "auto",
        "levels": {
            "L1": {"label": "Licence 1 (Bac+1)", "cycle": "licence"},
            "L2": {"label": "Licence 2 (Bac+2)", "cycle": "licence"},
            "L3": {"label": "Licence 3 (Bac+3)", "cycle": "licence"},
            "M1": {"label": "Master 1 (Bac+4)", "cycle": "master"},
            "M2": {"label": "Master 2 (Bac+5)", "cycle": "master", "high_stakes": True},
            "PHD": {"label": "Doctorat", "cycle": "doctoral"},
            "BTS": {"label": "BTS", "cycle": "bts"},
            "DUT": {"label": "DUT / BUT", "cycle": "dut"},
            "CPGE": {"label": "Classes Préparatoires", "cycle": "cpge", "high_stakes": True},
        }
    },

    # ── Professional certifications ────────────────────────────────────────────
    "CERT": {
        "name": "Professional Certifications",
        "language": "en",
        "levels": {
            "AWS_CP": {"label": "AWS Cloud Practitioner", "cycle": "cloud"},
            "AWS_SAA": {"label": "AWS Solutions Architect Associate", "cycle": "cloud"},
            "AWS_SAP": {"label": "AWS Solutions Architect Professional", "cycle": "cloud"},
            "AZURE_900": {"label": "Azure Fundamentals AZ-900", "cycle": "cloud"},
            "AZURE_104": {"label": "Azure Administrator AZ-104", "cycle": "cloud"},
            "GCP_ACE": {"label": "GCP Associate Cloud Engineer", "cycle": "cloud"},
            "PMP": {"label": "PMP — Project Management", "cycle": "management"},
            "SCRUM": {"label": "Scrum Master / PSM", "cycle": "agile"},
            "CFA_1": {"label": "CFA Level 1", "cycle": "finance"},
            "CFA_2": {"label": "CFA Level 2", "cycle": "finance"},
            "IELTS": {"label": "IELTS", "cycle": "language"},
            "TOEFL": {"label": "TOEFL iBT", "cycle": "language"},
            "DELF_B2": {"label": "DELF B2", "cycle": "language"},
            "DALF_C1": {"label": "DALF C1", "cycle": "language"},
            "CISCO_CCNA": {"label": "Cisco CCNA", "cycle": "networking"},
            "COMPTIA_A": {"label": "CompTIA A+", "cycle": "it"},
            "COMPTIA_SEC": {"label": "CompTIA Security+", "cycle": "it"},
        }
    },

    # ── Corporate training ─────────────────────────────────────────────────────
    "CORP": {
        "name": "Corporate Training",
        "language": "auto",
        "levels": {
            "ONBOARDING": {"label": "Onboarding", "cycle": "hr"},
            "COMPLIANCE": {"label": "Compliance Training", "cycle": "hr"},
            "LEADERSHIP": {"label": "Leadership Development", "cycle": "management"},
            "TECHNICAL": {"label": "Technical Skills", "cycle": "technical"},
            "SALES": {"label": "Sales Training", "cycle": "commercial"},
        }
    },
}

# ── Certification-specific exam formats ───────────────────────────────────────

CERTIFICATION_FORMATS = {
    "AWS_CP": {
        "questions": 65, "duration_minutes": 90, "passing_score": 70,
        "question_types": ["mcq_single", "mcq_multiple"],
        "format_rules": "Scenario-based. Always 4 options. One or more correct. Focus on cost optimization, security, and AWS Well-Architected Framework.",
    },
    "AWS_SAA": {
        "questions": 65, "duration_minutes": 130, "passing_score": 72,
        "question_types": ["mcq_single", "mcq_multiple"],
        "format_rules": "Scenario-based. Always 4-5 options. Focus on designing resilient, performant, secure, and cost-optimized architectures.",
    },
    "PMP": {
        "questions": 180, "duration_minutes": 230, "passing_score": None,
        "question_types": ["mcq_single", "mcq_multiple", "drag_and_drop"],
        "format_rules": "Situational questions about project management. PMI Talent Triangle: Technical, Leadership, Strategic. Agile-first since 2021.",
    },
    "CFA_1": {
        "questions": 180, "duration_minutes": 270, "passing_score": None,
        "question_types": ["mcq_single"],
        "format_rules": "Always 3 options (A/B/C). Three sessions. Item sets in afternoon. Focus on ethics, quantitative, economics, financial reporting, equity, fixed income, derivatives.",
    },
    "IELTS": {
        "questions": None, "duration_minutes": 165, "passing_score": None,
        "question_types": ["essay", "fill_blank", "mcq_single", "matching"],
        "format_rules": "4 modules: Listening (30min), Reading (60min), Writing (60min — Task1 150w + Task2 250w), Speaking (11-14min). Band score 1-9.",
    },
}


def get_certification_format(level: str) -> dict | None:
    return CERTIFICATION_FORMATS.get(level)


def get_all_systems() -> list[dict]:
    """Return all education systems for the onboarding level selector."""
    return [
        {"system": k, "name": v["name"], "language": v["language"],
         "levels": [{"code": lk, **lv} for lk, lv in v["levels"].items()]}
        for k, v in EDUCATION_SYSTEMS.items()
    ]


def detect_system_from_text(text: str) -> str:
    """Detect which education system a document belongs to."""
    text_lower = text.lower()
    if any(w in text_lower for w in ["baccalauréat", "lycée", "collège", "devoir surveillé"]):
        if any(w in text_lower for w in ["1ac", "2ac", "3ac", "tronc commun"]):
            return "MA"
        return "FR"
    if any(w in text_lower for w in ["gcse", "a-level", "year 11", "ofqual"]):
        return "UK"
    if any(w in text_lower for w in ["aws", "amazon web services", "cloud practitioner"]):
        return "CERT"
    if any(w in text_lower for w in ["ielts", "toefl", "band score"]):
        return "CERT"
    if any(w in text_lower for w in ["licence", "master", "doctorat", "université"]):
        return "UNIV"
    return "UNIV"  # default to university for unrecognized content
```

---

## Part 2 — New question types for universal coverage

Extend `apps/api/app/services/exam_service.py` with these new question type
generators. Add them alongside the existing ones:

### `case_study` — for university/business/law/medicine
```python
def _build_case_study_prompt(context, count, difficulty, language):
    return (
        f"Generate {count} case study question(s) from the course material below.\n\n"
        "A case study question presents a realistic scenario and asks the student to:\n"
        "- Analyze the situation using course concepts\n"
        "- Apply frameworks or models from the material\n"
        "- Make and justify a decision\n\n"
        "For each case study provide:\n"
        '- "scenario": 100-150 word realistic situation\n'
        '- "sub_questions": 3-4 sub-questions (analysis, application, recommendation)\n'
        '- "required_concepts": list of course concepts that must appear in a good answer\n'
        '- "model_answer_outline": bullet points for a strong response\n'
        '- "points_per_sub": point values summing to the exercise total\n\n'
        f"Difficulty: {difficulty}\n\nCOURSE MATERIAL:\n{context}"
    )
```

### `code_exercise` — for CS/programming courses
```python
def _build_code_prompt(context, count, difficulty, language, programming_language="python"):
    return (
        f"Generate {count} coding exercise(s) from the course material below.\n\n"
        f"Programming language: {programming_language}\n\n"
        "For each exercise provide:\n"
        '- "instruction": clear task description\n'
        '- "starter_code": function signature or partial code (may be empty string)\n'
        '- "test_cases": array of {input, expected_output} pairs (3-5 tests)\n'
        '- "solution": the complete correct solution\n'
        '- "hints": array of 2-3 hints for struggling students\n'
        '- "concepts_tested": list of programming concepts this tests\n'
        '- "time_estimate_minutes": realistic time for a student at this level\n\n'
        f"Difficulty: {difficulty}\n\nCOURSE MATERIAL:\n{context}"
    )
```

### `oral_question` — for exam prep and language learning
```python
def _build_oral_prompt(context, count, difficulty, language):
    return (
        f"Generate {count} oral/discussion question(s) from the course material below.\n\n"
        "These are questions a professor or interviewer might ask verbally.\n\n"
        "For each question provide:\n"
        '- "question": the oral question\n'
        '- "key_points": 4-6 bullet points a complete answer must cover\n'
        '- "follow_up_questions": 2 likely follow-up questions\n'
        '- "duration_minutes": expected answer duration (1-3 minutes)\n'
        '- "evaluation_criteria": what distinguishes excellent/good/poor answers\n\n'
        f"Difficulty: {difficulty}\n\nCOURSE MATERIAL:\n{context}"
    )
```

### `certification_mcq` — format-aware for professional certifications
```python
def _build_certification_prompt(context, count, cert_level, language):
    fmt = CERTIFICATION_FORMATS.get(cert_level, {})
    format_rules = fmt.get("format_rules", "Standard multiple choice.")
    return (
        f"Generate {count} practice questions for the {cert_level} certification exam.\n\n"
        f"EXAM FORMAT RULES:\n{format_rules}\n\n"
        "Each question must:\n"
        "- Be scenario-based (not theoretical)\n"
        "- Have exactly 4 options (A/B/C/D)\n"
        "- Have one definitively correct answer\n"
        "- Include an explanation of WHY each option is right or wrong\n"
        "- Reference a specific service, framework, or standard from the material\n\n"
        '- "question": the scenario question\n'
        '- "options": {A: ..., B: ..., C: ..., D: ...}\n'
        '- "correct": "A" | "B" | "C" | "D"\n'
        '- "explanation": why correct is right and why others are wrong\n'
        '- "domain": which exam domain this covers (from the cert syllabus)\n\n'
        f"COURSE MATERIAL:\n{context}"
    )
```

Add these to `_SCHEMA_BY_TYPE` and `QUESTION_TYPES_BY_SUBJECT` accordingly.

---

## Part 3 — Code exercise grading

Add to `apps/api/app/services/grading_service.py`:

```python
async def grade_code_exercise(
    question: dict,
    student_code: str,
    max_points: float,
) -> dict:
    """
    Grade a code exercise by:
    1. Checking test cases conceptually (no execution sandbox yet)
    2. Evaluating code quality and correctness via AI
    """
    solution = question.get("solution", "")
    test_cases = question.get("test_cases", [])
    concepts = question.get("concepts_tested", [])

    prompt = (
        f"You are grading a programming exercise. Evaluate the student's code.\n\n"
        f"TASK: {question.get('instruction', '')}\n\n"
        f"MODEL SOLUTION:\n{solution}\n\n"
        f"CONCEPTS TESTED: {', '.join(concepts)}\n\n"
        f"TEST CASES:\n"
        + "\n".join(f"  Input: {tc['input']} → Expected: {tc['expected_output']}" for tc in test_cases)
        + f"\n\nSTUDENT CODE:\n{student_code}\n\n"
        "Evaluate:\n"
        "1. Does the student's code produce the correct output for each test case?\n"
        "2. Is the logic correct even if syntax is slightly off?\n"
        "3. Are the required programming concepts used correctly?\n\n"
        "Return JSON with:\n"
        '- "total_score": number (out of max_points)\n'
        '- "test_results": array of {test_case, passes: bool, comment}\n'
        '- "code_quality": "excellent" | "good" | "needs_improvement"\n'
        '- "feedback": 2-3 sentences on what is right and what to fix\n'
        '- "corrected_line": the specific line to fix if there is a bug\n'
    )

    result = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description="object with: total_score, test_results, code_quality, feedback, corrected_line",
        max_tokens=1000,
    )

    if not isinstance(result, dict):
        return {"score": 0, "max_points": max_points, "feedback": "Grading error."}

    return {
        "score": min(float(result.get("total_score", 0)), max_points),
        "max_points": max_points,
        "test_results": result.get("test_results", []),
        "code_quality": result.get("code_quality"),
        "feedback": result.get("feedback", ""),
        "corrected_line": result.get("corrected_line"),
    }
```

---

## Part 4 — Universal essay rubrics

Extend `ESSAY_RUBRIC_CATEGORIES` in `grading_service.py` to cover all contexts:

```python
ESSAY_RUBRIC_CATEGORIES = {
    # ── Moroccan curriculum (existing) ────────────────────────────────────────
    "french": [...],   # already built
    "arabic": [...],   # already built

    # ── University academic essay ─────────────────────────────────────────────
    "academic": [
        {"category": "thesis_and_argument", "max_points": 5,
         "description": "Is there a clear, defensible thesis? Does every paragraph serve the argument?"},
        {"category": "evidence_and_sources", "max_points": 5,
         "description": "Are claims supported by evidence, citations, or examples from the course material?"},
        {"category": "critical_analysis", "max_points": 5,
         "description": "Does the student analyze rather than just describe? Are counterarguments considered?"},
        {"category": "structure_and_coherence", "max_points": 3,
         "description": "Clear introduction, developed body paragraphs, conclusion. Logical transitions."},
        {"category": "language_and_precision", "max_points": 2,
         "description": "Appropriate academic register. Precise use of discipline-specific terminology."},
    ],

    # ── Business case analysis ────────────────────────────────────────────────
    "business": [
        {"category": "problem_identification", "max_points": 4,
         "description": "Does the student correctly identify the core business problem?"},
        {"category": "framework_application", "max_points": 5,
         "description": "Are relevant frameworks (SWOT, Porter, etc.) applied correctly?"},
        {"category": "data_analysis", "max_points": 4,
         "description": "Are financial or market data interpreted accurately?"},
        {"category": "recommendation", "max_points": 4,
         "description": "Is the recommendation specific, feasible, and justified?"},
        {"category": "communication", "max_points": 3,
         "description": "Is the response clearly structured and professionally written?"},
    ],

    # ── IELTS Writing Task 2 ──────────────────────────────────────────────────
    "ielts_task2": [
        {"category": "task_achievement", "max_points": 9,
         "description": "Does the response fully address all parts of the task? Is the position clear?"},
        {"category": "coherence_cohesion", "max_points": 9,
         "description": "Logical organisation, use of paragraphing, cohesive devices."},
        {"category": "lexical_resource", "max_points": 9,
         "description": "Range and accuracy of vocabulary. Uncommon words used appropriately."},
        {"category": "grammatical_range", "max_points": 9,
         "description": "Range of structures, accuracy, punctuation."},
    ],

    # ── Scientific report ─────────────────────────────────────────────────────
    "lab_report": [
        {"category": "hypothesis", "max_points": 2,
         "description": "Is the hypothesis clearly stated and scientifically sound?"},
        {"category": "methodology", "max_points": 4,
         "description": "Is the method described precisely enough to be reproduced?"},
        {"category": "results_analysis", "max_points": 5,
         "description": "Are results presented clearly? Is the analysis correct?"},
        {"category": "conclusion", "max_points": 4,
         "description": "Does the conclusion link back to the hypothesis with evidence?"},
        {"category": "scientific_language", "max_points": 5,
         "description": "Use of correct scientific terminology and notation."},
    ],

    # ── General (default fallback) ────────────────────────────────────────────
    "general": [
        {"category": "content_relevance", "max_points": 5,
         "description": "Does the response address the question fully and accurately?"},
        {"category": "organization", "max_points": 5,
         "description": "Clear structure with logical progression."},
        {"category": "argumentation", "max_points": 5,
         "description": "Claims supported with evidence or reasoning."},
        {"category": "language_quality", "max_points": 5,
         "description": "Clear, grammatically correct, appropriate register."},
    ],
}
```

The `grade_essay()` function already uses this dict — just extend it.

---

## Part 5 — Verification

```bash
python -c "
from app.services.curriculum_service import (
    EDUCATION_SYSTEMS, get_all_systems,
    detect_system_from_text, get_certification_format
)

systems = get_all_systems()
print(f'Education systems: {len(systems)}')

# Test detection
print(detect_system_from_text('AWS Solutions Architect exam'))   # CERT
print(detect_system_from_text('Devoir Surveillé 2 Bac SEG'))    # MA
print(detect_system_from_text('GCSE Mathematics Year 11'))       # UK
print(detect_system_from_text('Licence 3 Économie Université')) # UNIV

# Test cert format
fmt = get_certification_format('AWS_SAA')
print(f'AWS SAA: {fmt[\"questions\"]} questions, {fmt[\"duration_minutes\"]}min')
print('OK')
"
```
