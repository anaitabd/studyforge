import asyncio
import json
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.jobs.slide_jobs import generate_slides


def handler(event, _context):
    body = json.loads(event["Records"][0]["body"])
    async def _run():
        engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            await generate_slides(body["deck_id"], factory)
        finally:
            await engine.dispose()
    asyncio.run(_run())
    return {"statusCode": 200}
