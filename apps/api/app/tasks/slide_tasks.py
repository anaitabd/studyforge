import asyncio
import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.slide_deck import SlideDeck
from app.services.slide_service import slide_service
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _make_task_session_factory():
    """Same pattern as file_tasks: per-task engine to avoid asyncio loop reuse issues."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=0,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


@celery_app.task(name="app.tasks.slide_tasks.generate_slides", bind=True, max_retries=2)
def generate_slides_task(self, deck_id: str):
    """Async pipeline: load deck, run full generation via slide_service,
    persist Slide rows, render PPTX, mark deck ready or error."""

    async def _run():
        engine, factory = _make_task_session_factory()
        try:
            async with factory() as db:
                await db.execute(
                    update(SlideDeck).where(SlideDeck.id == deck_id).values(
                        status="generating", error_message=None
                    )
                )
                await db.commit()

            async with factory() as db:
                await slide_service.generate_full_deck(db, deck_id)
            logger.info(f"Slide deck {deck_id} generated successfully")
        finally:
            await engine.dispose()

    async def _err(msg: str):
        engine, factory = _make_task_session_factory()
        try:
            async with factory() as db:
                # Best-effort: clear any partially-written slides via cascade
                # by leaving them; viewer treats status=error as terminal.
                await db.execute(
                    update(SlideDeck).where(SlideDeck.id == deck_id).values(
                        status="error",
                        error_message=msg[:4000] if msg else "Slide generation failed",
                    )
                )
                await db.commit()
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
