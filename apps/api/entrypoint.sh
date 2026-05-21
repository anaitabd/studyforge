#!/bin/bash
# Container entrypoint — selects run mode via APP_MODE env var.
# APP_MODE=api      (default) FastAPI via Gunicorn
# APP_MODE=worker   Celery worker (all queues)
# APP_MODE=beat     Celery beat scheduler
set -e

# Cloud Run requires the container to bind to $PORT or it kills the instance.
# worker/beat don't serve HTTP, so we start a minimal health server in the background.
_start_health_server() {
  python3 - <<'PYEOF' &
import http.server, os, threading

class _H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")
    def log_message(self, *_): pass

port = int(os.environ.get("PORT", 8080))
http.server.HTTPServer(("0.0.0.0", port), _H).serve_forever()
PYEOF
}

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
    _start_health_server
    exec celery \
      -A app.tasks.celery_app worker \
      --loglevel=info \
      -Q files,notifications,slides,analytics \
      --concurrency="${CELERY_CONCURRENCY:-2}" \
      --max-tasks-per-child=50
    ;;
  beat)
    _start_health_server
    exec celery -A app.tasks.celery_app beat --loglevel=info
    ;;
  *)
    exec "$@"
    ;;
esac
