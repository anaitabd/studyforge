Add Flower (Celery monitoring dashboard) to development and production environments.

Steps:
1. Add Flower to docker-compose.yml:
   ```yaml
   flower:
     image: mher/flower:2.0
     command: celery flower --broker=redis://redis:6379/0 --port=5555 --basic_auth=admin:changeme
     ports: ["5555:5555"]
     depends_on: [redis, celery_worker]
   ```
   Local dev: http://localhost:5555

2. In production (Cloud Run / GCP):
   - Deploy Flower as a separate Cloud Run service
   - Auth via environment variable FLOWER_BASIC_AUTH=user:password
   - Restrict access with Cloud IAP (Identity-Aware Proxy)

3. Add task queue stats to admin panel:
   - In GET /admin/health/overview, call Flower's REST API: GET http://flower:5555/api/workers
   - Show as metric cards: total workers, active tasks, failed today, processed total

4. Configure persistent event storage:
   - Use Redis as Flower event backend so history survives Flower restarts
   - Set FLOWER_PERSISTENT=True, FLOWER_DB=/data/flower.db

5. Add custom task failure events:
   - When process_file_task fails permanently (after 3 retries), emit a custom event
   - Flower shows these in a "Failed Tasks" panel

Show complete docker-compose addition, production deployment config, and admin panel task queue integration.
