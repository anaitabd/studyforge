import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rate_limiter import rate_limiter
from app.models.chat import ChatMessage
from app.models.group import GroupMember
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

# Reusable annotated dependency aliases
CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


class ChatRequest(BaseModel):
    message: str
    language: str = "auto"
    room_id: str | None = None


async def _verify_group_member(group_id: str, user_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this group")


@router.post(
    "/groups/{group_id}/chat",
    responses={
        403: {"description": "Not a member of this group"},
        429: {"description": "Daily chat limit reached"},
    },
)
async def send_message(
    group_id: str,
    body: ChatRequest,
    current_user: CurrentUser,
    db: DB,
):
    await _verify_group_member(group_id, current_user.id, db)

    # Rate limit check
    allowed, current_count, limit = await rate_limiter.check_and_increment(
        user_id=current_user.id,
        plan=current_user.plan,
        limit_key="chat_per_day",
        window="day",
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "limit_exceeded",
                "limit_key": "chat_per_day",
                "current": current_count,
                "limit": limit,
                "current_plan": current_user.plan,
                "message": f"Daily chat limit ({limit}) reached. Upgrade your plan for more messages.",
            },
        )

    # Fetch last 10 chat turns for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.group_id == group_id, ChatMessage.room_id == body.room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history_msgs = list(reversed(history_result.scalars().all()))
    chat_history = [
        {"role": msg.role, "content": msg.content} for msg in history_msgs
    ]

    # Save user message to DB now (AI message saved after streaming)
    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        group_id=group_id,
        user_id=current_user.id,
        room_id=body.room_id,
        content=body.message,
        role="user",
    )
    db.add(user_msg)
    await db.commit()

    async def event_stream():
        full_content = ""
        citations = []

        try:
            async for event in rag_service.query(
                group_id=group_id,
                user_message=body.message,
                chat_history=chat_history,
                language=body.language,
            ):
                if event["type"] == "token":
                    full_content += event["content"]
                elif event["type"] == "citations":
                    citations = event["data"]
                elif event["type"] == "error":
                    full_content = event["content"]

                yield f"data: {json.dumps(event)}\n\n"

            # Save AI response to DB after stream completes
            ai_msg = ChatMessage(
                id=str(uuid.uuid4()),
                group_id=group_id,
                user_id=None,
                room_id=body.room_id,
                content=full_content,
                role="assistant",
                citations=citations,
            )
            async with db.begin():
                db.add(ai_msg)

        except Exception as e:
            logger.error(f"Stream error for group {group_id}: {e}")
            error_event = {"type": "error", "content": "Stream failed. Please retry."}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get(
    "/groups/{group_id}/chat/history",
    responses={403: {"description": "Not a member of this group"}},
)
async def get_chat_history(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
    page: int = 1,
    limit: int = 50,
    room_id: str | None = None,
):
    await _verify_group_member(group_id, current_user.id, db)

    offset = (page - 1) * limit
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.group_id == group_id, ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    messages = result.scalars().all()

    return {
        "messages": [
            {
                "id": m.id,
                "content": m.content,
                "role": m.role,
                "user_id": m.user_id,
                "citations": m.citations,
                "is_pinned": m.is_pinned,
                "room_id": m.room_id,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "page": page,
        "limit": limit,
    }


@router.post(
    "/groups/{group_id}/chat/messages/{message_id}/pin",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "Message not found"},
    },
)
async def toggle_pin(
    group_id: str,
    message_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await _verify_group_member(group_id, current_user.id, db)

    result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.id == message_id,
            ChatMessage.group_id == group_id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.is_pinned = not msg.is_pinned
    await db.commit()

    return {"id": message_id, "is_pinned": msg.is_pinned}


@router.get(
    "/groups/{group_id}/chat/pinned",
    responses={403: {"description": "Not a member of this group"}},
)
async def get_pinned_messages(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await _verify_group_member(group_id, current_user.id, db)

    result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.group_id == group_id,
            ChatMessage.is_pinned == True,
        ).order_by(ChatMessage.created_at.desc())
    )
    messages = result.scalars().all()

    return {
        "pinned": [
            {
                "id": m.id,
                "content": m.content,
                "role": m.role,
                "citations": m.citations,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
    }
