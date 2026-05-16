import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Boolean, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class LiveQuiz(Base):
    """A teacher-hosted live quiz session."""
    __tablename__ = "live_quizzes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"))
    host_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    exam_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("exams.id"), nullable=True)
    pin: Mapped[str] = mapped_column(String(6), unique=True)  # 6-digit join code
    status: Mapped[str] = mapped_column(String(20), default="lobby")
    # lobby | question_N | results_N | finished
    current_question_index: Mapped[int] = mapped_column(Integer, default=-1)
    question_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    question_time_limit_seconds: Mapped[int] = mapped_column(Integer, default=30)
    settings: Mapped[dict] = mapped_column(JSONB, default={})
    # settings: {show_leaderboard_after_each: bool, points_for_speed: bool, allow_rejoin: bool}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LiveQuizParticipant(Base):
    __tablename__ = "live_quiz_participants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: Mapped[str] = mapped_column(String(36), ForeignKey("live_quizzes.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    nickname: Mapped[str] = mapped_column(String(50))
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LiveQuizAnswer(Base):
    __tablename__ = "live_quiz_answers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quiz_id: Mapped[str] = mapped_column(String(36), ForeignKey("live_quizzes.id", ondelete="CASCADE"))
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("live_quiz_participants.id"))
    question_index: Mapped[int] = mapped_column(Integer)
    answer: Mapped[str] = mapped_column(String(200))
    is_correct: Mapped[bool] = mapped_column(Boolean)
    response_time_ms: Mapped[int] = mapped_column(Integer)  # milliseconds to answer
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
