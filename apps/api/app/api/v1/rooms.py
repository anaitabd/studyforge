from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("")
async def create_room(current_user=Depends(get_current_user)):
    return {"message": "TODO"}
