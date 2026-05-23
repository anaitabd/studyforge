from celery import Celery, Task
from celery.schedules import crontab
from app.core.config import settings

CELERY_QUEUES = ["files", "notifications", "slides", "analytics"]


def _init_sentry() -> None:
    """Initialise Sentry inside Celery worker processes when DSN is configured."""
    dsn = getattr(settings, "SENTRY_DSN", None)
    if not dsn:
        return
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    sentry_sdk.init(
        dsn=dsn,
        integrations=[CeleryIntegration()],
        environment=settings.APP_ENV.value,
        traces_sample_rate=0.1,
    )


class RetryableTask(Task):
    """Base task with exponential back-off + jitter enabled by default.

    Individual tasks can override any of these attributes.
    autoretry_for is left empty here — tasks that want automatic retries
    must set it explicitly (or use manual self.retry() for fine-grained
    final-failure handling).
    """
    abstract = True
    max_retries = 3
    retry_backoff = 60        # first retry delay in seconds
    retry_backoff_max = 300   # cap at 5 minutes
    retry_jitter = True       # add random jitter to avoid thundering-herd


celery_app = Celery(
    "studyforge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    task_cls=RetryableTask,
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
    task_acks_late=True,
    # Keep results long enough for the retry endpoint to inspect them
    result_expires=86400 * 7,  # 7 days
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


@celery_app.on_after_configure.connect
def setup_sentry(sender, **kwargs):  # noqa: ARG001
    _init_sentry()
