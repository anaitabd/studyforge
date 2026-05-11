import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Float, Text, func, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cohort_id: Mapped[str] = mapped_column(String(36), ForeignKey("cohorts.id"), index=True)
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    resource_type: Mapped[str] = mapped_column(String(20))  # exam | learning_path
    resource_id: Mapped[str] = mapped_column(String(36))
    title: Mapped[str] = mapped_column(String(255))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<Assignment cohort={self.cohort_id} title={self.title}>"


class AssignmentProgress(Base):
    __tablename__ = "assignment_progress"
    __table_args__ = (UniqueConstraint("assignment_id", "user_id", name="uq_assignment_progress"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="not_started")  # not_started | in_progress | submitted | graded
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<AssignmentProgress assignment={self.assignment_id} user={self.user_id} status={self.status}>"
