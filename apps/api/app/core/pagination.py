import base64
from datetime import datetime
from typing import Annotated, Generic, TypeVar

from fastapi import Depends, Query
from pydantic import BaseModel

T = TypeVar("T")


class PaginationParams:
    """Cursor-based pagination. Cursor encodes (created_at ISO | id) as base64."""

    def __init__(
        self,
        limit: int = Query(default=20, ge=1, le=100),
        cursor: str | None = Query(default=None, description="Opaque cursor from previous page's next_cursor"),
    ):
        self.limit = limit
        self._raw = cursor

    def decode(self) -> tuple[datetime | None, str | None]:
        """Returns (created_at, id) from cursor, or (None, None) for the first page."""
        if not self._raw:
            return None, None
        try:
            raw = base64.b64decode(self._raw.encode()).decode()
            ts, item_id = raw.split("|", 1)
            return datetime.fromisoformat(ts), item_id
        except Exception:
            return None, None


Pagination = Annotated[PaginationParams, Depends(PaginationParams)]


def encode_cursor(created_at: datetime, item_id: str) -> str:
    """Encode the last seen (created_at, id) pair into an opaque cursor string."""
    raw = f"{created_at.isoformat()}|{item_id}"
    return base64.b64encode(raw.encode()).decode()


class PageResponse(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    total: int
