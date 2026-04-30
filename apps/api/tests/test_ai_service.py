import pytest
from unittest.mock import MagicMock, patch, AsyncMock


@pytest.mark.asyncio
async def test_rewrite_query_returns_string():
    with patch("app.services.ai_service.AIService._complete_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = "What is photosynthesis?"
        from app.services.ai_service import AIService
        svc = AIService.__new__(AIService)
        svc.client = MagicMock()
        svc.chat_model = "test-model"
        svc.embed_model = "test-embed"
        result = await svc.rewrite_query("what is that thing plants do", [])
        assert isinstance(result, str)
        assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_structured_json_parses_valid_json():
    with patch("app.services.ai_service.AIService._complete_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = '[{"question": "test", "answer": "a"}]'
        from app.services.ai_service import AIService
        svc = AIService.__new__(AIService)
        svc.client = MagicMock()
        svc.chat_model = "test-model"
        svc.embed_model = "test-embed"
        result = await svc.generate_structured_json("make questions", "array of QA pairs")
        assert isinstance(result, list)
        assert result[0]["question"] == "test"


@pytest.mark.asyncio
async def test_generate_structured_json_strips_markdown():
    with patch("app.services.ai_service.AIService._complete_with_retry", new_callable=AsyncMock) as mock:
        mock.return_value = '```json\n{"key": "value"}\n```'
        from app.services.ai_service import AIService
        svc = AIService.__new__(AIService)
        svc.client = MagicMock()
        svc.chat_model = "test-model"
        svc.embed_model = "test-embed"
        result = await svc.generate_structured_json("make json", "object")
        assert result["key"] == "value"


def test_vector_store_collection_name():
    from app.services.vector_store import VectorStore
    vs = VectorStore.__new__(VectorStore)
    name = vs._collection_name("abc-123")
    assert name.startswith("group-")
    assert len(name) <= 63


def test_reranker_fallback_without_model():
    from app.services.reranker import Reranker
    r = Reranker()
    chunks = [
        {"text": "chunk 1", "similarity_score": 0.8},
        {"text": "chunk 2", "similarity_score": 0.9},
        {"text": "chunk 3", "similarity_score": 0.75},
    ]
    # Test fallback sort
    with patch("app.services.reranker._get_model", return_value=None):
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
