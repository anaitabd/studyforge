import logging
import os

logger = logging.getLogger(__name__)


async def process_file(file_id: str, r2_key: str, mime_type: str, session_factory):
    from app.models.file import File
    from app.services.file_processor import file_processor
    from app.services.ai_service import ai_service
    from app.services.vector_store import vector_store
    from app.services.storage_service import storage_service
    from sqlalchemy import select, update
    from datetime import datetime, timezone

    async with session_factory() as db:
        result = await db.execute(select(File).where(File.id == file_id))
        file_obj = result.scalar_one_or_none()
        if not file_obj:
            logger.error(f"File {file_id} not found in DB")
            return

        # idempotent guard
        if file_obj.status == "ready" and (file_obj.chunk_count or 0) > 0:
            logger.info(f"File {file_id} already processed; skipping")
            return

        group_id = file_obj.group_id
        file_name = file_obj.name
        uploader_id = file_obj.user_id

        from app.models.user import User as _User
        uploader = (await db.execute(select(_User).where(_User.id == uploader_id))).scalar_one_or_none()
        org_id = uploader.org_id if uploader else None

        await db.execute(
            update(File).where(File.id == file_id).values(status="processing", error_message=None)
        )
        await db.commit()

    tmp_path = await storage_service.download_to_temp(r2_key)

    try:
        pages = file_processor.extract_text(tmp_path, mime_type)
        if not pages:
            raise ValueError("No text could be extracted from file")

        chunks = file_processor.chunk_text(pages, file_id, group_id, file_name)
        if not chunks:
            raise ValueError("No chunks generated from extracted text")

        indexed = 0
        for i in range(0, len(chunks), 96):
            sub = chunks[i : i + 96]
            sub_embs = await ai_service.embed_texts([c["text"] for c in sub], input_type="passage")
            for c, e in zip(sub, sub_embs):
                c["embedding"] = e
            vector_store.upsert_chunks(sub, org_id, uploader_id)
            indexed += len(sub)

        async with session_factory() as db:
            await db.execute(
                update(File).where(File.id == file_id).values(
                    status="ready",
                    error_message=None,
                    chunk_count=len(chunks),
                    indexed_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()

        from app.services.notification_service import notify_file_ready

        async with session_factory() as db:
            await notify_file_ready(
                db=db,
                group_id=group_id,
                file_id=file_id,
                file_name=file_name,
                uploader_id=uploader_id,
                idempotency_key=f"file-ready:{file_id}",
            )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


async def mark_file_error(file_id: str, error_msg: str, session_factory):
    from app.models.file import File
    from sqlalchemy import update

    async with session_factory() as db:
        await db.execute(
            update(File).where(File.id == file_id).values(
                status="error",
                error_message=error_msg[:4000] if error_msg else "Unknown file processing error",
            )
        )
        await db.commit()
