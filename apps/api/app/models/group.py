import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Text, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    school_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("schools.id"), nullable=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    color: Mapped[str] = mapped_column(String(20), default="#1A3A5C")
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class GroupMember(Base):
    __tablename__ = "group_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="student")  # owner/teacher/student
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
