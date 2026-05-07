"""slide decks

Revision ID: d9f2a1c4b8e3
Revises: 3c0333513b97
Create Date: 2026-05-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd9f2a1c4b8e3'
down_revision: Union[str, None] = '3c0333513b97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'slide_decks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('group_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('course_name', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('professor_name', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('style', sa.String(length=40), nullable=False, server_default='academic'),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='en'),
        sa.Column('file_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='generating'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('slide_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pptx_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_slide_decks_group_id'), 'slide_decks', ['group_id'], unique=False)
    op.create_index(op.f('ix_slide_decks_user_id'), 'slide_decks', ['user_id'], unique=False)

    op.create_table(
        'slides',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('deck_id', sa.String(length=36), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('slide_type', sa.String(length=40), nullable=False, server_default='content'),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('bullets', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('detailed_explanation', sa.Text(), nullable=False, server_default=''),
        sa.Column('examples', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('speaker_notes', sa.Text(), nullable=False, server_default=''),
        sa.Column('source_file', sa.String(length=255), nullable=True),
        sa.Column('source_pages', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('quiz', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['deck_id'], ['slide_decks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_slides_deck_id'), 'slides', ['deck_id'], unique=False)
    op.create_index(op.f('ix_slides_order_index'), 'slides', ['order_index'], unique=False)

    op.create_table(
        'slide_progress',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('deck_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('current_slide_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_slide_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['deck_id'], ['slide_decks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('deck_id', 'user_id', name='uq_slide_progress_deck_user'),
    )
    op.create_index(op.f('ix_slide_progress_deck_id'), 'slide_progress', ['deck_id'], unique=False)
    op.create_index(op.f('ix_slide_progress_user_id'), 'slide_progress', ['user_id'], unique=False)

    op.create_table(
        'slide_quiz_answers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('slide_id', sa.String(length=36), nullable=False),
        sa.Column('deck_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('selected_index', sa.Integer(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('answered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['slide_id'], ['slides.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['deck_id'], ['slide_decks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slide_id', 'user_id', name='uq_slide_quiz_slide_user'),
    )
    op.create_index(op.f('ix_slide_quiz_answers_slide_id'), 'slide_quiz_answers', ['slide_id'], unique=False)
    op.create_index(op.f('ix_slide_quiz_answers_deck_id'), 'slide_quiz_answers', ['deck_id'], unique=False)
    op.create_index(op.f('ix_slide_quiz_answers_user_id'), 'slide_quiz_answers', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_slide_quiz_answers_user_id'), table_name='slide_quiz_answers')
    op.drop_index(op.f('ix_slide_quiz_answers_deck_id'), table_name='slide_quiz_answers')
    op.drop_index(op.f('ix_slide_quiz_answers_slide_id'), table_name='slide_quiz_answers')
    op.drop_table('slide_quiz_answers')

    op.drop_index(op.f('ix_slide_progress_user_id'), table_name='slide_progress')
    op.drop_index(op.f('ix_slide_progress_deck_id'), table_name='slide_progress')
    op.drop_table('slide_progress')

    op.drop_index(op.f('ix_slides_order_index'), table_name='slides')
    op.drop_index(op.f('ix_slides_deck_id'), table_name='slides')
    op.drop_table('slides')

    op.drop_index(op.f('ix_slide_decks_user_id'), table_name='slide_decks')
    op.drop_index(op.f('ix_slide_decks_group_id'), table_name='slide_decks')
    op.drop_table('slide_decks')
