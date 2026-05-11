import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sso_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {provider, entity_id, sso_url, certificate}
    custom_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    brand_colors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    billing_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    admin_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    wa_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    wa_api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Organization slug={self.slug} name={self.name}>"
