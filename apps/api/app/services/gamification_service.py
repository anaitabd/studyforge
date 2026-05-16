"""
Gamification engine: XP, levels, badges, daily challenges.
All award calls must be fire-and-forget (asyncio.create_task).
"""
import logging
import uuid
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import UserXP, UserLevel, Badge, UserBadge, DailyChallenge
from app.models.notification import Notification

logger = logging.getLogger(__name__)

# ── XP values ──────────────────────────────────────────────────────────────────
XP_VALUES = {
    "daily_login": 10,
    "chat_message": 5,
    "flashcard_review": 3,
    "flashcard_streak_5": 15,
    "flashcard_streak_10": 30,
    "exam_complete": 50,
    "exam_score_60": 20,
    "exam_score_80": 50,
    "exam_perfect": 100,
    "exam_first_attempt_pass": 30,
    "path_module": 20,
    "path_complete": 100,
    "streak_7": 50,
    "streak_30": 200,
    "streak_100": 500,
    "challenge_complete": 40,
    "first_exam_in_group": 25,
    "peer_beat": 10,
    "badge_bonus": 0,  # handled per-badge via xp_reward
}

# ── Level thresholds ───────────────────────────────────────────────────────────
LEVELS = [
    (0,     1,  "Débutant",    "طالب مبتدئ"),
    (100,   2,  "Apprenti",    "متعلم"),
    (300,   3,  "Élève",       "تلميذ"),
    (600,   4,  "Studieux",    "مجتهد"),
    (1000,  5,  "Curieux",     "فضولي"),
    (1500,  6,  "Appliqué",    "مثابر"),
    (2200,  7,  "Assidu",      "منتظم"),
    (3000,  8,  "Expert",      "خبير"),
    (4000,  9,  "Maître",      "سيد"),
    (5500,  10, "Champion",    "بطل"),
    (7500,  11, "Prodige",     "عبقري"),
    (10000, 12, "Légende",     "أسطورة"),
]

_XP_FOR_NEXT = {lvl: LEVELS[i + 1][0] for i, (_, lvl, _, _) in enumerate(LEVELS) if i + 1 < len(LEVELS)}


def compute_level(total_xp: int) -> tuple[int, str]:
    """Return (level_number, level_title) for a given XP total."""
    current = (1, "Débutant")
    for xp_threshold, level_num, title_fr, _ in LEVELS:
        if total_xp >= xp_threshold:
            current = (level_num, title_fr)
    return current


def xp_to_next_level(total_xp: int, level: int) -> int | None:
    next_threshold = _XP_FOR_NEXT.get(level)
    if next_threshold is None:
        return None
    return max(0, next_threshold - total_xp)


async def _notify(db: AsyncSession, user_id: str, notif_type: str, title: str, body: str) -> None:
    db.add(Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=notif_type,
        title=title,
        body=body,
    ))


async def award_xp(
    db: AsyncSession,
    user_id: str,
    reason: str,
    metadata: dict | None = None,
    multiplier: float = 1.0,
) -> int:
    """Award XP to a user. Returns points awarded."""
    base = XP_VALUES.get(reason, 0)
    points = int(base * multiplier)
    if points <= 0:
        return 0

    db.add(UserXP(
        user_id=user_id,
        points=points,
        reason=reason,
        extra=metadata or {},
    ))

    level_result = await db.execute(
        select(UserLevel).where(UserLevel.user_id == user_id)
    )
    user_level = level_result.scalar_one_or_none()
    if user_level is None:
        user_level = UserLevel(user_id=user_id, total_xp=0, level=1)
        db.add(user_level)

    old_level = user_level.level
    user_level.total_xp += points
    new_level, new_title = compute_level(user_level.total_xp)
    user_level.level = new_level
    user_level.level_title = new_title

    await db.flush()

    if new_level > old_level:
        await _notify(
            db, user_id, "level_up",
            f"Niveau {new_level} atteint !",
            f"Tu es maintenant {new_title}. Continue comme ça !",
        )

    await _check_and_award_badges(db, user_id)
    return points


# ── Badge definitions (seeded at startup) ─────────────────────────────────────
BADGE_DEFINITIONS = [
    # (id, name, icon, category, xp_reward, rarity, description)
    ("streak_3",    "3 jours de suite",   "🔥",   "streak",    10,  "common",    "3-day study streak"),
    ("streak_7",    "Une semaine !",       "🔥🔥", "streak",    30,  "rare",      "7-day study streak"),
    ("streak_30",   "Un mois sans arrêt", "💫",   "streak",    100, "epic",      "30-day study streak"),
    ("streak_100",  "Centurion",           "⚡",   "streak",    250, "legendary", "100-day study streak"),
    ("first_exam",  "Premier examen",      "📝",   "exam",      20,  "common",    "Completed first exam"),
    ("exam_pass",   "Reçu !",              "✅",   "exam",      30,  "common",    "Passed an exam (>=10/20)"),
    ("exam_ace",    "Mention très bien",   "🏆",   "exam",      75,  "rare",      "Scored 18+/20"),
    ("exam_perfect","Parfait !",           "💯",   "exam",      150, "epic",      "Scored 20/20"),
    ("exam_10",     "Habitué des examens", "📚",   "exam",      50,  "rare",      "Completed 10 exams"),
    ("cards_50",    "50 cartes révisées",  "🃏",   "flashcard", 20,  "common",    "50 cards reviewed"),
    ("cards_500",   "Mémoire de fer",      "🧠",   "flashcard", 60,  "rare",      "500 cards reviewed"),
    ("retention_80","Bonne rétention",     "💡",   "flashcard", 40,  "rare",      "80%+ retention rate"),
    ("group_first", "Pionnier du groupe",  "🚀",   "social",    25,  "common",    "First in group"),
    ("top_3",       "Top 3 du groupe",     "🥉",   "social",    35,  "rare",      "Top 3 in group leaderboard"),
    ("top_1",       "Champion du groupe",  "🥇",   "social",    75,  "epic",      "#1 in group leaderboard"),
    ("night_owl",   "Chouette de nuit",    "🦉",   "special",   15,  "rare",      "Studied after midnight"),
    ("early_bird",  "Lève-tôt",            "🌅",   "special",   15,  "rare",      "Studied before 7am"),
    ("weekend",     "Pas de repos",        "💪",   "special",   20,  "rare",      "Studied on weekend"),
    ("morocco_bac", "Futur Bachelier",     "🇲🇦",  "special",   100, "legendary", "Completed a 2BAC exam"),
]


