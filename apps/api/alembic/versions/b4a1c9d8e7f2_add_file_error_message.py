"""add file error message

Revision ID: b4a1c9d8e7f2
Revises: 7b2a0c02f90e
Create Date: 2026-05-03 00:29:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4a1c9d8e7f2"
down_revision: Union[str, None] = "7b2a0c02f90e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("files", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("files", "error_message")
