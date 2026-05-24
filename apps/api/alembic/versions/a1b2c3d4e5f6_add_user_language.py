"""add_user_language

Revision ID: a1b2c3d4e5f6
Revises: f63d1396049e
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f63d1396049e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('language', sa.String(10), nullable=False, server_default='fr'))


def downgrade() -> None:
    op.drop_column('users', 'language')
