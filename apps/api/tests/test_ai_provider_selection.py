from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError


@patch("app.services.ai_service.NvidiaAIProvider")
@patch("app.services.ai_service.BedrockAIProvider")
def test_provider_selection_bedrock(mock_bedrock, mock_nvidia):
    from app.services.ai_service import AIService

    mock_bedrock.return_value.chat_model = "c"
    mock_bedrock.return_value.embed_model = "e"
    with patch("app.services.ai_service.settings.AI_PROVIDER", "bedrock"):
        svc = AIService()
    assert svc.provider == mock_bedrock.return_value
    mock_nvidia.assert_not_called()


@patch("app.services.ai_service.NvidiaAIProvider")
@patch("app.services.ai_service.BedrockAIProvider")
def test_provider_selection_defaults_nvidia(mock_bedrock, mock_nvidia):
    from app.services.ai_service import AIService

    mock_nvidia.return_value.chat_model = "c"
    mock_nvidia.return_value.embed_model = "e"
    with patch("app.services.ai_service.settings.AI_PROVIDER", "nvidia"):
        svc = AIService()
    assert svc.provider == mock_nvidia.return_value
    mock_bedrock.assert_not_called()


@pytest.mark.asyncio
async def test_bedrock_retry_on_throttling_then_success():
    from app.services.ai_service import BedrockAIProvider

    provider = BedrockAIProvider.__new__(BedrockAIProvider)
    provider.client = MagicMock()

    throttling = ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": "slow down"}, "ResponseMetadata": {"HTTPStatusCode": 429}},
        "InvokeModel",
    )
    success_body = MagicMock()
    success_body.read.return_value = b'{"embedding": [0.1, 0.2]}'

    provider.client.invoke_model.side_effect = [throttling, {"body": success_body}]

    with patch("app.services.ai_service.asyncio.sleep", return_value=None):
        result = await provider._invoke_with_retry({"inputText": "hello"}, "embed-model")

    assert result["embedding"] == [0.1, 0.2]
    assert provider.client.invoke_model.call_count == 2


@pytest.mark.asyncio
async def test_bedrock_retry_on_timeout_and_5xx_then_raises():
    from app.services.ai_service import BedrockAIProvider

    provider = BedrockAIProvider.__new__(BedrockAIProvider)
    provider.client = MagicMock()

    timeout_error = ReadTimeoutError(endpoint_url="https://bedrock-runtime.us-east-1.amazonaws.com", error="timeout")
    server_error = ClientError(
        {"Error": {"Code": "InternalServerException", "Message": "boom"}, "ResponseMetadata": {"HTTPStatusCode": 503}},
        "InvokeModel",
    )
    provider.client.invoke_model.side_effect = [timeout_error, server_error, server_error]

    with patch("app.services.ai_service.asyncio.sleep", return_value=None):
        with pytest.raises(ClientError):
            await provider._invoke_with_retry({"messages": []}, "chat-model")

    assert provider.client.invoke_model.call_count == 3
