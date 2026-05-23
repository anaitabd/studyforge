import asyncio
import logging
import os
import random
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


# ── session factory ───────────────────────────────────────────────────────────

def _make_task_session_factory():
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=2, max_overflow=0
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


# ── core processing logic ─────────────────────────────────────────────────────

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
            logger.error("File %s not found in DB — aborting", file_id)
            return

        if file_obj.status == "ready" and (file_obj.chunk_count or 0) > 0:
            logger.info("File %s already processed; skipping", file_id)
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

        for i in range(0, len(chunks), 96):
            sub = chunks[i: i + 96]
            sub_embs = await ai_service.embed_texts([c["text"] for c in sub], input_type="passage")
            for c, e in zip(sub, sub_embs):
                c["embedding"] = e
            from app.services.vector_store import vector_store as _vs
            _vs.upsert_chunks(sub, org_id, uploader_id)

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
            logger.info("Extracted %d concepts from file %s", concept_count, file_id)
        except Exception as graph_exc:
            logger.warning("Graph RAG extraction failed for file %s (non-fatal): %s", file_id, graph_exc)

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


# ── failure helpers ───────────────────────────────────────────────────────────

async def _mark_file_error(file_id: str, error_msg: str, session_factory):
    from app.models.file import File
    async with session_factory() as db:
        await db.execute(
            update(File).where(File.id == file_id).values(
                status="error",
                error_message=(error_msg or "Unknown file processing error")[:4000],
            )
        )
        await db.commit()


async def _handle_final_failure(
    file_id: str,
    r2_key: str,
    mime_type: str,
    task_id: str,
    error: str,
    session_factory,
):
    """On exhausted retries: write dead-letter record + notify the file owner."""
    from app.models.failed_task import FailedTask
    from app.models.file import File
    from app.models.notification import Notification

    async with session_factory() as db:
        # Write dead-letter record (upsert by task_id to survive duplicate calls)
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        await db.execute(
            pg_insert(FailedTask).values(
                id=str(uuid.uuid4()),
                task_id=task_id,
                task_name="app.tasks.file_tasks.process_file",
                args={"file_id": file_id, "r2_key": r2_key, "mime_type": mime_type},
                error=error[:4000] if error else None,
            ).on_conflict_do_nothing(index_elements=["task_id"])
        )

        # Notify the file owner
        file_obj = (await db.execute(select(File).where(File.id == file_id))).scalar_one_or_none()
        if file_obj:
            db.add(Notification(
                id=str(uuid.uuid4()),
                user_id=file_obj.user_id,
                type="file_processing_failed",
                title="File processing failed",
                body=(
                    f'"{file_obj.name}" could not be processed after multiple attempts. '
                    "Please check the file and try again."
                ),
                link=f"/groups/{file_obj.group_id}/files",
            ))

        await db.commit()


# ── task ──────────────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.tasks.file_tasks.delete_group_vectors",
    autoretry_for=(Exception,),
    max_retries=2,
    default_retry_delay=30,
)
def delete_group_vectors_task(group_id: str):
    """Delete all ChromaDB embeddings for a group after the group is removed from the DB."""
    from app.services.vector_store import vector_store as _vs
    _vs.delete_group_collection(group_id)
    logger.info("Vector cleanup complete for deleted group %s", group_id)


@celery_app.task(
    bind=True,
    name="app.tasks.file_tasks.process_file",
    # Override base class defaults for this specific task
    autoretry_for=(),   # manual retry only — we need final-failure detection
    max_retries=3,
)
def process_file_task(self, file_id: str, r2_key: str, mime_type: str):
    """Process an uploaded file: extract text, embed, index into vector store.

    Retry policy: up to 3 retries with exponential back-off + jitter.
      Attempt 1 fails → retry after ~60 s
      Attempt 2 fails → retry after ~120 s
      Attempt 3 fails → retry after ~240 s
      Attempt 4 fails → final failure: dead-letter + owner notification + Sentry
    """
    engine, factory = _make_task_session_factory()

    async def _run():
        try:
            await _process_file(file_id, r2_key, mime_type, factory)
        finally:
            await engine.dispose()

    async def _err(msg: str):
        try:
            await _mark_file_error(file_id, msg, factory)
        finally:
            await engine.dispose()

    async def _final(msg: str):
        try:
            await _handle_final_failure(file_id, r2_key, mime_type, self.request.id, msg, factory)
        finally:
            await engine.dispose()

    try:
        asyncio.run(_run())
    except Exception as exc:
        is_final = self.request.retries >= self.max_retries

        logger.error(
            "File processing failed for %s (attempt %d/%d): %s",
            file_id, self.request.retries + 1, self.max_retries + 1, exc,
        )

        # Always persist error state so the UI is up to date
        try:
            asyncio.run(_err(str(exc)))
        except Exception:
            logger.exception("Failed to update file error state for %s", file_id)

        if is_final:
            # Capture to Sentry (no-op if SENTRY_DSN is empty)
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(exc)
            except Exception:
                pass

            # Write dead-letter record + send owner notification
            try:
                asyncio.run(_final(str(exc)))
            except Exception:
                logger.exception("Failed to write dead-letter record for file %s", file_id)

            # Let the exception propagate — Celery marks task as FAILURE
            raise

        # Exponential back-off: 60s → 120s → 240s, with ±25% jitter
        backoff = int(60 * (2 ** self.request.retries) * (0.75 + random.random() * 0.5))
        raise self.retry(exc=exc, countdown=backoff)
