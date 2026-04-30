from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(tags=["exams"])


@router.post("/groups/{group_id}/exams/generate")
async def generate_exam(group_id: str, current_user=Depends(get_current_user)):
    return {"message": "TODO"}
