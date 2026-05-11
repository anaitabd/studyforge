from datetime import datetime
from pydantic import BaseModel, Field


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    industry: str | None = None
    size_range: str | None = None
    billing_email: str | None = None


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    logo_url: str | None = None
    industry: str | None = None
    size_range: str | None = None
    custom_domain: str | None = None
    brand_colors: dict | None = None
    billing_email: str | None = None
    wa_number: str | None = None


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: str | None
    industry: str | None
    size_range: str | None
    custom_domain: str | None
    brand_colors: dict | None
    billing_email: str | None
    admin_user_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberInvite(BaseModel):
    email: str
    role: str = Field(default="student", pattern=r"^(admin|teacher|student|viewer)$")


class BulkInvite(BaseModel):
    emails: list[str] = Field(..., min_length=1, max_length=100)
    role: str = Field(default="student", pattern=r"^(admin|teacher|student|viewer)$")


class MemberRoleUpdate(BaseModel):
    role: str = Field(..., pattern=r"^(admin|teacher|student|viewer)$")


class CohortCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    subject: str | None = None
    start_date: str | None = None  # ISO date
    end_date: str | None = None    # ISO date


class CohortUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    subject: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_archived: bool | None = None


class CohortMemberAdd(BaseModel):
    user_id: str
    role: str = Field(default="student", pattern=r"^(teacher|student)$")


class AssignmentCreate(BaseModel):
    resource_type: str = Field(..., pattern=r"^(exam|learning_path)$")
    resource_id: str
    title: str = Field(..., min_length=1, max_length=255)
    due_at: str | None = None       # ISO datetime
    instructions: str | None = None
