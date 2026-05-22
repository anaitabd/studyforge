from unittest.mock import MagicMock, patch, AsyncMock

import pytest


def _make_gemini_provider():
    from app.services.ai_service import GeminiVertexProvider
    p = GeminiVertexProvider.__new__(GeminiVertexProvider)
    p.chat_model_name = "gemini-2.5-flash"
    p.embed_model_name = "text-multilingual-embedding-002"
    p.chat_model = p.chat_model_name
    p.embed_model = p.embed_model_name
    p.GenerativeModel = MagicMock()
    return p


def _make_claude_provider():
    from app.services.ai_service import ClaudeVertexProvider
    p = ClaudeVertexProvider.__new__(ClaudeVertexProvider)
    p.chat_model = "claude-sonnet-4-5@20250929"
    p.chat_model_name = p.chat_model
    p.embed_model = "text-multilingual-embedding-002"
    p.embed_model_name = p.embed_model
    p.client = MagicMock()
    p._embed_provider = MagicMock()
    p._embed_provider.embed = AsyncMock(return_value=[[0.1, 0.2]])
    return p


@patch("app.services.ai_service.GeminiVertexProvider")
def test_provider_selection_gemini(mock_gemini):
    from app.services.ai_service import AIService

    mock_gemini.return_value.chat_model = "gemini-2.5-flash"
    mock_gemini.return_value.embed_model = "text-multilingual-embedding-002"
    with patch("app.services.ai_service.settings.AI_PROVIDER", "gemini"):
        svc = AIService()
    assert svc.provider == mock_gemini.return_value


@patch("app.services.ai_service.ClaudeVertexProvider")
def test_provider_selection_claude_vertex(mock_claude):
    from app.services.ai_service import AIService

    mock_claude.return_value.chat_model = "claude-sonnet-4-5@20250929"
    mock_claude.return_value.embed_model = "text-multilingual-embedding-002"
    with patch("app.services.ai_service.settings.AI_PROVIDER", "claude_vertex"):
        svc = AIService()
    assert svc.provider == mock_claude.return_value


@patch("app.services.ai_service.GeminiVertexProvider")
def test_unknown_provider_defaults_to_gemini(mock_gemini):
    from app.services.ai_service import AIService

    mock_gemini.return_value.chat_model = "gemini-2.5-flash"
    mock_gemini.return_value.embed_model = "text-multilingual-embedding-002"
    with patch("app.services.ai_service.settings.AI_PROVIDER", "unknown_provider"):
        svc = AIService()
    assert svc.provider == mock_gemini.return_value


@pytest.mark.asyncio
async def test_claude_provider_delegates_embed_to_gemini():
    p = _make_claude_provider()
    result = await p.embed(["hello world"])
    p._embed_provider.embed.assert_called_once_with(["hello world"])
    assert result == [[0.1, 0.2]]
