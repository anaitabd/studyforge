"""admin tables: audit_logs and feature_flags

Revision ID: f2c4d6e8a0b1
Revises: e1f3a2b5c7d8
Create Date: 2026-05-10 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "f2c4d6e8a0b1"
down_revision: Union[str, None] = "e1f3a2b5c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), nullable=False, index=True),
        sa.Column("target_id", sa.String(36), nullable=True, index=True),
        sa.Column("action", sa.String(100), nullable=False, index=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("meta", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    op.create_table(
        "feature_flags",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("enabled", sa.Boolean, server_default=sa.false(), nullable=False),
        sa.Column("enabled_for_plans", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("""
        INSERT INTO feature_flags (key, label, description, enabled, enabled_for_plans) VALUES
        ('ai_study_coach', 'AI Study Coach', 'Personalized AI tutoring suggestions', false, '["school"]'),
        ('peer_review', 'Peer Review', 'Student-to-student exam review flow', false, '["school", "personal"]'),
        ('live_sessions', 'Live Sessions', 'Real-time collaborative study rooms', false, '[]'),
        ('advanced_analytics', 'Advanced Analytics', 'Detailed engagement analytics for teachers', false, '["school"]')
    """)


def downgrade() -> None:
    op.drop_table("feature_flags")
    op.drop_table("audit_logs")
