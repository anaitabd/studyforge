import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def _write_event(
    user_id: str,
    org_id: str | None,
    event_type: str,
    resource_type: str | None,
    resource_id: str | None,
    metadata: dict | None,
) -> None:
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(
                text(
                    """
                    INSERT INTO user_events
                        (time, user_id, org_id, event_type, resource_type, resource_id, metadata)
                    VALUES
                        (:time, :user_id, :org_id, :event_type, :resource_type, :resource_id, CAST(:metadata AS jsonb))
                    """
                ),
                {
                    "time": datetime.now(timezone.utc),
                    "user_id": user_id,
                    "org_id": org_id,
                    "event_type": event_type,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "metadata": json.dumps(metadata or {}),
                },
            )
            await db.commit()
    except Exception as exc:
        logger.warning("Failed to track event %s for user %s: %s", event_type, user_id, exc)


async def track_event(
    user_id: str,
    org_id: str | None = None,
    event_type: str = "",
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    """
    Fire-and-forget analytics event write. Never blocks the caller.
    Wraps the write in asyncio.create_task so the request returns immediately.
    """
    asyncio.create_task(
        _write_event(user_id, org_id, event_type, resource_type, resource_id, metadata)
    )
