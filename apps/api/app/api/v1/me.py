import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.services import learning_path_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/me", tags=["me"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/continue-learning")
async def continue_learning(
    current_user: CurrentUser,
    db: DB,
    limit: int = 6,
):
    limit = max(1, min(limit, 20))
    items = await learning_path_service.get_continue_learning(
        db=db, user_id=current_user.id, limit=limit
    )
    return {"items": items}
