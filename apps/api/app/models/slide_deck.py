import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SlideDeck(Base):
    __tablename__ = "slide_decks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    course_name: Mapped[str] = mapped_column(String(255), default="")
    professor_name: Mapped[str] = mapped_column(String(255), default="")
    style: Mapped[str] = mapped_column(String(40), default="academic")
    language: Mapped[str] = mapped_column(String(10), default="en")
    file_ids: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="generating")  # generating|ready|error
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    slide_count: Mapped[int] = mapped_column(Integer, default=0)
    pptx_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Slide(Base):
    __tablename__ = "slides"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deck_id: Mapped[str] = mapped_column(String(36), ForeignKey("slide_decks.id", ondelete="CASCADE"), index=True)
    order_index: Mapped[int] = mapped_column(Integer, index=True)
    slide_type: Mapped[str] = mapped_column(String(40), default="content")  # title|section|content|definition|example|quiz|summary
    title: Mapped[str] = mapped_column(String(255))
    bullets: Mapped[list] = mapped_column(JSONB, default=list)
    detailed_explanation: Mapped[str] = mapped_column(Text, default="")
    examples: Mapped[list] = mapped_column(JSONB, default=list)
    speaker_notes: Mapped[str] = mapped_column(Text, default="")
    source_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_pages: Mapped[list] = mapped_column(JSONB, default=list)
    quiz: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class SlideProgress(Base):
    __tablename__ = "slide_progress"
    __table_args__ = (UniqueConstraint("deck_id", "user_id", name="uq_slide_progress_deck_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deck_id: Mapped[str] = mapped_column(String(36), ForeignKey("slide_decks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    current_slide_index: Mapped[int] = mapped_column(Integer, default=0)
    completed_slide_ids: Mapped[list] = mapped_column(JSONB, default=list)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SlideQuizAnswer(Base):
    __tablename__ = "slide_quiz_answers"
    __table_args__ = (UniqueConstraint("slide_id", "user_id", name="uq_slide_quiz_slide_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slide_id: Mapped[str] = mapped_column(String(36), ForeignKey("slides.id", ondelete="CASCADE"), index=True)
    deck_id: Mapped[str] = mapped_column(String(36), ForeignKey("slide_decks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    selected_index: Mapped[int] = mapped_column(Integer)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
