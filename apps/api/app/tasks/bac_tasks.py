"""Celery tasks for Bac paper extraction."""

import asyncio
import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _make_session_factory():
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=2, max_overflow=0
    )
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _do_extract(paper_id: str, file_id: str, session_factory) -> None:
    from app.models.bac import BacPaper
    from app.models.file import File
    from app.services.bac_service import extract_questions_from_paper
    from app.services.storage_service import storage_service

    async with session_factory() as db:
        file_row = (await db.execute(select(File).where(File.id == file_id))).scalar_one_or_none()
        if not file_row or not file_row.r2_key:
            logger.error("File %s missing or has no storage key — aborting extraction", file_id)
            await db.execute(
                update(BacPaper).where(BacPaper.id == paper_id).values(extraction_status="error")
            )
            await db.commit()
            return

        try:
            raw_bytes = await storage_service.download(file_row.r2_key)
        except Exception as exc:
            logger.exception("Failed to download file %s: %s", file_id, exc)
            await db.execute(
                update(BacPaper).where(BacPaper.id == paper_id).values(extraction_status="error")
            )
            await db.commit()
            return

    # Extract text from the raw bytes (PDF / DOCX / TXT)
    try:
        from app.services.file_processor import file_processor
        text_content = await file_processor.extract_text(raw_bytes, file_row.mime_type)
    except Exception as exc:
        logger.warning("Text extraction failed, using raw decode: %s", exc)
        text_content = raw_bytes.decode("utf-8", errors="replace")

    async with session_factory() as db:
        await extract_questions_from_paper(paper_id, text_content, db)


@celery_app.task(
    name="app.tasks.bac_tasks.extract_bac_paper",
    bind=True,
    queue="files",
    autoretry_for=(Exception,),
    max_retries=2,
    retry_backoff=30,
)
def extract_bac_paper(self, paper_id: str, file_id: str):
    """Download a Bac paper file and extract its questions with AI."""
    engine, factory = _make_session_factory()
    try:
        asyncio.run(_do_extract(paper_id, file_id, factory))
    finally:
        asyncio.run(engine.dispose())
