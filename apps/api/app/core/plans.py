"""
Moroccan pricing plans. Limits are checked at the API layer via rate_limiter.

stripe_price_id values are populated at runtime from env vars (STRIPE_*_PRICE_ID)
so they never need to be hardcoded. The placeholder strings are only used as a
fallback when the env var is empty (which blocks checkout creation safely).
"""

from __future__ import annotations


def _build_plans() -> dict:
    from app.core.config import settings  # late import avoids circular deps
    return {
    "free": {
        "name_fr": "Gratuit",
        "name_ar": "مجاني",
        "price_mad": 0,
        "price_eur": 0,
        "limits": {
            "groups": 2,
            "files_per_group": 5,
            "chat_messages_day": 20,
            "exams_month": 5,
            "flashcard_sets": 5,
            "ai_solve_day": 3,
            "live_quiz_month": 0,
        },
        "features": ["rag_chat", "flashcards", "exams_basic"],
    },
    "etudiant": {
        "name_fr": "Étudiant",
        "name_ar": "طالب",
        "price_mad": 49,
        "price_eur": 4.99,
        "stripe_price_id": settings.STRIPE_ETUDIANT_PRICE_ID or "price_etudiant_monthly",
        "limits": {
            "groups": 10,
            "files_per_group": 30,
            "chat_messages_day": 200,
            "exams_month": 50,
            "flashcard_sets": 50,
            "ai_solve_day": 20,
            "live_quiz_month": 5,
        },
        "features": [
            "rag_chat", "flashcards", "exams_all_types", "graph_rag",
            "gamification", "goals", "live_quiz", "photo_solve",
        ],
    },
    "premium": {
        "name_fr": "Premium",
        "name_ar": "متميز",
        "price_mad": 99,
        "price_eur": 9.99,
        "stripe_price_id": settings.STRIPE_PREMIUM_PRICE_ID or "price_premium_monthly",
        "limits": {
            "groups": 50,
            "files_per_group": 100,
            "chat_messages_day": 1000,
            "exams_month": 200,
            "flashcard_sets": 500,
            "ai_solve_day": 100,
            "live_quiz_month": 50,
        },
        "features": ["all"],
    },
    "ecole": {
        "name_fr": "École",
        "name_ar": "مدرسة",
        "price_mad_per_seat": 29,
        "min_seats": 10,
        "stripe_price_id": settings.STRIPE_ECOLE_PRICE_ID or "price_ecole_per_seat",
        "limits": {"all": "unlimited"},
        "features": ["all", "org_dashboard", "teacher_tools", "analytics"],
    },
    # Legacy plan names — kept for backward compat
    "personal": {
        "name_fr": "Personnel",
        "name_ar": "شخصي",
        "price_mad": 49,
        "price_eur": 4.99,
        "stripe_price_id": settings.STRIPE_ETUDIANT_PRICE_ID or "price_etudiant_monthly",
        "limits": {
            "groups": 10,
            "files_per_group": 30,
            "chat_messages_day": 200,
            "exams_month": 50,
            "flashcard_sets": 50,
            "ai_solve_day": 20,
            "live_quiz_month": 5,
        },
        "features": ["rag_chat", "flashcards", "exams_all_types", "graph_rag",
                     "gamification", "goals", "live_quiz", "photo_solve"],
    },
    "school": {
        "name_fr": "École",
        "name_ar": "مدرسة",
        "limits": {"all": "unlimited"},
        "features": ["all", "org_dashboard", "teacher_tools", "analytics"],
    },
}


PLANS: dict = _build_plans()


def get_plan(plan: str) -> dict:
    return PLANS.get(plan, PLANS["free"])
