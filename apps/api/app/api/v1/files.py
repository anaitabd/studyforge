import base64
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File as FastAPIFile
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.file import File
from app.models.group import GroupMember
from app.services.ai_service import ai_service
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


def _file_type(mime_type: str) -> str:
    mt = (mime_type or "").lower()
    if mt == "application/pdf":
        return "pdf"
    if "wordprocessingml" in mt or mt == "application/msword":
        return "docx"
    if "presentationml" in mt or mt == "application/vnd.ms-powerpoint":
        return "pptx"
    if mt.startswith("text/"):
        return "txt"
    return "file"


@router.get(
    "/groups/{group_id}/files",
    responses={403: {"description": "Not a member of this group"}},
)
async def list_files(
    group_id: str,
    current_user: CurrentUser,
    db: DB,
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
):
    await verify_group_member(group_id, current_user.id, db)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base_filter = [File.group_id == group_id]
    if status:
        base_filter.append(File.status == status)

    result = await db.execute(
        select(File)
        .where(*base_filter)
        .order_by(File.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    files = result.scalars().all()
    total_result = await db.execute(
        select(func.count(File.id)).where(*base_filter)
    )
    total = int(total_result.scalar_one() or 0)
    return {
        "files": [
            {
                "id": f.id,
                "group_id": f.group_id,
                "name": f.name,
                "mime_type": f.mime_type,
                "file_type": _file_type(f.mime_type),
                "size": f.size_bytes,
                "size_bytes": f.size_bytes,
                "status": f.status,
                "error_message": f.error_message,
                "chunk_count": f.chunk_count,
                "indexed_at": f.indexed_at.isoformat() if f.indexed_at else None,
                "created_at": f.created_at.isoformat(),
            }
            for f in files
        ],
        "total": total,
        "has_more": offset + len(files) < total,
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

    vector_store.delete_file_chunks(file_id, current_user.org_id, file_obj.user_id)

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


# ---------------------------------------------------------------------------
# OCR & Photo Problem Solving (Part B)
# ---------------------------------------------------------------------------

_ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
_MAX_IMAGE_SIZE = 15 * 1024 * 1024  # 15 MB


@router.post("/ocr/extract")
async def extract_text_from_image(
    file: Annotated[UploadFile, FastAPIFile(...)],
    current_user: CurrentUser,
    db: DB,
    index_to_group: str | None = Query(None),
):
    """Extract text from a handwritten note or document image using AI vision."""
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Image only: JPEG, PNG, or WebP.")

    contents = await file.read()
    if len(contents) > _MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image must be under 15MB.")

    image_b64 = base64.b64encode(contents).decode("utf-8")

    extracted = await ai_service.describe_image(
        image_b64=image_b64,
        media_type=file.content_type,
        prompt=(
            "Extract ALL text from this handwritten note or document.\n"
            "Include every word, number, formula, and diagram label.\n"
            "For mathematical formulas, use LaTeX notation (e.g. $\\frac{x}{2}$).\n"
            "For tables, reproduce them in Markdown table format.\n"
            "For diagrams or drawings, describe what is drawn in [brackets].\n"
            "Preserve the original structure (paragraphs, bullet points, numbering).\n"
            "Output ONLY the extracted text, nothing else."
        ),
    )

    has_math = any(c in extracted for c in ["$", "\\frac", "\\sqrt", "=", "∫", "∑", "π"])

    arabic_chars = sum(1 for c in extracted if "؀" <= c <= "ۿ")
    french_keywords = ["le", "la", "les", "de", "du", "et", "est", "une"]
    detected_lang = "ar" if arabic_chars > len(extracted) * 0.3 else (
        "fr" if any(w in extracted.lower() for w in french_keywords) else "mixed"
    )

    result = {
        "text": extracted,
        "char_count": len(extracted),
        "has_math": has_math,
        "detected_language": detected_lang,
    }

    if index_to_group:
        from app.services.file_processor import file_processor
        chunks = file_processor._chunk_text(extracted, file_name="handwritten_notes.txt", page_number=1)
        await vector_store.upsert_chunks(
            chunks=chunks,
            org_id=current_user.org_id,
            user_id=current_user.id,
        )
        result["indexed"] = True
        result["chunk_count"] = len(chunks)

    return result


@router.post("/solve/photo")
async def solve_from_photo(
    file: Annotated[UploadFile, FastAPIFile(...)],
    current_user: CurrentUser,
    level: str | None = Query(None),
    subject: str | None = Query(None),
):
    """Solve a math or science problem from a photo — always returns step-by-step, never just the answer."""
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Image only: JPEG, PNG, or WebP.")

    contents = await file.read()
    if len(contents) > _MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image must be under 15MB.")

    image_b64 = base64.b64encode(contents).decode("utf-8")

    problem_text = await ai_service.describe_image(
        image_b64=image_b64,
        media_type=file.content_type,
        prompt="Extract the math or science problem from this image. Output only the problem statement.",
    )

    level_context = f"This is for a Moroccan {level} student." if level else ""
    solution = await ai_service.generate_structured_json(
        prompt=(
            f"Solve this problem step by step for a student. {level_context}\n\n"
            f"PROBLEM: {problem_text}\n\n"
            "Return JSON with:\n"
            '- "problem_restated": the problem in clear words\n'
            '- "approach": which method/theorem to use (1-2 sentences)\n'
            '- "steps": array of {step_number, action, calculation, explanation} '
            "   — each step must show the calculation and explain WHY in simple words\n"
            '- "final_answer": the answer with correct unit\n'
            '- "verification": how to check the answer is correct\n'
            '- "common_mistakes": 1-2 mistakes students make on this type of problem\n'
            '- "related_concepts": list of concepts this problem uses\n'
        ),
        schema_description=(
            "object with: problem_restated, approach, steps (array of {step_number, action, "
            "calculation, explanation}), final_answer, verification, common_mistakes, related_concepts"
        ),
        max_tokens=2000,
    )

    return {
        "problem": problem_text,
        "solution": solution,
        "level": level,
        "subject": subject,
    }
