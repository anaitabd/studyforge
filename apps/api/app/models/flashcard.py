import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Float, Integer, Text, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id"), index=True)
    file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    set_id: Mapped[str] = mapped_column(String(36), ForeignKey("flashcard_sets.id"), index=True)
    front: Mapped[str] = mapped_column(Text)
    back: Mapped[str] = mapped_column(Text)
    source_passage: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class FlashcardProgress(Base):
    __tablename__ = "flashcard_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("flashcards.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    due_date: Mapped[date] = mapped_column(Date, default=date.today)
    reps: Mapped[int] = mapped_column(Integer, default=0)
