"""add_performance_indexes

Revision ID: 41e24b0a4dff
Revises: f63d1396049e
Create Date: 2026-05-16 01:42:15.763040

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41e24b0a4dff'
down_revision: Union[str, None] = 'f63d1396049e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_chat_messages_group_id", "chat_messages", ["group_id"], if_not_exists=True)
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"], if_not_exists=True)
    op.create_index("ix_exam_sessions_user_id", "exam_sessions", ["user_id"], if_not_exists=True)
    op.create_index("ix_exam_sessions_exam_id", "exam_sessions", ["exam_id"], if_not_exists=True)
    op.create_index("ix_flashcard_progress_user_id", "flashcard_progress", ["user_id"], if_not_exists=True)
    op.create_index("ix_flashcard_progress_due_date", "flashcard_progress", ["due_date"], if_not_exists=True)
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"], if_not_exists=True)
    op.create_index("ix_files_group_id_status", "files", ["group_id", "status"], if_not_exists=True)
    op.create_index("ix_knowledge_concepts_file_id", "knowledge_concepts", ["file_id"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_knowledge_concepts_file_id", table_name="knowledge_concepts", if_exists=True)
    op.drop_index("ix_files_group_id_status", table_name="files", if_exists=True)
    op.drop_index("ix_user_badges_user_id", table_name="user_badges", if_exists=True)
    op.drop_index("ix_flashcard_progress_due_date", table_name="flashcard_progress", if_exists=True)
    op.drop_index("ix_flashcard_progress_user_id", table_name="flashcard_progress", if_exists=True)
    op.drop_index("ix_exam_sessions_exam_id", table_name="exam_sessions", if_exists=True)
    op.drop_index("ix_exam_sessions_user_id", table_name="exam_sessions", if_exists=True)
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages", if_exists=True)
    op.drop_index("ix_chat_messages_group_id", table_name="chat_messages", if_exists=True)
