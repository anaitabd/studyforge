"""add_bac_tables

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-24 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bac_papers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('year', sa.Integer(), nullable=False, index=True),
        sa.Column('branch', sa.String(20), nullable=False, index=True),
        sa.Column('subject', sa.String(100), nullable=False, index=True),
        sa.Column('region', sa.String(20), nullable=False, server_default='nationale'),
        sa.Column('session', sa.String(20), nullable=False, server_default='normale'),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='120'),
        sa.Column('total_points', sa.Float(), nullable=False, server_default='20'),
        sa.Column('file_id', sa.String(36), nullable=True),
        sa.Column('extraction_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'bac_questions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('paper_id', sa.String(36), sa.ForeignKey('bac_papers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('part_label', sa.String(100), nullable=True),
        sa.Column('type', sa.String(30), nullable=False, server_default='open_calculation'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('options', postgresql.JSONB(), nullable=True),
        sa.Column('correct_answer', sa.Text(), nullable=False, server_default=''),
        sa.Column('explanation_fr', sa.Text(), nullable=False, server_default=''),
        sa.Column('explanation_ar', sa.Text(), nullable=False, server_default=''),
        sa.Column('rubric', postgresql.JSONB(), nullable=True),
        sa.Column('points', sa.Float(), nullable=False, server_default='1'),
        sa.Column('subject_area', sa.String(100), nullable=True),
    )

    op.create_table(
        'bac_practice_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('paper_id', sa.String(36), sa.ForeignKey('bac_papers.id'), nullable=False, index=True),
        sa.Column('answers', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('per_question_scores', postgresql.JSONB(), nullable=True),
        sa.Column('score_over_20', sa.Float(), nullable=True),
        sa.Column('grading_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='120'),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('time_spent_s', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('bac_practice_sessions')
    op.drop_table('bac_questions')
    op.drop_table('bac_papers')
