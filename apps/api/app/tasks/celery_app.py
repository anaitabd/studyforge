from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "studyforge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.file_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.slide_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.file_tasks.*": {"queue": "files"},
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.tasks.slide_tasks.*": {"queue": "slides"},
    },
    beat_schedule={
        "check-exam-deadlines": {
            "task": "app.tasks.notification_tasks.check_exam_deadlines",
            "schedule": 3600.0,
        }
    },
)
