#!/bin/bash
# Container entrypoint — selects run mode via APP_MODE env var.
# APP_MODE=api      (default) FastAPI via Gunicorn
# APP_MODE=worker   Celery worker (all queues)
# APP_MODE=beat     Celery beat scheduler
set -e

case "${APP_MODE:-api}" in
  api)
    exec gunicorn \
      -k uvicorn.workers.UvicornWorker \
      -w "${GUNICORN_WORKERS:-2}" \
      -b "0.0.0.0:${PORT:-8000}" \
      --timeout 300 \
      --keepalive 5 \
      --access-logfile - \
      app.main:app
    ;;
  worker)
    exec celery \
      -A app.tasks.celery_app worker \
      --loglevel=info \
      -Q files,notifications,slides,analytics \
      --concurrency="${CELERY_CONCURRENCY:-2}" \
      --max-tasks-per-child=50
    ;;
  beat)
    exec celery -A app.tasks.celery_app beat --loglevel=info
    ;;
  *)
    exec "$@"
    ;;
esac
