import asyncio
import json
import logging
import random
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError, ReadTimeoutError
from openai import APIError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseAIProvider(ABC):
    chat_model: str
    embed_model: str

    @abstractmethod
    async def complete(self, kwargs: dict[str, Any]) -> str:
        raise NotImplementedError

    @abstractmethod
    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        raise NotImplementedError

    @abstractmethod
    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        raise NotImplementedError


class NvidiaAIProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.client = OpenAI(base_url=settings.NVIDIA_BASE_URL, api_key=settings.NVIDIA_API_KEY)
        self.chat_model = settings.NVIDIA_CHAT_MODEL
        self.embed_model = settings.NVIDIA_EMBED_MODEL

    async def complete(self, kwargs: dict[str, Any]) -> str:
        backoff = [2, 5, 10]
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: self.client.chat.completions.create(**kwargs)
                )
                return response.choices[0].message.content or ""
            except RateLimitError:
                if attempt == 2:
                    raise
                wait = backoff[attempt] + random.uniform(0, 1)
                logger.warning(f"Rate limited by NVIDIA API, retrying in {wait:.1f}s...")
                await asyncio.sleep(wait)
            except APITimeoutError:
                if attempt == 2:
                    raise
                wait = backoff[attempt] + random.uniform(0, 1)
                logger.warning(f"NVIDIA API timeout, retrying in {wait:.1f}s...")
                await asyncio.sleep(wait)
            except APIStatusError as e:
                if e.status_code in (502, 503, 504) and attempt < 2:
                    wait = backoff[attempt] + random.uniform(0, 1)
                    logger.warning(f"NVIDIA API {e.status_code}, retrying in {wait:.1f}s...")
                    await asyncio.sleep(wait)
                    continue
                raise
            except APIError as e:
                if attempt == 2:
                    raise
                logger.warning(f"NVIDIA API error: {e}, retrying...")
                await asyncio.sleep(backoff[attempt])
        return ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        def _sync_stream():
            return self.client.chat.completions.create(**kwargs)

        stream = await asyncio.get_event_loop().run_in_executor(None, _sync_stream)
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        batch_size = 96
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for attempt in range(3):
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda b=batch: self.client.embeddings.create(
                            input=b,
                            model=self.embed_model,
                            encoding_format="float",
                            extra_body={"input_type": input_type, "truncate": "END"},
                        ),
                    )
                    all_embeddings.extend(item.embedding for item in response.data)
                    break
                except RateLimitError:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2 ** attempt)
                except Exception as e:
                    logger.error(f"Embedding error on batch {i}: {e}")
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1)

        return all_embeddings


class BedrockAIProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.client = boto3.client("bedrock-runtime", region_name=settings.AWS_REGION)
        self.chat_model = settings.BEDROCK_CHAT_MODEL_ID
        self.embed_model = settings.BEDROCK_EMBED_MODEL_ID

    def _is_retryable(self, error: Exception) -> bool:
        if isinstance(error, (EndpointConnectionError, ReadTimeoutError, TimeoutError)):
            return True
        if isinstance(error, ClientError):
            code = error.response.get("Error", {}).get("Code", "")
            status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            return code in {"ThrottlingException", "TooManyRequestsException", "ServiceUnavailableException"} or status in {
                500,
                502,
                503,
                504,
            }
        return False

    async def _invoke_with_retry(self, payload: dict[str, Any], model_id: str) -> dict[str, Any]:
        backoff = [1, 2, 4]
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.invoke_model(
                        modelId=model_id,
                        contentType="application/json",
                        accept="application/json",
                        body=json.dumps(payload),
                    ),
                )
                return json.loads(response["body"].read())
            except Exception as exc:
                if attempt == 2 or not self._is_retryable(exc):
                    raise
                wait = backoff[attempt] + random.uniform(0, 0.5)
                logger.warning(f"Bedrock transient error ({type(exc).__name__}), retrying in {wait:.1f}s")
                await asyncio.sleep(wait)
        return {}

    async def complete(self, kwargs: dict[str, Any]) -> str:
        messages = kwargs.get("messages", [])
        temp = kwargs.get("temperature", 0.7)
        max_tokens = kwargs.get("max_tokens", 1024)
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temp,
            "messages": [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in messages],
        }
        data = await self._invoke_with_retry(payload, self.chat_model)
        content = data.get("content", [])
        if content and isinstance(content, list):
            return "".join(part.get("text", "") for part in content if isinstance(part, dict))
        return ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        text = await self.complete(kwargs)
        yield text

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        for text in texts:
            payload = {"inputText": text}
            data = await self._invoke_with_retry(payload, self.embed_model)
            vector = data.get("embedding") or []
            vectors.append(vector)
        return vectors


