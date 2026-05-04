import asyncio
import json
import logging

import redis

from app.core.config import settings
from app.services.slide_service import slide_service
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)
_redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


@celery_app.task(name="app.tasks.slide_tasks.generate_slides", bind=True, max_retries=2)
def generate_slides_task(
    self,
    group_id: str,
    file_ids: list[str],
    config: dict,
    user_id: str,
):
    task_id = self.request.id
    key = f"slide_task:{task_id}"
    try:
        url = asyncio.run(
            slide_service.generate_slide_deck(group_id, file_ids, config)
        )
        _redis.set(
            key,
            json.dumps({"status": "done", "download_url": url, "user_id": user_id}),
            ex=3600,
        )
        logger.info(f"Slides generated for group {group_id}, task {task_id}")
        return {"status": "done", "download_url": url}
    except Exception as e:
        logger.exception("Slide generation failed")
        _redis.set(
            key,
            json.dumps({"status": "error", "message": str(e), "user_id": user_id}),
            ex=3600,
        )
        raise
