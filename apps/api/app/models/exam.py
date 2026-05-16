import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id"), index=True)
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))
    config: Mapped[dict] = mapped_column(JSONB, default={})
    status: Mapped[str] = mapped_column(String(20), default="draft")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempt_limit: Mapped[int] = mapped_column(Integer, default=1)
    total_points: Mapped[float] = mapped_column(Float, default=20.0)
    subject_area: Mapped[str | None] = mapped_column(String(50), nullable=True)
    level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    grading_mode: Mapped[str] = mapped_column(String(20), default="auto")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_id: Mapped[str] = mapped_column(String(36), ForeignKey("exams.id"), index=True)
    type: Mapped[str] = mapped_column(String(30), default="mcq_single")
    content: Mapped[str] = mapped_column(Text)
    options: Mapped[dict] = mapped_column(JSONB, default={})
    correct_answer: Mapped[str] = mapped_column(String(10))
    explanation: Mapped[str] = mapped_column(Text)
    source_passage: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    points: Mapped[float] = mapped_column(Float, default=1.0)
    rubric: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    subject_area: Mapped[str | None] = mapped_column(String(50), nullable=True)
    construction_steps: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_id: Mapped[str] = mapped_column(String(36), ForeignKey("exams.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    answers: Mapped[dict] = mapped_column(JSONB, default={})
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_over_20: Mapped[float | None] = mapped_column(Float, nullable=True)
    per_question_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    grading_status: Mapped[str] = mapped_column(String(20), default="pending")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_spent_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
