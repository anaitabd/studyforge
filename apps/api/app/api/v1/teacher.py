from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/groups/{group_id}/analytics")
async def get_analytics(group_id: str, current_user=Depends(get_current_user)):
    return {"message": "TODO"}
