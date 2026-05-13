"""moroccan exam columns: points, rubric, subject_area, level, grading

Revision ID: a3e5b7c9d1f2
Revises: f2c4d6e8a0b1
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "a3e5b7c9d1f2"
down_revision: Union[str, None] = "f2c4d6e8a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # exams
    op.add_column("exams", sa.Column("total_points", sa.Float(), nullable=False, server_default="20.0"))
    op.add_column("exams", sa.Column("subject_area", sa.String(50), nullable=True))
    op.add_column("exams", sa.Column("level", sa.String(20), nullable=True))
    op.add_column("exams", sa.Column("grading_mode", sa.String(20), nullable=False, server_default="auto"))

    # questions
    op.add_column("questions", sa.Column("points", sa.Float(), nullable=False, server_default="1.0"))
    op.add_column("questions", sa.Column("rubric", JSONB(), nullable=True))
    op.add_column("questions", sa.Column("subject_area", sa.String(50), nullable=True))
    op.add_column("questions", sa.Column("construction_steps", JSONB(), nullable=True))

    # exam_sessions
    op.add_column("exam_sessions", sa.Column("score_over_20", sa.Float(), nullable=True))
    op.add_column("exam_sessions", sa.Column("per_question_scores", JSONB(), nullable=True))
    op.add_column("exam_sessions", sa.Column("grading_status", sa.String(20), nullable=False, server_default="pending"))


def downgrade() -> None:
    # exam_sessions
    op.drop_column("exam_sessions", "grading_status")
    op.drop_column("exam_sessions", "per_question_scores")
    op.drop_column("exam_sessions", "score_over_20")

    # questions
    op.drop_column("questions", "construction_steps")
    op.drop_column("questions", "subject_area")
    op.drop_column("questions", "rubric")
    op.drop_column("questions", "points")

    # exams
    op.drop_column("exams", "grading_mode")
    op.drop_column("exams", "level")
    op.drop_column("exams", "subject_area")
    op.drop_column("exams", "total_points")
