Set up proper structured log aggregation so logs survive container restarts and are searchable.

Backend steps:
1. In app/core/middleware.py, ensure all access logs are structured JSON with fields:
   request_id, method, path, status_code, duration_ms, user_id (if authenticated), ip, user_agent

2. Configure Python logger in app/main.py to output JSON using python-json-logger:
   - Install python-json-logger
   - Format: {"timestamp": "...", "level": "INFO", "logger": "...", "message": "...", ...extra_fields}
   - Log level from APP_ENV: DEBUG in local, INFO in dev/staging, WARNING in prod

3. For GCP Cloud Run (production):
   - Cloud Run ships stdout to Cloud Logging automatically
   - Add these fields for correct Cloud Logging parsing: httpRequest.status, httpRequest.latency, httpRequest.requestUrl
   - Create Log-based metrics in GCP for: 5xx error rate, p99 latency, failed Celery tasks

4. For local dev, add Dozzle to docker-compose.yml:
   ```yaml
   dozzle:
     image: amir20/dozzle:latest
     ports: ["9999:8080"]
     volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
   ```
   Live log viewer at http://localhost:9999

5. Correlation IDs across Celery:
   - RequestID middleware already exists — ensure request_id propagates to Celery tasks via task headers
   - All Celery task logs should include originating request_id for end-to-end tracing

Show complete logging configuration, Cloud Logging field mapping, Dozzle docker-compose addition, and Celery correlation ID propagation.
