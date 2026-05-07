import asyncio
import json
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.jobs.file_jobs import process_file


def handler(event, _context):
    body = json.loads(event["Records"][0]["body"])
    async def _run():
        engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            await process_file(body["file_id"], body["r2_key"], body["mime_type"], factory)
        finally:
            await engine.dispose()
    asyncio.run(_run())
    return {"statusCode": 200}
