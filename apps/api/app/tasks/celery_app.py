from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

CELERY_QUEUES = ["files", "notifications", "slides", "analytics"]

celery_app = Celery(
    "studyforge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.file_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.slide_tasks",
        "app.tasks.analytics_tasks",
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
        "app.tasks.analytics_tasks.*": {"queue": "analytics"},
    },
    beat_schedule={
        "check-exam-deadlines": {
            "task": "app.tasks.notification_tasks.check_exam_deadlines",
            "schedule": 3600.0,
        },
        "update-streak-records": {
            "task": "app.tasks.analytics_tasks.update_streak_records",
            "schedule": crontab(hour=23, minute=55),
        },
        "flag-at-risk-students": {
            "task": "app.tasks.analytics_tasks.flag_at_risk_students",
            "schedule": crontab(hour=6, minute=0),
        },
    },
)
