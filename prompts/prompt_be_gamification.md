# StudyForge — BE-9: Gamification System

## Read first
```bash
cat apps/api/app/models/user.py
cat apps/api/app/models/goal.py
cat apps/api/app/services/analytics_service.py
cat apps/api/app/api/v1/me.py
```

---

## Step 1 — New models

Create `apps/api/app/models/gamification.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Float, Text, Boolean, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserXP(Base):
    """XP points per user — append-only log."""
    __tablename__ = "user_xp_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    points: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(100))
    # reason values: exam_complete | exam_perfect | flashcard_review | flashcard_streak
    # chat_message | path_module | path_complete | daily_login | streak_bonus
    # challenge_complete | peer_beat | first_in_group
    metadata: Mapped[dict] = mapped_column(JSONB, default={})
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserLevel(Base):
    """Current XP total and computed level per user."""
    __tablename__ = "user_levels"
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    level_title: Mapped[str] = mapped_column(String(50), default="Débutant")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Badge(Base):
    """Badge definitions — seeded at startup."""
    __tablename__ = "badges"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "first_exam"
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(10))  # emoji
    category: Mapped[str] = mapped_column(String(50))  # streak | exam | flashcard | social | special
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    rarity: Mapped[str] = mapped_column(String(20), default="common")  # common | rare | epic | legendary


class UserBadge(Base):
    """Badges earned by users."""
    __tablename__ = "user_badges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    badge_id: Mapped[str] = mapped_column(String(50), ForeignKey("badges.id"))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notified: Mapped[bool] = mapped_column(Boolean, default=False)


class DailyChallenge(Base):
    """One challenge per day per user — auto-generated."""
    __tablename__ = "daily_challenges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    challenge_type: Mapped[str] = mapped_column(String(50))
    # Types: review_N_cards | complete_exam | study_N_minutes | chat_N_messages
    # complete_module | achieve_score_X | beat_streak_X
    target: Mapped[int] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    xp_reward: Mapped[int] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

Create Alembic migration for all 5 tables.

---

## Step 2 — XP values and level system

Create `apps/api/app/services/gamification_service.py`:

```python
"""
Gamification engine: XP, levels, badges, daily challenges.
All award calls must be fire-and-forget (asyncio.create_task).
"""
import logging
import uuid
from datetime import date, datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import UserXP, UserLevel, Badge, UserBadge, DailyChallenge
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

# ── XP values ──────────────────────────────────────────────────────────────────
XP_VALUES = {
    "daily_login": 10,
    "chat_message": 5,
    "flashcard_review": 3,        # per card reviewed
    "flashcard_streak_5": 15,     # 5 cards in a row correct
    "flashcard_streak_10": 30,
    "exam_complete": 50,
    "exam_score_60": 20,          # bonus for 60%+ score
    "exam_score_80": 50,          # bonus for 80%+ score
    "exam_perfect": 100,          # bonus for 100% score
    "exam_first_attempt_pass": 30,
    "path_module": 20,            # per module completed
    "path_complete": 100,         # full path completed
    "streak_7": 50,               # 7-day streak bonus
    "streak_30": 200,
    "streak_100": 500,
    "challenge_complete": 40,
    "first_exam_in_group": 25,
    "peer_beat": 10,              # beat a group member's score
}

# ── Level thresholds ───────────────────────────────────────────────────────────
LEVELS = [
    (0,     1,  "Débutant",       "طالب مبتدئ"),
    (100,   2,  "Apprenti",       "متعلم"),
    (300,   3,  "Élève",          "تلميذ"),
    (600,   4,  "Studieux",       "مجتهد"),
    (1000,  5,  "Curieux",        "فضولي"),
    (1500,  6,  "Appliqué",       "مثابر"),
    (2200,  7,  "Assidu",         "منتظم"),
    (3000,  8,  "Expert",         "خبير"),
    (4000,  9,  "Maître",         "سيد"),
    (5500,  10, "Champion",       "بطل"),
    (7500,  11, "Prodige",        "عبقري"),
    (10000, 12, "Légende",        "أسطورة"),
]

