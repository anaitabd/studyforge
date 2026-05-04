import logging
import os
import tempfile

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession

from app.core.config import settings
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _make_task_session_factory():
    """Create a fresh engine + sessionmaker per Celery task run.

    Why: asyncpg connections are bound to the asyncio loop they were
    opened in. Celery solo pool reuses the worker process and runs
    asyncio.run() per task, which creates a new loop each time. A
    module-level engine retains pooled connections from the prior
    loop, causing 'Future attached to a different loop' errors on the
    second task. A per-task engine avoids that entirely.
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=0,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="app.tasks.file_tasks.process_file",
)
def process_file_task(self, file_id: str, r2_key: str, mime_type: str):
    """
    Full RAG ingestion pipeline (synchronous Celery task):
    1. Update file status → processing
    2. Download from R2 to temp file
    3. Extract text
    4. Chunk text
    5. Embed chunks via NVIDIA API
    6. Upsert to ChromaDB
    7. Update file status → ready
    """
    import asyncio

    async def _run():
        engine, factory = _make_task_session_factory()
        try:
            await _process_file_async(file_id, r2_key, mime_type, factory)
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


async def _process_file_async(file_id: str, r2_key: str, mime_type: str, AsyncSessionLocal):
    from app.models.file import File
    from app.services.file_processor import file_processor
    from app.services.ai_service import ai_service
    from app.services.vector_store import vector_store
    from app.services.storage_service import storage_service
    from sqlalchemy import select, update
    from datetime import datetime, timezone

    async with AsyncSessionLocal() as db:
        # 1. Fetch file record
        result = await db.execute(select(File).where(File.id == file_id))
        file_obj = result.scalar_one_or_none()
        if not file_obj:
            logger.error(f"File {file_id} not found in DB")
            return

        group_id = file_obj.group_id
        file_name = file_obj.name

        # 2. Update status to processing
        await db.execute(
            update(File).where(File.id == file_id).values(status="processing", error_message=None)
        )
        await db.commit()

    # 3. Download to temp file
    from app.services.storage_service import storage_service
    tmp_path = await storage_service.download_to_temp(r2_key)

    try:
        # 4. Extract text
        pages = file_processor.extract_text(tmp_path, mime_type)
        if not pages:
            raise ValueError("No text could be extracted from file")

        # 5. Chunk text
        chunks = file_processor.chunk_text(pages, file_id, group_id, file_name)
        if not chunks:
            raise ValueError("No chunks generated from extracted text")

        logger.info(f"File {file_id}: {len(pages)} pages → {len(chunks)} chunks")
        del pages

        # 6+7. Embed and upsert in streaming batches to bound memory.
        EMBED_BATCH = 96
        for i in range(0, len(chunks), EMBED_BATCH):
            sub = chunks[i : i + EMBED_BATCH]
            sub_texts = [c["text"] for c in sub]
            sub_embs = await ai_service.embed_texts(sub_texts, input_type="passage")
            for c, e in zip(sub, sub_embs):
                c["embedding"] = e
            vector_store.upsert_chunks(group_id, sub)
            for c in sub:
                c.pop("embedding", None)
            del sub_texts, sub_embs

        # 8. Update file status → ready
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(File)
                .where(File.id == file_id)
                .values(
                    status="ready",
                    error_message=None,
                    chunk_count=len(chunks),
                    indexed_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()

        logger.info(f"File {file_id} processed successfully: {len(chunks)} chunks indexed")

        # Notify group members that a new file is ready to study
        try:
            from app.services.notification_service import notify_file_ready
            async with AsyncSessionLocal() as notify_db:
                await notify_file_ready(
                    db=notify_db,
                    group_id=group_id,
                    file_id=file_id,
                    file_name=file_name,
                    uploader_id=file_obj.user_id,
                )
        except Exception as e:
            logger.warning(f"File-ready notification failed for {file_id}: {e}")

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


async def _mark_file_error(file_id: str, error_msg: str, AsyncSessionLocal):
    from app.models.file import File
    from sqlalchemy import update

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(File).where(File.id == file_id).values(
                status="error",
                error_message=error_msg[:4000] if error_msg else "Unknown file processing error",
            )
        )
        await db.commit()
    logger.error(f"File {file_id} marked as error: {error_msg}")
