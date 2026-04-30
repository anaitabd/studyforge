import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_rag_no_chunks_returns_fallback():
    """When ChromaDB returns no chunks, we get the no-context fallback message."""
    with patch("app.services.rag_service.ai_service") as mock_ai, \
         patch("app.services.rag_service.vector_store") as mock_vs, \
         patch("app.services.rag_service.reranker"):

        mock_ai.rewrite_query = AsyncMock(return_value="rewritten query")
        mock_ai.embed_texts = AsyncMock(return_value=[[0.1] * 1024])
        mock_vs.query.return_value = []  # No chunks found

        from app.services.rag_service import RAGService
        svc = RAGService()

        events = []
        async for event in svc.query("group-1", "what is photosynthesis?", []):
            events.append(event)

        types = [e["type"] for e in events]
        assert "token" in types
        assert "done" in types
        token_content = "".join(e.get("content", "") for e in events if e["type"] == "token")
        assert "couldn't find" in token_content.lower()


@pytest.mark.asyncio
async def test_rag_with_chunks_yields_token_and_citations():
    """When chunks exist, we yield tokens followed by citations."""

    async def fake_stream(*args, **kwargs):
        for word in ["Photosynthesis ", "is ", "a ", "process."]:
            yield word

    with patch("app.services.rag_service.ai_service") as mock_ai, \
         patch("app.services.rag_service.vector_store") as mock_vs, \
         patch("app.services.rag_service.reranker") as mock_reranker:

        mock_ai.rewrite_query = AsyncMock(return_value="what is photosynthesis")
        mock_ai.embed_texts = AsyncMock(return_value=[[0.1] * 1024])
        mock_ai.chat_completion = AsyncMock(return_value=fake_stream())
        mock_ai.generate_structured_json = AsyncMock(
            return_value=["What drives photosynthesis?", "What are the products?", "Where does it occur?"]
        )

        mock_vs.query.return_value = [
            {
                "text": "Photosynthesis is the process by which plants convert sunlight into energy.",
                "metadata": {"file_name": "bio.pdf", "page_number": 5, "file_id": "f1", "chunk_index": 0},
                "similarity_score": 0.88,
            }
        ]
        mock_reranker.rerank.return_value = [
            {
                "text": "Photosynthesis is the process by which plants convert sunlight into energy.",
                "metadata": {"file_name": "bio.pdf", "page_number": 5, "file_id": "f1", "chunk_index": 0},
                "similarity_score": 0.88,
                "reranker_score": 0.95,
            }
        ]

        from app.services.rag_service import RAGService
        svc = RAGService()

        events = []
        async for event in svc.query("group-1", "what is photosynthesis?", []):
            events.append(event)

        types = [e["type"] for e in events]
        assert "token" in types
        assert "citations" in types
        assert "suggestions" in types
        assert "done" in types

        citation_event = next(e for e in events if e["type"] == "citations")
        assert len(citation_event["data"]) == 1
        assert citation_event["data"][0]["file_name"] == "bio.pdf"
        assert citation_event["data"][0]["page"] == 5


def test_build_system_prompt_contains_context():
    from app.services.rag_service import RAGService
    svc = RAGService()
    prompt = svc._build_system_prompt("Test context about biology", "en")
    assert "Test context about biology" in prompt
    assert "ONLY" in prompt
    assert "English" in prompt


def test_build_system_prompt_french():
    from app.services.rag_service import RAGService
    svc = RAGService()
    prompt = svc._build_system_prompt("Contexte", "fr")
    assert "French" in prompt
