import asyncio
import json
import logging
import random
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator

from openai import APIError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)

_BACKOFF = [2, 5, 10]


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


# ─── OpenAI-compatible provider ───────────────────────────────────────────────
# Works with any endpoint that speaks the OpenAI Responses API:
# AWS Bedrock OpenAI compat, Azure OpenAI, direct api.openai.com, etc.

class OpenAICompatProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY or "dummy",
            base_url=settings.OPENAI_BASE_URL or None,
            timeout=60.0,
            max_retries=0,
        )
        self.chat_model = settings.OPENAI_CHAT_MODEL
        self.embed_model = settings.OPENAI_EMBED_MODEL

    def _build_input(self, kwargs: dict[str, Any]) -> dict[str, Any]:
        """Convert shared kwargs into responses.create parameters."""
        return {
            "model": kwargs.get("model", self.chat_model),
            "input": kwargs.get("messages", []),
            "temperature": kwargs.get("temperature", 0.7),
            "max_output_tokens": kwargs.get("max_tokens", 4096),
        }

    async def complete(self, kwargs: dict[str, Any]) -> str:
        params = self._build_input(kwargs)
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None, lambda p=params: self.client.responses.create(**p)
                )
                return response.output_text or ""
            except RateLimitError:
                if attempt == 2:
                    raise
                wait = _BACKOFF[attempt] + random.uniform(0, 1)
                logger.warning(f"Rate limited, retrying in {wait:.1f}s…")
                await asyncio.sleep(wait)
            except APITimeoutError:
                if attempt == 2:
                    raise
                wait = _BACKOFF[attempt] + random.uniform(0, 1)
                logger.warning(f"Timeout, retrying in {wait:.1f}s…")
                await asyncio.sleep(wait)
            except APIStatusError as e:
                if e.status_code in (502, 503, 504) and attempt < 2:
                    wait = _BACKOFF[attempt] + random.uniform(0, 1)
                    logger.warning(f"HTTP {e.status_code}, retrying in {wait:.1f}s…")
                    await asyncio.sleep(wait)
                    continue
                raise
            except APIError as e:
                if attempt == 2:
                    raise
                logger.warning(f"API error: {e}, retrying…")
                await asyncio.sleep(_BACKOFF[attempt])
        return ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        params = {**self._build_input(kwargs), "stream": True}

        def _sync_stream(p=params):
            return self.client.responses.create(**p)

        response_stream = await asyncio.get_event_loop().run_in_executor(None, _sync_stream)
        for event in response_stream:
            if event.type == "response.output_text.delta":
                yield event.delta

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


# ─── NVIDIA provider (legacy) ─────────────────────────────────────────────────

class NvidiaAIProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.client = OpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
            timeout=60.0,
            max_retries=0,
        )
        self.chat_model = settings.NVIDIA_CHAT_MODEL
        self.embed_model = settings.NVIDIA_EMBED_MODEL

    async def complete(self, kwargs: dict[str, Any]) -> str:
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: self.client.chat.completions.create(**kwargs)
                )
                return response.choices[0].message.content or ""
            except RateLimitError:
                if attempt == 2:
                    raise
                wait = _BACKOFF[attempt] + random.uniform(0, 1)
                await asyncio.sleep(wait)
            except APITimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(_BACKOFF[attempt] + random.uniform(0, 1))
            except APIStatusError as e:
                if e.status_code in (502, 503, 504) and attempt < 2:
                    await asyncio.sleep(_BACKOFF[attempt] + random.uniform(0, 1))
                    continue
                raise
            except APIError:
                if attempt == 2:
                    raise
                await asyncio.sleep(_BACKOFF[attempt])
        return ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        stream = await asyncio.get_event_loop().run_in_executor(
            None, lambda: self.client.chat.completions.create(**kwargs)
        )
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


# ─── Ollama provider (local NVIDIA GPU) ──────────────────────────────────────
# Requires Ollama running locally (or in docker-compose with GPU passthrough).
# Chat model:  any model pulled via `ollama pull <model>` (e.g. llama3.2:3b)
# Embed model: `ollama pull nomic-embed-text`  — 768-dim, free, runs on GPU
#
# Ollama exposes a fully OpenAI-compatible endpoint at /v1, so the standard
# openai Python client works without any extra dependencies.

class OllamaProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.client = OpenAI(
            base_url=settings.OLLAMA_BASE_URL,
            api_key="ollama",  # Ollama ignores the key; the client requires a value
        )
        self.chat_model = settings.OLLAMA_CHAT_MODEL
        self.embed_model = settings.OLLAMA_EMBED_MODEL

    async def complete(self, kwargs: dict[str, Any]) -> str:
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.chat.completions.create(
                        model=kwargs.get("model", self.chat_model),
                        messages=kwargs.get("messages", []),
                        temperature=kwargs.get("temperature", 0.7),
                        max_tokens=kwargs.get("max_tokens", 4096),
                        stream=False,
                    ),
                )
                return response.choices[0].message.content or ""
            except APITimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(_BACKOFF[attempt])
            except APIError:
                if attempt == 2:
                    raise
                await asyncio.sleep(_BACKOFF[attempt])
        return ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        response_stream = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.chat.completions.create(
                model=kwargs.get("model", self.chat_model),
                messages=kwargs.get("messages", []),
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 4096),
                stream=True,
            ),
        )
        for chunk in response_stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        if not texts:
            return []
        all_embeddings: list[list[float]] = []
        batch_size = 64  # Ollama handles smaller batches better
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for attempt in range(3):
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda b=batch: self.client.embeddings.create(
                            model=self.embed_model,
                            input=b,
                        ),
                    )
                    all_embeddings.extend(item.embedding for item in response.data)
                    break
                except Exception as e:
                    logger.error(f"Ollama embedding error batch {i}: {e}")
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1)
        return all_embeddings


# ─── Bedrock provider (legacy) ────────────────────────────────────────────────

class BedrockAIProvider(BaseAIProvider):
    _semaphore: asyncio.Semaphore | None = None

    @classmethod
    def _get_semaphore(cls) -> asyncio.Semaphore:
        if cls._semaphore is None:
            cls._semaphore = asyncio.Semaphore(3)
        return cls._semaphore

    def __init__(self) -> None:
        import boto3
        from botocore.config import Config
        _config = Config(retries={"max_attempts": 10, "mode": "adaptive"}, read_timeout=120, connect_timeout=10)
        self.client = boto3.client("bedrock-runtime", region_name=settings.AWS_REGION, config=_config)
        self.chat_model = settings.BEDROCK_CHAT_MODEL_ID
        self.embed_model = settings.BEDROCK_EMBED_MODEL_ID

    def _is_transient(self, error: Exception) -> bool:
        try:
            from botocore.exceptions import ClientError, EndpointConnectionError, ReadTimeoutError
            if isinstance(error, (EndpointConnectionError, ReadTimeoutError, TimeoutError)):
                return True
            if isinstance(error, ClientError):
                code = error.response.get("Error", {}).get("Code", "")
                status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                return code in {"ServiceUnavailableException"} or status in {500, 502, 503, 504}
        except ImportError:
            pass
        return False

    async def _invoke_with_retry(self, payload: dict[str, Any], model_id: str) -> dict[str, Any]:
        async with self._get_semaphore():
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
                    if attempt == 2 or not self._is_transient(exc):
                        raise
                    wait = _BACKOFF[attempt] + random.uniform(0, 1)
                    logger.warning(f"Bedrock transient error ({type(exc).__name__}), retrying in {wait:.1f}s")
                    await asyncio.sleep(wait)
        return {}

    async def complete(self, kwargs: dict[str, Any]) -> str:
        messages = kwargs.get("messages", [])
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": kwargs.get("max_tokens", 1024),
            "temperature": kwargs.get("temperature", 0.7),
            "messages": [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in messages],
        }
        data = await self._invoke_with_retry(payload, self.chat_model)
        content = data.get("content", [])
        if content and isinstance(content, list):
            return "".join(part.get("text", "") for part in content if isinstance(part, dict))
        return ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        messages = kwargs.get("messages", [])
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": kwargs.get("max_tokens", 1024),
            "temperature": kwargs.get("temperature", 0.7),
            "messages": [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in messages],
        }

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _stream_sync() -> None:
            try:
                response = self.client.invoke_model_with_response_stream(
                    modelId=self.chat_model,
                    contentType="application/json",
                    accept="application/json",
                    body=json.dumps(payload),
                )
                for event in response["body"]:
                    chunk = event.get("chunk")
                    if chunk:
                        data = json.loads(chunk["bytes"])
                        if data.get("type") == "content_block_delta":
                            delta = data.get("delta", {})
                            if delta.get("type") == "text_delta":
                                loop.call_soon_threadsafe(queue.put_nowait, delta.get("text", ""))
            except Exception as exc:
                logger.error(f"Bedrock stream error: {exc}")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        loop.run_in_executor(None, _stream_sync)

        while True:
            token = await queue.get()
            if token is None:
                break
            yield token

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        for text in texts:
            data = await self._invoke_with_retry({"inputText": text}, self.embed_model)
            vectors.append(data.get("embedding") or [])
        return vectors


