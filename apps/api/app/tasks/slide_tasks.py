import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.jobs.slide_jobs import generate_slides, mark_slide_error
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _make_task_session_factory():
    engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=2, max_overflow=0)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


@celery_app.task(name="app.tasks.slide_tasks.generate_slides", bind=True, max_retries=2)
def generate_slides_task(self, deck_id: str):
    async def _run():
        engine, factory = _make_task_session_factory()
        try:
            await generate_slides(deck_id, factory)
            logger.info(f"Slide deck {deck_id} generated successfully")
        finally:
            await engine.dispose()

    async def _err(msg: str):
        engine, factory = _make_task_session_factory()
        try:
            await mark_slide_error(deck_id, msg, factory)
        finally:
            await engine.dispose()

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.exception(f"Slide generation failed for deck {deck_id}: {exc}")
        try:
            asyncio.run(_err(str(exc)))
        except Exception:
            logger.exception("Failed to mark slide deck as error")
        raise self.retry(exc=exc)