class AIService:
    def __init__(self):
        provider = settings.AI_PROVIDER.lower()
        if provider == "bedrock":
            self.provider: BaseAIProvider = BedrockAIProvider()
        else:
            self.provider = NvidiaAIProvider()
        self.chat_model = self.provider.chat_model
        self.embed_model = self.provider.embed_model

    async def chat_completion(self, messages: list[dict], stream: bool = False, temperature: float = 0.7, max_tokens: int = 4096) -> str | AsyncGenerator[str, None]:
        kwargs = dict(model=self.chat_model, messages=messages, temperature=temperature, top_p=0.95, max_tokens=max_tokens, stream=stream)
        if stream:
            return self.provider.stream(kwargs)
        return await self._complete_with_retry(kwargs)

    async def _complete_with_retry(self, kwargs: dict) -> str:
        return await self.provider.complete(kwargs)

    async def _stream_completion(self, kwargs: dict) -> AsyncGenerator[str, None]:
        async for chunk in self.provider.stream(kwargs):
            yield chunk

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        return await self.provider.embed_texts(texts, input_type)

    async def rewrite_query(self, query: str, chat_history: list[dict]) -> str:
        recent_history = chat_history[-6:] if len(chat_history) > 6 else chat_history
        history_str = ""
        if recent_history:
            history_str = "\n".join(f"{m['role'].upper()}: {m['content'][:200]}" for m in recent_history)
        messages = [
            {"role": "system", "content": "You are a query optimizer for an educational search engine. Rewrite the user's question as a clear, standalone, search-optimized query that captures the full intent — even if the original question references prior conversation. Return ONLY the rewritten query, nothing else. No explanation, no punctuation at the end."},
            {"role": "user", "content": f"Conversation history:\n{history_str}\n\nCurrent question: {query}\n\nRewritten standalone query:"},
        ]
        result = await self._complete_with_retry(dict(model=self.chat_model, messages=messages, temperature=0.3, max_tokens=256, stream=False))
        return result.strip() or query

    async def generate_structured_json(self, prompt: str, schema_description: str, max_tokens: int = 8192) -> dict | list:
        messages = [
            {"role": "system", "content": "You are a JSON generation assistant. You must respond with ONLY valid JSON — no explanation, no markdown code blocks, no backticks. " f"The JSON must match this schema: {schema_description}. " "Start your response with {{ or [ immediately."},
            {"role": "user", "content": prompt},
        ]
        for attempt in range(3):
            try:
                raw = await self._complete_with_retry(dict(model=self.chat_model, messages=messages, temperature=0.4, max_tokens=max_tokens, stream=False))
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()
                return json.loads(raw)
            except json.JSONDecodeError as e:
                if attempt == 2:
                    raise ValueError(f"Failed to get valid JSON after 3 attempts: {e}")
                messages.append({"role": "user", "content": "Your previous response was not valid JSON. Please try again and return ONLY the JSON."})

    async def moderate_content(self, text: str) -> bool:
        messages = [
            {"role": "system", "content": "You are a content moderation assistant for an educational platform. Respond with ONLY 'safe' or 'unsafe'."},
            {"role": "user", "content": f"Is this text appropriate for students? Text: {text[:500]}"},
        ]
        try:
            result = await self._complete_with_retry(dict(model=self.chat_model, messages=messages, temperature=0.0, max_tokens=10, stream=False))
            return "unsafe" not in result.lower()
        except Exception:
            return True


ai_service = AIService()