# ─── Gemini on Vertex AI ─────────────────────────────────────────────────────

class GeminiVertexProvider(BaseAIProvider):
    """Gemini 2.5 Flash via Vertex AI — uses Application Default Credentials.

    On Cloud Run: ADC is automatic.
    Locally: run `gcloud auth application-default login` once.
    Requires GOOGLE_PROJECT_ID and GOOGLE_LOCATION in env/.env.
    """

    def __init__(self, cfg=None) -> None:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        from app.core.config import settings as _s
        s = cfg or _s
        vertexai.init(project=s.GOOGLE_PROJECT_ID or None, location=s.GOOGLE_LOCATION)
        self.chat_model = s.GEMINI_CHAT_MODEL
        self.embed_model = s.GEMINI_EMBED_MODEL
        self._GenerativeModel = GenerativeModel

    def _to_contents(self, messages: list[dict]) -> tuple[str | None, list]:
        """Convert OpenAI-style messages → Vertex Content objects.
        Returns (system_instruction_or_None, contents_list).
        """
        from vertexai.generative_models import Content, Part
        system: str | None = None
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            raw = msg.get("content", "")
            if role == "system":
                system = raw if isinstance(raw, str) else str(raw)
                continue
            vertex_role = "user" if role == "user" else "model"
            if isinstance(raw, str):
                parts = [Part.from_text(raw)]
            elif isinstance(raw, list):
                # Multimodal: OpenAI-style [{type: text/image_url, ...}]
                parts = []
                for item in raw:
                    if item.get("type") == "text":
                        parts.append(Part.from_text(item["text"]))
                    elif item.get("type") == "image_url":
                        url: str = item["image_url"]["url"]
                        if url.startswith("data:"):
                            header, b64data = url.split(",", 1)
                            mime_type = header.split(":")[1].split(";")[0]
                            import base64 as _b64
                            raw_bytes = _b64.b64decode(b64data)
                            parts.append(Part.from_data(data=raw_bytes, mime_type=mime_type))
            else:
                parts = [Part.from_text(str(raw))]
            if parts:
                contents.append(Content(role=vertex_role, parts=parts))
        return system, contents

    async def complete(self, kwargs: dict[str, Any]) -> str:
        from vertexai.generative_models import GenerationConfig
        system, contents = self._to_contents(kwargs.get("messages", []))
        model = self._GenerativeModel(self.chat_model, system_instruction=system)
        cfg = GenerationConfig(
            temperature=kwargs.get("temperature", 0.7),
            max_output_tokens=kwargs.get("max_tokens", 4096),
        )
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: model.generate_content(contents, generation_config=cfg),
        )
        return response.text or ""

    async def stream(self, kwargs: dict[str, Any]) -> AsyncGenerator[str, None]:
        from vertexai.generative_models import GenerationConfig
        system, contents = self._to_contents(kwargs.get("messages", []))
        model = self._GenerativeModel(self.chat_model, system_instruction=system)
        cfg = GenerationConfig(
            temperature=kwargs.get("temperature", 0.7),
            max_output_tokens=kwargs.get("max_tokens", 4096),
        )
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _sync() -> None:
            try:
                for chunk in model.generate_content(contents, generation_config=cfg, stream=True):
                    if chunk.text:
                        loop.call_soon_threadsafe(queue.put_nowait, chunk.text)
            except Exception as exc:
                logger.error(f"Gemini stream error: {exc}")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        loop.run_in_executor(None, _sync)
        while True:
            token = await queue.get()
            if token is None:
                break
            yield token

    async def chat(self, messages: list[dict], **kwargs) -> str:
        """Convenience alias used in test scripts and direct callers."""
        return await self.complete({"messages": messages, **kwargs})

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel
        if not texts:
            return []
        task = "RETRIEVAL_DOCUMENT" if input_type == "passage" else "RETRIEVAL_QUERY"
        embed_model = TextEmbeddingModel.from_pretrained(self.embed_model)
        inputs = [TextEmbeddingInput(text=t, task_type=task) for t in texts]
        all_embeddings: list[list[float]] = []
        batch_size = 250  # Vertex AI allows up to 250 inputs per request
        for i in range(0, len(inputs), batch_size):
            batch = inputs[i: i + batch_size]
            resp = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda b=batch: embed_model.get_embeddings(b),
            )
            all_embeddings.extend(e.values for e in resp)
        return all_embeddings


