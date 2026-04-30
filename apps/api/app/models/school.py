import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class School(Base):
    __tablename__ = "schools"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    admin_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    wa_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    wa_api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
