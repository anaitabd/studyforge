from fastapi import APIRouter, Request, HTTPException
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/webhook")
async def clerk_webhook(request: Request):
    """Clerk webhook to sync users to the database."""
    payload = await request.body()
    headers = dict(request.headers)
    # TODO: Implement svix signature verification and user sync
    return {"status": "ok"}
