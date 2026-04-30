from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/reading-event")
async def track_reading(current_user=Depends(get_current_user)):
    return {"message": "TODO"}