# ─── Service facade ───────────────────────────────────────────────────────────

class AIService:
    def __init__(self):
        provider = settings.AI_PROVIDER.lower()
        if provider in ("gemini_vertex", "gemini", "claude_vertex"):
            self.provider: BaseAIProvider = GeminiVertexProvider()
        elif provider == "bedrock":
            self.provider = BedrockAIProvider()
        elif provider == "nvidia":
            self.provider = NvidiaAIProvider()
        elif provider == "ollama":
            self.provider = OllamaProvider()
        else:
            self.provider = OpenAICompatProvider()
        self.chat_model = self.provider.chat_model
        self.embed_model = self.provider.embed_model
        logger.info(f"AIService initialised — provider={provider} chat={self.chat_model} embed={self.embed_model}")

    async def chat_completion(
        self,
        messages: list[dict],
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str | AsyncGenerator[str, None]:
        kwargs = {
            "model": self.chat_model,
            "messages": messages,
            "temperature": temperature,
            "top_p": 0.95,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if stream:
            return self.provider.stream(kwargs)
        return await self.provider.complete(kwargs)

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        return await self.provider.embed_texts(texts, input_type)

    async def rewrite_query(self, query: str, chat_history: list[dict]) -> str:
        recent = chat_history[-6:] if len(chat_history) > 6 else chat_history
        history_str = "\n".join(f"{m['role'].upper()}: {m['content'][:200]}" for m in recent)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a query optimizer for an educational search engine. "
                    "Rewrite the user's question as a clear, standalone, search-optimized query "
                    "that captures the full intent — even if the original question references prior conversation. "
                    "Return ONLY the rewritten query, nothing else. No explanation, no punctuation at the end."
                ),
            },
            {
                "role": "user",
                "content": f"Conversation history:\n{history_str}\n\nCurrent question: {query}\n\nRewritten standalone query:",
            },
        ]
        result = await self.provider.complete(
            {"model": self.chat_model, "messages": messages, "temperature": 0.3, "max_tokens": 256, "stream": False}
        )
        return result.strip() or query

    async def generate_structured_json(
        self, prompt: str, schema_description: str, max_tokens: int = 8192
    ) -> dict | list:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a JSON generation assistant. You must respond with ONLY valid JSON — "
                    "no explanation, no markdown code blocks, no backticks. "
                    f"The JSON must match this schema: {schema_description}. "
                    "Start your response with { or [ immediately."
                ),
            },
            {"role": "user", "content": prompt},
        ]
        for attempt in range(3):
            try:
                raw = await self.provider.complete(
                    {"model": self.chat_model, "messages": messages, "temperature": 0.1, "max_tokens": max_tokens, "stream": False}
                )
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
                messages.append(
                    {"role": "user", "content": "Your previous response was not valid JSON. Please try again and return ONLY the JSON."}
                )
        return {}

    async def moderate_content(self, text: str) -> bool:
        messages = [
            {"role": "system", "content": "You are a content moderation assistant for an educational platform. Respond with ONLY 'safe' or 'unsafe'."},
            {"role": "user", "content": f"Is this text appropriate for students? Text: {text[:500]}"},
        ]
        try:
            result = await self.provider.complete(
                {"model": self.chat_model, "messages": messages, "temperature": 0.0, "max_tokens": 20, "stream": False}
            )
            raw = result.strip().upper()
            if "UNSAFE" in raw:
                return False
            return True
        except Exception:
            return True

    async def describe_image(
        self,
        image_b64: str,
        media_type: str = "image/jpeg",
        prompt: str = "Describe this image in detail.",
    ) -> str:
        """Send a base64-encoded image to the vision model and return a text description."""
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_b64}",
                            "detail": "high",
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        response = await self.chat_completion(
            messages=messages,
            stream=False,
            temperature=0.1,
            max_tokens=1000,
        )
        return response.strip() if isinstance(response, str) else ""


ai_service = AIService()
