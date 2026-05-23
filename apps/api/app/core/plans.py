from __future__ import annotations


_MB = 1024 * 1024

PLANS: dict = {
    "free": {
        "name_fr": "Gratuit",
        "name_ar": "مجاني",
        "price_usd": 0,
        "price_mad": 0,
        "limits": {
            "groups": 2,
            "files_per_group": 5,
            "chat_messages_day": 20,
            "exams_month": 5,
            "flashcard_sets": 5,
            "ai_solve_day": 3,
            "live_quiz_month": 0,
            "max_upload_bytes": 10 * _MB,
        },
        "features": ["rag_chat", "flashcards", "exams_basic"],
    },
    "etudiant": {
        "name_fr": "Étudiant",
        "name_ar": "طالب",
        "price_usd": 4.99,
        "price_mad": 49,
        "limits": {
            "groups": 10,
            "files_per_group": 30,
            "chat_messages_day": 200,
            "exams_month": 50,
            "flashcard_sets": 50,
            "ai_solve_day": 20,
            "live_quiz_month": 5,
            "max_upload_bytes": 50 * _MB,
        },
        "features": [
            "rag_chat", "flashcards", "exams_all_types", "graph_rag",
            "gamification", "goals", "live_quiz", "photo_solve",
        ],
    },
    "premium": {
        "name_fr": "Premium",
        "name_ar": "متميز",
        "price_usd": 9.99,
        "price_mad": 99,
        "limits": {
            "groups": 50,
            "files_per_group": 100,
            "chat_messages_day": 1000,
            "exams_month": 200,
            "flashcard_sets": 500,
            "ai_solve_day": 100,
            "live_quiz_month": 50,
            "max_upload_bytes": 50 * _MB,
        },
        "features": ["all"],
    },
    "ecole": {
        "name_fr": "École",
        "name_ar": "مدرسة",
        "price_usd": 29.0,
        "price_mad": 290,
        "limits": {"all": "unlimited", "max_upload_bytes": 200 * _MB},
        "features": ["all", "org_dashboard", "teacher_tools", "analytics"],
    },
    # Legacy aliases
    "personal": {
        "name_fr": "Personnel",
        "name_ar": "شخصي",
        "price_usd": 4.99,
        "price_mad": 49,
        "limits": {
            "groups": 10,
            "files_per_group": 30,
            "chat_messages_day": 200,
            "exams_month": 50,
            "flashcard_sets": 50,
            "ai_solve_day": 20,
            "live_quiz_month": 5,
            "max_upload_bytes": 50 * _MB,
        },
        "features": ["rag_chat", "flashcards", "exams_all_types", "graph_rag",
                     "gamification", "goals", "live_quiz", "photo_solve"],
    },
    "school": {
        "name_fr": "École",
        "name_ar": "مدرسة",
        "price_usd": 29.0,
        "price_mad": 290,
        "limits": {"all": "unlimited", "max_upload_bytes": 200 * _MB},
        "features": ["all", "org_dashboard", "teacher_tools", "analytics"],
    },
}


def get_plan(plan: str) -> dict:
    return PLANS.get(plan, PLANS["free"])


def get_upload_limit(plan: str) -> int:
    """Return the max upload size in bytes for the given plan."""
    limits = get_plan(plan).get("limits", {})
    return int(limits.get("max_upload_bytes", 10 * _MB))
