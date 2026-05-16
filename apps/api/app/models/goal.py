import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Float, Boolean, func, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class StudyGoal(Base):
    __tablename__ = "study_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    target_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_ids: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | achieved | abandoned
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<StudyGoal user={self.user_id} title={self.title} status={self.status}>"


class StreakRecord(Base):
    __tablename__ = "streak_records"
    __table_args__ = (PrimaryKeyConstraint("user_id", "date"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    date: Mapped[date] = mapped_column(Date)
    has_activity: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<StreakRecord user={self.user_id} date={self.date}>"


class KpiCache(Base):
    __tablename__ = "kpi_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scope_type: Mapped[str] = mapped_column(String(20), index=True)  # org | cohort | user
    scope_id: Mapped[str] = mapped_column(String(36), index=True)
    metric_key: Mapped[str] = mapped_column(String(100))
    metric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date: Mapped[date] = mapped_column(Date)

    def __repr__(self) -> str:
        return f"<KpiCache {self.scope_type}:{self.scope_id} {self.metric_key}={self.metric_value}>"
