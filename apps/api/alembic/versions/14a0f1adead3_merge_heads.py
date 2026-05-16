"""merge heads

Revision ID: 14a0f1adead3
Revises: a3e5b7c9d1f2, c4875d29c5a5
Create Date: 2026-05-13 02:33:34.726753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14a0f1adead3'
down_revision: Union[str, None] = ('a3e5b7c9d1f2', 'c4875d29c5a5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
