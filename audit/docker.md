# Docker Audit — StudyForge

**File:** `docker-compose.yml` (project root)

---

## Service Inventory

| # | Service | Image / Build | Exposed Ports | Healthcheck | Depends On |
|---|---|---|---|---|---|
| 1 | `postgres` | `timescale/timescaledb:latest-pg16` | 5432 | `pg_isready` | — |
| 2 | `redis` | `redis:7-alpine` | 6379 | `redis-cli ping` | — |
| 3 | `minio` | `minio/minio:latest` | 9000, 9001 | curl `/minio/health/live` | — |
| 4 | `chroma_server` | `chromadb/chroma:0.5.3` | 8001→8000 | python urllib heartbeat | — |
| 5 | `migrate` | `./apps/api` build | — | — | postgres (healthy) |
| 6 | `api` | `./apps/api` build | 8000 | — | postgres, redis, minio, chroma, migrate |
| 7 | `celery_worker` | `./apps/api` build | — | — | redis, postgres, minio, chroma, migrate |
| 8 | `celery_beat` | `./apps/api` build | — | — | redis, migrate |
| 9 | `celery_analytics` | `./apps/api` build | — | — | redis, postgres, migrate |
| 10 | `web` | `./apps/web` build | 3000 | — | api |

**Total services: 10** (spec calls for 8 core services — compose has 10 because it separates `migrate` as a one-shot service and splits Celery into `celery_worker`, `celery_beat`, and `celery_analytics`).

---

## Spec vs Actual

| Spec service | Compose service | Match |
|---|---|---|
| postgres | `postgres` (timescaledb) | PASS |
| redis | `redis` | PASS |
| S3-compatible object store | `minio` | PASS |
| ChromaDB | `chroma_server` | PASS |
| API (FastAPI) | `api` | PASS |
| Celery worker (files/slides/notifications) | `celery_worker` | PASS |
| Celery beat | `celery_beat` | PASS |
| Celery analytics worker | `celery_analytics` | PASS |
| Frontend (Next.js) | `web` | PASS |
| DB migration runner | `migrate` | PASS (bonus one-shot) |

---

## Findings

### PASS items

- **Healthchecks**: All infrastructure services (postgres, redis, minio, chroma) have healthchecks. The `api`, `celery_worker`, and `celery_beat` services use `condition: service_healthy` / `condition: service_completed_successfully` for proper startup ordering.
- **ChromaDB version pinned**: `chromadb/chroma:0.5.3` — pinned, not `latest`. Good practice.
- **TimescaleDB for postgres**: Uses `timescale/timescaledb:latest-pg16` — provides time-series extensions useful for analytics.
- **Celery worker flags**: `--concurrency=1 --max-tasks-per-child=5 --pool=solo` — solo pool is correct for async tasks using `asyncio`; prevents event-loop conflicts.
- **Volume mounts for development**: All build services mount `./apps/api:/app` (hot reload). Web mounts `./apps/web:/app` with anonymous volumes for `node_modules` and `.next` to prevent host override.
- **Separate analytics worker**: `celery_analytics` consumes only the `analytics` queue, isolating potentially long-running KPI computations from the main worker.

### Issues

#### 1. `minio` uses `latest` tag (not pinned)

```yaml
image: minio/minio:latest
```

MinIO has had breaking changes between versions. Using `latest` risks unexpected breakage on `docker compose pull`. Should pin to a specific release (e.g., `minio/minio:RELEASE.2024-11-07T00-52-20Z`).

#### 2. `api` service has no healthcheck

The `api` service exposes port 8000 but has no `healthcheck` defined. The `web` service depends on `api` with just `- api` (no condition), meaning Next.js may start before the FastAPI app is ready to accept connections. This causes `ECONNREFUSED` errors during initial startup.

**Fix**: Add a healthcheck to `api`:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
  interval: 10s
  timeout: 5s
  retries: 5
```
And change the `web` depends_on to `condition: service_healthy`.

#### 3. `celery_beat` missing `minio` and `chroma` dependencies

`celery_beat` only depends on `redis` and `migrate`. If a beat-triggered task (e.g., `flag_at_risk_students`) eventually calls a service that uses minio or chroma, the beat scheduler itself doesn't need those — but the worker that receives the task does. This is architecturally fine since beat only schedules, not executes. However, if the `celery_beat` service needs to import modules that import `storage_service` at module level (triggering `StorageService.__init__`), it will fail if minio isn't reachable. Worth monitoring.

#### 4. `celery_beat` missing `S3_AUTO_CREATE_BUCKET` env var

`celery_worker` and `api` set `S3_AUTO_CREATE_BUCKET: "true"` but `celery_beat` does not. If beat imports the storage singleton at module load time, the bucket creation attempt may fail or be skipped. Low risk since beat doesn't execute storage tasks directly.

#### 5. `web` uses `target: dev` build stage

```yaml
build:
  context: ./apps/web
  dockerfile: Dockerfile
  target: dev
```

This is correct for development. The `Dockerfile` must define a `dev` stage. If the Dockerfile is changed and the `dev` stage is removed or renamed, this silently falls back to the final stage. Acceptable for local development but worth documenting.

#### 6. No resource limits

No `mem_limit`, `cpus`, or `deploy.resources` constraints are set on any service. For local development this is fine. For staging/production deployment via Docker Compose, the ChromaDB and ML model loading (cross-encoder) can consume large amounts of memory without bound. Not a bug but a production readiness gap.

---

## Summary

The `docker-compose.yml` correctly defines all required services with proper dependency ordering and healthchecks for infrastructure. The two most actionable issues are:
1. Adding a healthcheck to the `api` service so `web` starts after the API is ready.
2. Pinning the `minio` image version.
