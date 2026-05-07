import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import RequestIDMiddleware
import app.models  # noqa: F401 — registers all ORM models with SQLAlchemy metadata
from app.api.v1 import auth, groups, files, chat, exams, flashcards, rooms, analytics, teacher, admin, notifications, learning_paths, me, slides

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_V1_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting StudyForge API...")
    _log_chroma_status()
    # Fire-and-forget warm-up of the cross-encoder reranker (~300MB, ~3s).
    # Startup is not blocked. If a chat query lands before warm-up finishes
    # it will block on first model load — acceptable for now; if deployed
    # behind a load balancer, gate ingress with /health/ready until ready.
    from app.services.reranker import _get_model
    asyncio.get_event_loop().run_in_executor(None, _get_model)
    yield
    logger.info("Shutting down StudyForge API...")


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

# RequestIDMiddleware is added first so it runs outermost (last added = outermost in Starlette)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "studyforge-api"}


@app.get("/")
async def root():
    return {"message": "StudyForge API v1.0"}
