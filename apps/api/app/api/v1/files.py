import base64
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File as FastAPIFile
from sqlalchemy import and_, or_, select, delete, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.pagination import Pagination, encode_cursor
from app.core.plans import get_upload_limit
from app.core.security import get_current_user
from app.models.file import File
from app.models.group import GroupMember
from app.services.ai_service import ai_service
from app.services.storage_service import storage_service
from app.services.vector_store import vector_store
from app.tasks.file_tasks import process_file_task

logger = logging.getLogger(__name__)
router = APIRouter(tags=["files"])

# Reusable annotated dependency aliases
CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

# ── MIME validation ───────────────────────────────────────────────────────────

ALLOWED_MIME_TYPES: frozenset[str] = frozenset({
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
})

_MIME_LABELS: dict[str, str] = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "text/plain": "TXT",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
}


def _detect_mime(content: bytes) -> str | None:
    """Identify MIME type from magic bytes — never trusts file extension or Content-Type header."""
    if content[:4] == b"%PDF":
        return "application/pdf"
    if content[:4] == b"PK\x03\x04":
        # DOCX and PPTX are both ZIP archives; the [Content_Types].xml at the
        # start of the archive contains the distinguishing namespace string.
        head = content[:2048]
        if b"wordprocessingml" in head:
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if b"presentationml" in head:
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        return None  # unrecognised ZIP variant
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    # Plain text: no null bytes and valid UTF-8 in the first 512 bytes
    try:
        sample = content[:512]
        if sample and b"\x00" not in sample:
            sample.decode("utf-8")
            return "text/plain"
    except (UnicodeDecodeError, ValueError):
        pass
    return None


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
    pagination: Pagination,
    status: str | None = None,
):
    await verify_group_member(group_id, current_user.id, db)

    cursor_dt, cursor_id = pagination.decode()

    base_filter = [File.group_id == group_id]
    if status:
        base_filter.append(File.status == status)

    page_filter = list(base_filter)
    if cursor_dt is not None:
        page_filter.append(
            or_(
                File.created_at < cursor_dt,
                and_(File.created_at == cursor_dt, File.id < cursor_id),
            )
        )

    files = (await db.execute(
        select(File)
        .where(*page_filter)
        .order_by(File.created_at.desc(), File.id.desc())
        .limit(pagination.limit)
    )).scalars().all()

    total = int((await db.execute(
        select(func.count(File.id)).where(*base_filter)
    )).scalar_one() or 0)

    next_cursor = encode_cursor(files[-1].created_at, files[-1].id) if len(files) == pagination.limit else None

    return {
        "items": [
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
        "next_cursor": next_cursor,
        "total": total,
    }


@router.post(
    "/groups/{group_id}/files",
    responses={
        403: {"description": "Not a member of this group"},
        413: {"description": "File exceeds your plan's upload limit"},
        415: {"description": "Unsupported file type"},
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

    # ── Plan-based size limit ─────────────────────────────────────────────────
    max_bytes = get_upload_limit(current_user.plan)
    if len(content) > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large for your plan ({current_user.plan}). Max {max_mb} MB.",
        )

    # ── Magic-bytes MIME detection (ignores client Content-Type / extension) ──
    detected_mime = _detect_mime(content)
    if detected_mime is None or detected_mime not in ALLOWED_MIME_TYPES:
        allowed = ", ".join(sorted(_MIME_LABELS.values()))
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {allowed}.",
        )

    file_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
    r2_key = f"groups/{group_id}/files/{file_id}.{ext}"

    await storage_service.upload_file(content, r2_key, detected_mime)

    file_record = File(
        id=file_id,
        group_id=group_id,
        user_id=current_user.id,
        name=file.filename,
        r2_key=r2_key,
        mime_type=detected_mime,
        size_bytes=len(content),
        status="uploading",
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    process_file_task.delay(file_id, r2_key, detected_mime)

    logger.info("File %s uploaded (mime=%s, size=%d), processing queued", file_id, detected_mime, len(content))

    return {
        "id": file_record.id,
        "name": file_record.name,
        "mime_type": detected_mime,
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


@router.post(
    "/groups/{group_id}/files/{file_id}/retry",
    responses={
        400: {"description": "File is not in error state"},
        403: {"description": "Not a member of this group"},
        404: {"description": "File not found"},
    },
)
async def retry_file(
    group_id: str,
    file_id: str,
    current_user: CurrentUser,
    db: DB,
):
    """Re-queue a failed file for processing. Any group member may trigger this."""
    from datetime import datetime, timezone
    from app.models.failed_task import FailedTask

    await verify_group_member(group_id, current_user.id, db)

    file_obj = (await db.execute(
        select(File).where(File.id == file_id, File.group_id == group_id)
    )).scalar_one_or_none()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    if file_obj.status != "error":
        raise HTTPException(
            status_code=400,
            detail=f"File is not in error state (current status: {file_obj.status})",
        )

    await db.execute(
        update(File).where(File.id == file_id).values(status="uploading", error_message=None)
    )

    # Stamp dead-letter record so we know it was retried
    await db.execute(
        update(FailedTask)
        .where(FailedTask.args["file_id"].astext == file_id)
        .values(retried_at=datetime.now(timezone.utc))
    )

    await db.commit()

    process_file_task.delay(file_id, file_obj.r2_key, file_obj.mime_type)

    logger.info("File %s re-queued by user %s", file_id, current_user.id)
    return {"message": "File re-queued for processing", "status": "uploading"}


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
        import uuid as _uuid
        fake_file_id = str(_uuid.uuid4())
        pages = [{"page_number": 1, "text": extracted}]
        chunks = file_processor.chunk_text(pages, fake_file_id, index_to_group, "handwritten_notes.txt")
        vector_store.upsert_chunks(
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
