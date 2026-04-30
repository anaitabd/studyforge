from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.slide_tasks.generate_slides")
def generate_slides_task(group_id: str, file_ids: list, style: str, language: str, user_id: str):
    logger.info(f"Generating slides for group {group_id}")
    # Full implementation in Phase 8
