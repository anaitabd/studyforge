"""RBAC permissions table + organizations table + user org fields

Revision ID: a1b2c3d4e5f6
Revises: f2c4d6e8a0b1
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f2c4d6e8a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("size_range", sa.String(50), nullable=True),
        sa.Column("sso_config", JSONB, nullable=True),
        sa.Column("custom_domain", sa.String(255), nullable=True),
        sa.Column("brand_colors", JSONB, nullable=True),
        sa.Column("billing_email", sa.String(255), nullable=True),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("admin_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("wa_number", sa.String(50), nullable=True),
        sa.Column("wa_api_key", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    op.create_table(
        "permissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resource_type", sa.String(20), nullable=False),
        sa.Column("resource_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("granted_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("actor_id", "resource_type", "resource_id", name="uq_permission_actor_resource"),
    )
    op.create_index("ix_permissions_actor_id", "permissions", ["actor_id"])
    op.create_index("ix_permissions_resource_id", "permissions", ["resource_id"])

    op.add_column("users", sa.Column("org_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=True))
    op.add_column("users", sa.Column("account_type", sa.String(20), nullable=False, server_default="individual"))


def downgrade() -> None:
    op.drop_column("users", "account_type")
    op.drop_column("users", "org_id")
    op.drop_index("ix_permissions_resource_id", table_name="permissions")
    op.drop_index("ix_permissions_actor_id", table_name="permissions")
    op.drop_table("permissions")
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
