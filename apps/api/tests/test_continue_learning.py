import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from app.services import learning_path_service


def _result(rows):
    """Build a mock SQLAlchemy Result with .scalars().all() and .all() shapes used by the service."""
    res = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = rows
    res.scalars.return_value = scalars
    res.all.return_value = rows
    return res


@pytest.mark.asyncio
async def test_continue_learning_returns_empty_for_no_groups():
    db = MagicMock()
    db.execute = AsyncMock(return_value=_result([]))
    items = await learning_path_service.get_continue_learning(db, "user-1", limit=6)
    assert items == []


@pytest.mark.asyncio
async def test_continue_learning_excludes_fully_completed_paths():
    """A path with all modules completed is filtered out."""
    user_id = "user-1"
    now = datetime.now(timezone.utc)

    # Mock objects
    path1 = MagicMock(
        id="path-1",
        group_id="group-1",
        title="In progress",
        summary="x",
        created_at=now - timedelta(days=2),
    )
    path2 = MagicMock(
        id="path-2",
        group_id="group-1",
        title="All done",
        summary="y",
        created_at=now - timedelta(days=1),
    )

    call_results = [
        _result(["group-1"]),                               # member group ids
        _result([(path1, "Group 1"), (path2, "Group 1")]),  # paths join groups
        _result([                                            # modules
            ("m1", "path-1", 0, "Mod 1"),
            ("m2", "path-1", 1, "Mod 2"),
            ("m3", "path-2", 0, "Only mod"),
        ]),
        _result([                                            # progress
            ("path-1", "m1", now),
            ("path-2", "m3", now - timedelta(hours=3)),
        ]),
    ]

    db = MagicMock()
    db.execute = AsyncMock(side_effect=call_results)

    items = await learning_path_service.get_continue_learning(db, user_id, limit=6)
    # path-2 is fully complete (1/1), should be excluded.
    assert len(items) == 1
    assert items[0]["path_id"] == "path-1"
    assert items[0]["completed_modules"] == 1
    assert items[0]["module_count"] == 2
    assert items[0]["next_module_id"] == "m2"
    assert items[0]["next_module_title"] == "Mod 2"


@pytest.mark.asyncio
async def test_continue_learning_orders_in_progress_before_untouched():
    """Paths with completed modules come before paths with no progress."""
    user_id = "user-1"
    now = datetime.now(timezone.utc)

    p_untouched = MagicMock(
        id="p-untouched",
        group_id="g",
        title="Untouched (newer)",
        summary=None,
        created_at=now,
    )
    p_started = MagicMock(
        id="p-started",
        group_id="g",
        title="Started (older)",
        summary=None,
        created_at=now - timedelta(days=10),
    )

    call_results = [
        _result(["g"]),
        _result([(p_untouched, "G"), (p_started, "G")]),
        _result([
            ("ma", "p-untouched", 0, "Mod A"),
            ("mb", "p-untouched", 1, "Mod B"),
            ("mc", "p-started", 0, "Mod C"),
            ("md", "p-started", 1, "Mod D"),
        ]),
        _result([("p-started", "mc", now - timedelta(hours=1))]),
    ]

    db = MagicMock()
    db.execute = AsyncMock(side_effect=call_results)

    items = await learning_path_service.get_continue_learning(db, user_id, limit=6)
    assert [it["path_id"] for it in items] == ["p-started", "p-untouched"]
