import pytest
from unittest.mock import MagicMock, patch, AsyncMock


def _make_svc():
    from app.services.ai_service import AIService
    svc = AIService.__new__(AIService)
    svc._is_gcp = True
    svc.chat_model = "gemini-2.5-flash"
    svc.embed_model = "text-multilingual-embedding-002"
    provider = MagicMock()
    provider.chat = AsyncMock()
    provider.embed = AsyncMock()
    svc.provider = provider
    return svc


@pytest.mark.asyncio
async def test_rewrite_query_returns_string():
    svc = _make_svc()
    svc.provider.chat.return_value = "What is photosynthesis?"
    result = await svc.rewrite_query("what is that thing plants do", [])
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_structured_json_parses_valid_json():
    svc = _make_svc()
    svc.provider.generate_structured_json = AsyncMock(return_value=[{"question": "test", "answer": "a"}])
    result = await svc.generate_structured_json("make questions", "array of QA pairs")
    assert isinstance(result, list)
    assert result[0]["question"] == "test"


def test_vector_store_collection_name_org():
    from app.services.vector_store import VectorStore
    vs = VectorStore.__new__(VectorStore)
    name = vs._collection_name("org-abc-123", "user-xyz")
    assert name.startswith("org-")
    assert len(name) <= 63


def test_vector_store_collection_name_user():
    from app.services.vector_store import VectorStore
    vs = VectorStore.__new__(VectorStore)
    name = vs._collection_name(None, "user-xyz-789")
    assert name.startswith("user-")
    assert len(name) <= 63


def test_reranker_sorts_by_similarity():
    from app.services.reranker import Reranker
    r = Reranker()
    chunks = [
        {"text": "chunk 1", "similarity_score": 0.8},
        {"text": "chunk 2", "similarity_score": 0.9},
        {"text": "chunk 3", "similarity_score": 0.75},
    ]
    result = r.rerank("test query", chunks, top_k=2)
    assert len(result) == 2
    assert result[0]["similarity_score"] == 0.9


def test_rate_limiter_feature_check():
    from app.core.rate_limiter import RateLimiter
    rl = RateLimiter()
    assert rl.check_feature("school", "teacher_dashboard") is True
    assert rl.check_feature("free", "teacher_dashboard") is False
    assert rl.check_feature("personal", "flashcards") is True
    assert rl.check_feature("free", "collaborative_rooms") is False
