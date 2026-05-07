import logging
import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from app.core.config import settings
from app.jobs.file_jobs import process_file, mark_file_error
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _make_task_session_factory():
    engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=2, max_overflow=0)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.file_tasks.process_file")
def process_file_task(self, file_id: str, r2_key: str, mime_type: str):
    async def _run():
        engine, factory = _make_task_session_factory()
        try:
            await process_file(file_id, r2_key, mime_type, factory)
        finally:
            await engine.dispose()

    async def _err(msg: str):
        engine, factory = _make_task_session_factory()
        try:
            await mark_file_error(file_id, msg, factory)
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
