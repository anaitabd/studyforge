"""user_events hypertable via TimescaleDB

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-11 00:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_events",
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("org_id", sa.String(36), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(36), nullable=True),
        sa.Column("metadata", JSONB, nullable=True, server_default="{}"),
    )
    op.create_index("ix_user_events_user_id", "user_events", ["user_id"])
    op.create_index("ix_user_events_org_id", "user_events", ["org_id"])
    op.create_index("ix_user_events_event_type", "user_events", ["event_type"])

    # Install TimescaleDB extension and convert user_events to a hypertable.
    # Skipped gracefully if TimescaleDB is not preloaded — table works as plain OLTP.
    # Must check shared_preload_libraries first: CREATE EXTENSION raises a FATAL (kills the
    # connection entirely) when the library isn't preloaded, not a regular SQL error.
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT setting FROM pg_settings WHERE name = 'shared_preload_libraries'"
    ))
    preloaded = result.scalar() or ""
    if "timescaledb" in preloaded:
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"))
        conn.execute(sa.text(
            "SELECT create_hypertable('user_events', 'time', if_not_exists => TRUE)"
        ))


def downgrade() -> None:
    op.drop_index("ix_user_events_event_type", table_name="user_events")
    op.drop_index("ix_user_events_org_id", table_name="user_events")
    op.drop_index("ix_user_events_user_id", table_name="user_events")
    op.drop_table("user_events")