async def seed_badges(db: AsyncSession) -> None:
    """Insert badge definitions if not present."""
    for bid, name, icon, cat, xp, rarity, desc in BADGE_DEFINITIONS:
        existing = await db.get(Badge, bid)
        if not existing:
            db.add(Badge(id=bid, name=name, description=desc, icon=icon,
                         category=cat, xp_reward=xp, rarity=rarity))
    await db.commit()


async def _check_and_award_badges(db: AsyncSession, user_id: str) -> None:
    earned_result = await db.execute(
        select(UserBadge.badge_id).where(UserBadge.user_id == user_id)
    )
    earned_ids = {row[0] for row in earned_result.all()}

    xp_result = await db.execute(
        select(UserLevel).where(UserLevel.user_id == user_id)
    )
    user_level = xp_result.scalar_one_or_none()
    total_xp = user_level.total_xp if user_level else 0

    xp_badges = [
        ("streak_3",  total_xp >= 30),
        ("cards_50",  total_xp >= 150),
        ("cards_500", total_xp >= 1500),
    ]

    for badge_id, condition in xp_badges:
        if condition and badge_id not in earned_ids:
            badge = await db.get(Badge, badge_id)
            if badge:
                db.add(UserBadge(user_id=user_id, badge_id=badge_id))
                await _notify(
                    db, user_id, "badge_earned",
                    f"Badge débloqué : {badge.icon} {badge.name}",
                    badge.description,
                )
                if badge.xp_reward > 0:
                    db.add(UserXP(
                        user_id=user_id,
                        points=badge.xp_reward,
                        reason="badge_bonus",
                        metadata={"badge_id": badge_id},
                    ))
                    if user_level:
                        user_level.total_xp += badge.xp_reward
                        new_level, new_title = compute_level(user_level.total_xp)
                        user_level.level = new_level
                        user_level.level_title = new_title

    await db.commit()


# ── Daily challenge ────────────────────────────────────────────────────────────
CHALLENGE_POOL = [
    ("review_N_cards",   10, 25, "Révisez {n} cartes aujourd'hui"),
    ("review_N_cards",   20, 40, "Révisez {n} cartes aujourd'hui"),
    ("chat_N_messages",   3, 20, "Posez {n} questions au tuteur IA"),
    ("complete_exam",     1, 50, "Passez un examen aujourd'hui"),
    ("study_N_minutes",  15, 20, "Étudiez pendant {n} minutes"),
    ("study_N_minutes",  30, 35, "Étudiez pendant {n} minutes"),
    ("complete_module",   1, 30, "Terminez un module de parcours"),
    ("achieve_score_X",  70, 40, "Obtenez {n}% ou plus à un examen"),
]


async def get_or_create_daily_challenge(db: AsyncSession, user_id: str) -> dict:
    """Get today's challenge or create one if it doesn't exist."""
    today = date.today().isoformat()
    result = await db.execute(
        select(DailyChallenge).where(
            DailyChallenge.user_id == user_id,
            DailyChallenge.date == today,
        )
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        import random
        ctype, target, xp, _ = random.choice(CHALLENGE_POOL)
        challenge = DailyChallenge(
            user_id=user_id,
            date=today,
            challenge_type=ctype,
            target=target,
            progress=0,
            xp_reward=xp,
        )
        db.add(challenge)
        await db.commit()
        await db.refresh(challenge)

    return _challenge_dict(challenge)


async def update_challenge_progress(
    db: AsyncSession,
    user_id: str,
    challenge_type: str,
    increment: int,
) -> dict:
    """Increment progress on today's challenge if type matches. Awards XP on completion."""
    today = date.today().isoformat()
    result = await db.execute(
        select(DailyChallenge).where(
            DailyChallenge.user_id == user_id,
            DailyChallenge.date == today,
            DailyChallenge.challenge_type == challenge_type,
        )
    )
    challenge = result.scalar_one_or_none()
    if not challenge or challenge.completed:
        return {}

    challenge.progress = min(challenge.target, challenge.progress + increment)
    if challenge.progress >= challenge.target and not challenge.completed:
        from datetime import datetime, timezone
        challenge.completed = True
        challenge.completed_at = datetime.now(timezone.utc)
        await db.flush()
        await award_xp(db, user_id, "challenge_complete",
                       {"challenge_id": challenge.id, "type": challenge_type})

    await db.commit()
    await db.refresh(challenge)
    return _challenge_dict(challenge)


def _challenge_dict(challenge: DailyChallenge) -> dict:
    return {
        "id": challenge.id,
        "date": challenge.date,
        "type": challenge.challenge_type,
        "target": challenge.target,
        "progress": challenge.progress,
        "completed": challenge.completed,
        "xp_reward": challenge.xp_reward,
        "progress_pct": min(100, int(challenge.progress / challenge.target * 100)),
    }
