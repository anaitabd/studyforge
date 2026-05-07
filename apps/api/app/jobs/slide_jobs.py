from app.models.slide_deck import SlideDeck
from app.services.slide_service import slide_service
from sqlalchemy import update


async def generate_slides(deck_id: str, session_factory):
    async with session_factory() as db:
        await db.execute(
            update(SlideDeck).where(SlideDeck.id == deck_id).values(status="generating", error_message=None)
        )
        await db.commit()

    async with session_factory() as db:
        await slide_service.generate_full_deck(db, deck_id)


async def mark_slide_error(deck_id: str, msg: str, session_factory):
    async with session_factory() as db:
        await db.execute(
            update(SlideDeck).where(SlideDeck.id == deck_id).values(
                status="error", error_message=msg[:4000] if msg else "Slide generation failed"
            )
        )
        await db.commit()
