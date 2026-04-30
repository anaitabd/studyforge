from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/schools")
async def list_schools(current_user=Depends(get_current_user)):
    return {"schools": []}
