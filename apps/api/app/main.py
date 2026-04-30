import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import RequestIDMiddleware
from app.api.v1 import auth, groups, files, chat, exams, rooms, analytics, teacher, admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_V1_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting StudyForge API...")
    # Pre-load reranker model in background
    from app.services.reranker import _get_model
    asyncio.get_event_loop().run_in_executor(None, _get_model)
    yield
    logger.info("Shutting down StudyForge API...")


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
app.include_router(rooms.router, prefix=API_V1_PREFIX)
app.include_router(analytics.router, prefix=API_V1_PREFIX)
app.include_router(teacher.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "studyforge-api"}


@app.get("/")
async def root():
    return {"message": "StudyForge API v1.0"}
