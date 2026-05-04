import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.file import File
from app.models.group import GroupMember
from app.services.storage_service import storage_service
from app.services.vector_store import vector_store
from app.tasks.file_tasks import process_file_task

logger = logging.getLogger(__name__)
router = APIRouter(tags=["files"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Reusable annotated dependency aliases
CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


async def verify_group_member(group_id: str, user_id: str, db: AsyncSession):
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return member


@router.get(
    "/groups/{group_id}/files",
    responses={403: {"description": "Not a member of this group"}},
)
async def list_files(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await verify_group_member(group_id, current_user.id, db)
    result = await db.execute(
        select(File)
        .where(File.group_id == group_id)
        .order_by(File.created_at.desc())
    )
    files = result.scalars().all()
    return {
        "files": [
            {
                "id": f.id,
                "group_id": f.group_id,
                "name": f.name,
                "mime_type": f.mime_type,
                "size": f.size_bytes,
                "size_bytes": f.size_bytes,
                "status": f.status,
                "error_message": f.error_message,
                "chunk_count": f.chunk_count,
                "indexed_at": f.indexed_at.isoformat() if f.indexed_at else None,
                "created_at": f.created_at.isoformat(),
            }
            for f in files
        ]
    }


@router.post(
    "/groups/{group_id}/files",
    responses={
        403: {"description": "Not a member of this group"},
        413: {"description": "File too large. Max 50MB."},
    },
)
async def upload_file(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
    file: Annotated[UploadFile, FastAPIFile(...)],
):
    await verify_group_member(group_id, current_user.id, db)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 50MB.")

    mime_type = file.content_type or "application/octet-stream"

    file_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    r2_key = f"groups/{group_id}/files/{file_id}.{ext}"

    await storage_service.upload_file(content, r2_key, mime_type)

    file_record = File(
        id=file_id,
        group_id=group_id,
        user_id=current_user.id,
        name=file.filename,
        r2_key=r2_key,
        mime_type=mime_type,
        size_bytes=len(content),
        status="uploading",
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    process_file_task.delay(file_id, r2_key, mime_type)

    logger.info(f"File {file_id} uploaded, processing queued")

    return {
        "id": file_record.id,
        "name": file_record.name,
        "status": file_record.status,
        "size_bytes": file_record.size_bytes,
        "message": "File uploaded. Processing started.",
    }


@router.get(
    "/groups/{group_id}/files/{file_id}/status",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "File not found"},
    },
)
async def get_file_status(
    group_id: str,
    file_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await verify_group_member(group_id, current_user.id, db)
    result = await db.execute(
        select(File).where(File.id == file_id, File.group_id == group_id)
    )
    file_obj = result.scalar_one_or_none()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")
    return {
        "id": file_obj.id,
        "status": file_obj.status,
        "error_message": file_obj.error_message,
        "chunk_count": file_obj.chunk_count,
        "indexed_at": file_obj.indexed_at.isoformat() if file_obj.indexed_at else None,
    }


@router.delete(
    "/groups/{group_id}/files/{file_id}",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "File not found"},
    },
)
async def delete_file(
    group_id: str,
    file_id: str,
    current_user: CurrentUser,
    db: DB,
):
    await verify_group_member(group_id, current_user.id, db)
    result = await db.execute(
        select(File).where(File.id == file_id, File.group_id == group_id)
    )
    file_obj = result.scalar_one_or_none()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        await storage_service.delete_file(file_obj.r2_key)
    except Exception as e:
        logger.warning(f"Could not delete R2 file {file_obj.r2_key}: {e}")

    vector_store.delete_file_chunks(group_id, file_id)

    await db.execute(delete(File).where(File.id == file_id))
    await db.commit()

    return {"message": "File deleted successfully"}


@router.get(
    "/groups/{group_id}/files/{file_id}/download",
    responses={
        403: {"description": "Not a member of this group"},
        404: {"description": "File not found"},
    },
)
async def get_download_url(
    group_id: str,
    file_id: str,
    current_user: CurrentUser,
    db: DB,
    expires_in: int = 3600,
):
    """Return a presigned URL the client can use to fetch the file directly from R2/MinIO."""
    await verify_group_member(group_id, current_user.id, db)
    result = await db.execute(select(File).where(File.id == file_id, File.group_id == group_id))
    file_obj = result.scalar_one_or_none()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    url = storage_service.get_presigned_url(file_obj.r2_key, expires_in=min(max(expires_in, 60), 86400))
    return {"url": url, "expires_in": expires_in, "name": file_obj.name, "mime_type": file_obj.mime_type}
