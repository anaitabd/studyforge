import asyncio
import json
import logging
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.middleware import RequestIDMiddleware

limiter = Limiter(key_func=get_remote_address)
import app.models  # noqa: F401 — registers all ORM models with SQLAlchemy metadata
from app.api.v1 import auth, groups, files, chat, exams, flashcards, rooms, analytics, teacher, admin, notifications, learning_paths, me, slides, organizations, live_quiz, concepts, webhooks, search, bac


class CloudWatchJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "environment": settings.APP_ENV.value,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def _configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(CloudWatchJsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


_configure_logging()
logger = logging.getLogger(__name__)

API_V1_PREFIX = "/api/v1"
startup_state = {"ready": False, "started_at": time.time()}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting StudyForge API")
    _log_chroma_status()
    startup_state["ready"] = False

    from app.services.reranker import reranker  # noqa: F401 — import triggers singleton init

    from app.core.database import AsyncSessionLocal
    from app.services.gamification_service import seed_badges
    async with AsyncSessionLocal() as db:
        await seed_badges(db)
    logger.info("Badge definitions seeded")

    startup_state["ready"] = True
    logger.info("Reranker warmup complete")
    yield
    logger.info("Shutting down StudyForge API")


def _log_chroma_status():
    host = f"{settings.CHROMA_HOST}:{settings.CHROMA_PORT}"
    try:
        from app.services.vector_store import vector_store
        client = vector_store._get_client()
        client.heartbeat()
        count = len(client.list_collections())
        logger.info(f"ChromaDB host={host} collections={count} (heartbeat OK)")
    except Exception as e:
        logger.warning(f"ChromaDB status check failed for host={host}: {e}")


app = FastAPI(
    title="StudyForge API",
    version="1.0.0",
    description="AI-powered educational RAG platform",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(groups.router, prefix=API_V1_PREFIX)
app.include_router(files.router, prefix=API_V1_PREFIX)
app.include_router(chat.router, prefix=API_V1_PREFIX)
app.include_router(exams.router, prefix=API_V1_PREFIX)
app.include_router(flashcards.router, prefix=API_V1_PREFIX)
app.include_router(rooms.router, prefix=API_V1_PREFIX)
app.include_router(analytics.router, prefix=API_V1_PREFIX)
app.include_router(teacher.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)
app.include_router(notifications.router, prefix=API_V1_PREFIX)
app.include_router(learning_paths.router, prefix=API_V1_PREFIX)
app.include_router(me.router, prefix=API_V1_PREFIX)
app.include_router(slides.router, prefix=API_V1_PREFIX)
app.include_router(organizations.router, prefix=API_V1_PREFIX)
app.include_router(live_quiz.router, prefix=API_V1_PREFIX)
app.include_router(concepts.router, prefix=API_V1_PREFIX)
app.include_router(webhooks.router, prefix=API_V1_PREFIX)
app.include_router(search.router, prefix=API_V1_PREFIX)
app.include_router(bac.router, prefix=API_V1_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "studyforge-api", "env": settings.APP_ENV.value}


@app.get("/health/ready")
async def readiness():
    return {"status": "ready" if startup_state["ready"] else "starting", "ready": startup_state["ready"]}


@app.get("/")
async def root():
    return {"message": "StudyForge API v1.0"}
