import json
from app.core.redis import get_redis


async def cache_get(key: str) -> dict | None:
    redis = await get_redis()
    value = await redis.get(key)
    return json.loads(value) if value else None


async def cache_set(key: str, value: dict, ttl_seconds: int = 300) -> None:
    redis = await get_redis()
    await redis.setex(key, ttl_seconds, json.dumps(value, default=str))


async def cache_delete(key: str) -> None:
    redis = await get_redis()
    await redis.delete(key)
