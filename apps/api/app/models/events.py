"""
UserEvent is intentionally non-ORM — it lives in a TimescaleDB hypertable.
All writes go through analytics_service.track_event via raw SQL.
This module exists only for documentation / type reference.
"""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class UserEvent:
    time: datetime
    user_id: str
    org_id: str | None
    event_type: str
    resource_type: str | None
    resource_id: str | None
    metadata: dict
