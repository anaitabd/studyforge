"""Cohorts, assignments, study_goals, streak_records, kpi_cache tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-11 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cohorts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("org_id", sa.String(36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_cohorts_org_id", "cohorts", ["org_id"])

    op.create_table(
        "cohort_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cohort_id", sa.String(36), sa.ForeignKey("cohorts.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="student"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("cohort_id", "user_id", name="uq_cohort_member"),
    )
    op.create_index("ix_cohort_members_cohort_id", "cohort_members", ["cohort_id"])
    op.create_index("ix_cohort_members_user_id", "cohort_members", ["user_id"])

    op.create_table(
        "assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cohort_id", sa.String(36), sa.ForeignKey("cohorts.id"), nullable=False),
        sa.Column("creator_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resource_type", sa.String(20), nullable=False),
        sa.Column("resource_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_assignments_cohort_id", "assignments", ["cohort_id"])

    op.create_table(
        "assignment_progress",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("assignment_id", sa.String(36), sa.ForeignKey("assignments.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="not_started"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("feedback", sa.Text, nullable=True),
        sa.UniqueConstraint("assignment_id", "user_id", name="uq_assignment_progress"),
    )
    op.create_index("ix_assignment_progress_assignment_id", "assignment_progress", ["assignment_id"])
    op.create_index("ix_assignment_progress_user_id", "assignment_progress", ["user_id"])

    op.create_table(
        "study_goals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("target_date", sa.Date, nullable=True),
        sa.Column("target_score", sa.Float, nullable=True),
        sa.Column("subject", sa.String(255), nullable=True),
        sa.Column("file_ids", JSONB, nullable=True, server_default="[]"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_study_goals_user_id", "study_goals", ["user_id"])

    op.create_table(
        "streak_records",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("has_activity", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("user_id", "date"),
    )

    op.create_table(
        "kpi_cache",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_id", sa.String(36), nullable=False),
        sa.Column("metric_key", sa.String(100), nullable=False),
        sa.Column("metric_value", sa.Float, nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("date", sa.Date, nullable=False),
        sa.UniqueConstraint("scope_type", "scope_id", "metric_key", "date", name="uq_kpi_cache"),
    )
    op.create_index("ix_kpi_cache_scope_type", "kpi_cache", ["scope_type"])
    op.create_index("ix_kpi_cache_scope_id", "kpi_cache", ["scope_id"])


def downgrade() -> None:
    op.drop_index("ix_kpi_cache_scope_id", table_name="kpi_cache")
    op.drop_index("ix_kpi_cache_scope_type", table_name="kpi_cache")
    op.drop_table("kpi_cache")
    op.drop_table("streak_records")
    op.drop_index("ix_study_goals_user_id", table_name="study_goals")
    op.drop_table("study_goals")
    op.drop_index("ix_assignment_progress_user_id", table_name="assignment_progress")
    op.drop_index("ix_assignment_progress_assignment_id", table_name="assignment_progress")
    op.drop_table("assignment_progress")
    op.drop_index("ix_assignments_cohort_id", table_name="assignments")
    op.drop_table("assignments")
    op.drop_index("ix_cohort_members_user_id", table_name="cohort_members")
    op.drop_index("ix_cohort_members_cohort_id", table_name="cohort_members")
    op.drop_table("cohort_members")
    op.drop_index("ix_cohorts_org_id", table_name="cohorts")
    op.drop_table("cohorts")
