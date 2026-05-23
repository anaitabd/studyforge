"""add failed_tasks dead-letter table

Revision ID: a1b2c3d4e5f6
Revises: c4875d29c5a5
Create Date: 2026-05-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c4875d29c5a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "failed_tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(255), nullable=False, unique=True),
        sa.Column("task_name", sa.String(255), nullable=False),
        sa.Column("args", JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("retried_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_failed_tasks_task_id", "failed_tasks", ["task_id"])
    op.create_index("ix_failed_tasks_task_name", "failed_tasks", ["task_name"])
    op.create_index("ix_failed_tasks_created_at", "failed_tasks", ["created_at"])


def downgrade() -> None:
    op.drop_table("failed_tasks")
