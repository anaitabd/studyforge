import asyncio
import logging
import os

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _make_task_session_factory():
    engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=2, max_overflow=0)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


async def _process_file(file_id: str, r2_key: str, mime_type: str, session_factory):
    from datetime import datetime, timezone
    from app.models.file import File
    from app.models.user import User as _User
    from app.services.file_processor import file_processor
    from app.services.ai_service import ai_service
    from app.services.vector_store import vector_store
    from app.services.storage_service import storage_service

    async with session_factory() as db:
        result = await db.execute(select(File).where(File.id == file_id))
        file_obj = result.scalar_one_or_none()
        if not file_obj:
            logger.error(f"File {file_id} not found in DB")
            return

        if file_obj.status == "ready" and (file_obj.chunk_count or 0) > 0:
            logger.info(f"File {file_id} already processed; skipping")
            return

        group_id = file_obj.group_id
        file_name = file_obj.name
        uploader_id = file_obj.user_id

        uploader = (await db.execute(select(_User).where(_User.id == uploader_id))).scalar_one_or_none()
        org_id = uploader.org_id if uploader else None

        await db.execute(
            update(File).where(File.id == file_id).values(status="processing", error_message=None)
        )
        await db.commit()

    tmp_path = await storage_service.download_to_temp(r2_key)

    try:
        pages = await file_processor.extract_text_async(tmp_path, mime_type, file_name)
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

        try:
            from app.services.graph_rag_service import graph_rag_service
            from app.services.curriculum_service import detect_subject, detect_level

            combined_sample = " ".join(p["text"] for p in pages[:5])
            subject = detect_subject(combined_sample)
            level = detect_level(combined_sample)

            chunk_id_map: dict[int, str] = {}
            for chunk in chunks:
                pg = chunk.get("metadata", {}).get("page_number")
                if pg and pg not in chunk_id_map:
                    chunk_id_map[pg] = chunk["id"]

            async with session_factory() as graph_db:
                concept_count = await graph_rag_service.build_for_file(
                    db=graph_db,
                    file_id=file_id,
                    org_id=org_id,
                    user_id=uploader_id,
                    pages=pages,
                    subject=subject,
                    level=level,
                    chunk_map=chunk_id_map,
                )
            logger.info(f"Extracted {concept_count} concepts from file {file_id}")
        except Exception as graph_exc:
            logger.warning(f"Graph RAG extraction failed for file {file_id} (non-fatal): {graph_exc}")

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


async def _mark_file_error(file_id: str, error_msg: str, session_factory):
    async with session_factory() as db:
        await db.execute(
            update(File).where(File.id == file_id).values(
                status="error",
                error_message=error_msg[:4000] if error_msg else "Unknown file processing error",
            )
        )
        await db.commit()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.file_tasks.process_file")
def process_file_task(self, file_id: str, r2_key: str, mime_type: str):
    async def _run():
        engine, factory = _make_task_session_factory()
        try:
            await _process_file(file_id, r2_key, mime_type, factory)
        finally:
            await engine.dispose()

    async def _err(msg: str):
        engine, factory = _make_task_session_factory()
        try:
            await _mark_file_error(file_id, msg, factory)
        finally:
            await engine.dispose()

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.error(f"File processing failed for {file_id}: {exc}")
        try:
            asyncio.run(_err(str(exc)))
        except Exception:
            logger.exception("Failed to mark file as error")
        raise self.retry(exc=exc)
