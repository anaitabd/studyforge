"""account fields

Revision ID: e1f3a2b5c7d8
Revises: d9f2a1c4b8e3
Create Date: 2026-05-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f3a2b5c7d8"
down_revision: Union[str, None] = "d9f2a1c4b8e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("notif_email", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("notif_whatsapp", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("notif_in_app", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("subscriptions", sa.Column("stripe_customer_id", sa.String(255), nullable=True))
    op.add_column("subscriptions", sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("subscriptions", "cancel_at_period_end")
    op.drop_column("subscriptions", "stripe_customer_id")
    op.drop_column("users", "notif_in_app")
    op.drop_column("users", "notif_whatsapp")
    op.drop_column("users", "notif_email")
    op.drop_column("users", "is_deleted")
    op.drop_column("users", "stripe_customer_id")