def compute_level(total_xp: int) -> tuple[int, str]:
    """Return (level_number, level_title) for a given XP total."""
    current = (1, "Débutant")
    for xp_threshold, level_num, title_fr, _ in LEVELS:
        if total_xp >= xp_threshold:
            current = (level_num, title_fr)
    return current


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

    log = UserXP(
        user_id=user_id,
        points=points,
        reason=reason,
        metadata=metadata or {},
    )
    db.add(log)

    # Update or create UserLevel
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

    # Level-up notification
    if new_level > old_level:
        await notification_service.send(
            db=db,
            user_id=user_id,
            type="level_up",
            title=f"Niveau {new_level} atteint ! 🎉",
            body=f"Tu es maintenant {new_title}. Continue comme ça !",
        )

    await _check_and_award_badges(db, user_id)
    return points


# ── Badge definitions (seeded at startup) ─────────────────────────────────────
BADGE_DEFINITIONS = [
    # Streak badges
    ("streak_3",    "3 jours de suite",    "🔥", "streak",    10,  "common",    "3-day study streak"),
    ("streak_7",    "Une semaine !",        "🔥🔥", "streak",  30,  "rare",      "7-day study streak"),
    ("streak_30",   "Un mois sans arrêt",  "💫", "streak",    100, "epic",      "30-day study streak"),
    ("streak_100",  "Centurion",           "⚡", "streak",    250, "legendary", "100-day study streak"),
    # Exam badges
    ("first_exam",  "Premier examen",      "📝", "exam",      20,  "common",    "Completed first exam"),
    ("exam_pass",   "Reçu !",              "✅", "exam",      30,  "common",    "Passed an exam (>=10/20)"),
    ("exam_ace",    "Mention très bien",   "🏆", "exam",      75,  "rare",      "Scored 18+/20"),
    ("exam_perfect","Parfait !",           "💯", "exam",      150, "epic",      "Scored 20/20"),
    ("exam_10",     "Habitué des examens", "📚", "exam",      50,  "rare",      "Completed 10 exams"),
    # Flashcard badges
    ("cards_50",    "50 cartes révisées",  "🃏", "flashcard", 20,  "common",    "50 cards reviewed"),
    ("cards_500",   "Mémoire de fer",      "🧠", "flashcard", 60,  "rare",      "500 cards reviewed"),
    ("retention_80","Bonne rétention",     "💡", "flashcard", 40,  "rare",      "80%+ retention rate"),
    # Social badges
    ("group_first", "Pionnier du groupe",  "🚀", "social",    25,  "common",    "First in group"),
    ("top_3",       "Top 3 du groupe",     "🥉", "social",    35,  "rare",      "Top 3 in group leaderboard"),
    ("top_1",       "Champion du groupe",  "🥇", "social",    75,  "epic",      "#1 in group leaderboard"),
    # Special
    ("night_owl",   "Chouette de nuit",    "🦉", "special",   15,  "rare",      "Studied after midnight"),
    ("early_bird",  "Lève-tôt",            "🌅", "special",   15,  "rare",      "Studied before 7am"),
    ("weekend",     "Pas de repos",        "💪", "special",   20,  "rare",      "Studied on weekend"),
    ("morocco_bac", "Futur Bachelier",     "🇲🇦", "special",  100, "legendary", "Completed a 2BAC exam"),
]

async def seed_badges(db: AsyncSession):
    """Insert badge definitions if not present."""
    for bid, name, icon, cat, xp, rarity, desc in BADGE_DEFINITIONS:
        existing = await db.get(Badge, bid)
        if not existing:
            db.add(Badge(id=bid, name=name, description=desc, icon=icon,
                        category=cat, xp_reward=xp, rarity=rarity))
    await db.commit()


async def _check_and_award_badges(db: AsyncSession, user_id: str):
    """Check if user has earned any new badges and award them."""
    # Get already-earned badge IDs
    earned = await db.execute(
        select(UserBadge.badge_id).where(UserBadge.user_id == user_id)
    )
    earned_ids = {row[0] for row in earned.all()}

    # Compute user stats
    xp_result = await db.execute(
        select(UserLevel).where(UserLevel.user_id == user_id)
    )
    user_level = xp_result.scalar_one_or_none()
    total_xp = user_level.total_xp if user_level else 0

    # Check each badge condition
    new_badges = []

    # XP-based (simple threshold checks)
    xp_badges = [
        ("streak_3", total_xp >= 30),   # rough proxy
        ("cards_50", total_xp >= 150),
        ("cards_500", total_xp >= 1500),
    ]
    for badge_id, condition in xp_badges:
        if condition and badge_id not in earned_ids:
            new_badges.append(badge_id)

    # Award new badges
    for badge_id in new_badges:
        badge = await db.get(Badge, badge_id)
        if badge:
            db.add(UserBadge(user_id=user_id, badge_id=badge_id))
            await notification_service.send(
                db=db,
                user_id=user_id,
                type="badge_earned",
                title=f"Badge débloqué : {badge.icon} {badge.name}",
                body=badge.description,
            )
            if badge.xp_reward > 0:
                await award_xp(db, user_id, "badge_bonus",
                              {"badge_id": badge_id}, multiplier=1.0)

    await db.commit()


