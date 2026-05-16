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
