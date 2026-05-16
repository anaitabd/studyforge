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
    extra: Mapped[dict] = mapped_column(JSONB, default={})
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
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(50))
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    rarity: Mapped[str] = mapped_column(String(20), default="common")


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
    target: Mapped[int] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    xp_reward: Mapped[int] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