# ── Daily challenge ────────────────────────────────────────────────────────────
CHALLENGE_POOL = [
    ("review_N_cards",     10,  25, "Révisez {n} cartes aujourd'hui"),
    ("review_N_cards",     20,  40, "Révisez {n} cartes aujourd'hui"),
    ("chat_N_messages",    3,   20, "Posez {n} questions au tuteur IA"),
    ("complete_exam",      1,   50, "Passez un examen aujourd'hui"),
    ("study_N_minutes",    15,  20, "Étudiez pendant {n} minutes"),
    ("study_N_minutes",    30,  35, "Étudiez pendant {n} minutes"),
    ("complete_module",    1,   30, "Terminez un module de parcours"),
    ("achieve_score_X",    70,  40, "Obtenez {n}% ou plus à un examen"),
]

async def get_or_create_daily_challenge(
    db: AsyncSession,
    user_id: str,
) -> dict:
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
        ctype, target, xp, label_template = random.choice(CHALLENGE_POOL)
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
```

---

## Step 3 — Wire XP awards into existing endpoints

In each of these files, add `award_xp()` call (fire-and-forget):

**`apps/api/app/api/v1/exams.py`** — after exam submission:
```python
import asyncio
from app.services.gamification_service import award_xp

# After session graded:
score_pct = session.score_over_20 / 20 if session.score_over_20 else 0
asyncio.create_task(award_xp(db, current_user.id, "exam_complete"))
if score_pct >= 0.6:
    asyncio.create_task(award_xp(db, current_user.id, "exam_score_60"))
if score_pct >= 0.8:
    asyncio.create_task(award_xp(db, current_user.id, "exam_score_80"))
if score_pct == 1.0:
    asyncio.create_task(award_xp(db, current_user.id, "exam_perfect"))
```

**`apps/api/app/api/v1/flashcards.py`** — after review submission:
```python
asyncio.create_task(award_xp(db, current_user.id, "flashcard_review",
                             {"card_id": card_id, "rating": rating}))
```

**`apps/api/app/api/v1/chat.py`** — after message saved:
```python
asyncio.create_task(award_xp(db, current_user.id, "chat_message"))
```

**`apps/api/app/api/v1/me.py`** — in login/session endpoint:
```python
asyncio.create_task(award_xp(db, current_user.id, "daily_login"))
```

---

## Step 4 — Group leaderboard endpoint

Add to `apps/api/app/api/v1/groups.py`:

```
GET /groups/{group_id}/leaderboard
  — returns top 10 members by total XP
  — includes current user's rank even if not top 10
  — response: {
      members: [{rank, user_id, name, avatar_url, total_xp, level, level_title}],
      my_rank: int,
      my_xp: int
    }
```

---

## Step 5 — Gamification API endpoints

Add to `apps/api/app/api/v1/me.py`:

```
GET /me/xp              — {total_xp, level, level_title, xp_to_next_level, recent_xp_log}
GET /me/badges          — {earned: [...], total_count, latest_badge}
GET /me/challenge/today — today's daily challenge with progress
POST /me/challenge/today/progress — update challenge progress {type, increment}
```

---

## Step 6 — Startup badge seeding

In `apps/api/app/main.py`, on startup:
```python
@app.on_event("startup")
async def startup():
    async with async_session() as db:
        from app.services.gamification_service import seed_badges
        await seed_badges(db)
```

---

## Verification
```bash
python -c "
from app.services.gamification_service import compute_level, XP_VALUES
print(f'XP values: {len(XP_VALUES)} reasons defined')
print(f'Level at 0 XP: {compute_level(0)}')
print(f'Level at 1000 XP: {compute_level(1000)}')
print(f'Level at 10000 XP: {compute_level(10000)}')
print('Gamification: OK')
"
```
