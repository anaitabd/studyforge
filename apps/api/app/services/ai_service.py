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

class GeminiVertexProvider:
    """Gemini 2.5 Flash via Vertex AI — uses Application Default Credentials.

    On Cloud Run: ADC is automatic.
    Locally: run `gcloud auth application-default login` once.
    """

    def __init__(self, cfg=None) -> None:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        from app.core.config import settings as _s
        s = cfg or _s
        vertexai.init(project=s.GCP_PROJECT_ID or None, location=s.GCP_LOCATION)
        self.chat_model_name = s.GEMINI_CHAT_MODEL
        self.embed_model_name = s.GEMINI_EMBED_MODEL
        self.chat_model = self.chat_model_name
        self.embed_model = self.embed_model_name
        self.GenerativeModel = GenerativeModel

    def _format(self, messages: list[dict]) -> tuple[str, list]:
        """Convert OpenAI-style messages → (system_instruction, vertex_contents)."""
        import base64 as _b64
        from vertexai.generative_models import Content, Part
        system = ""
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
                parts = []
                for item in raw:
                    if item.get("type") == "text":
                        parts.append(Part.from_text(item["text"]))
                    elif item.get("type") == "image_url":
                        url: str = item["image_url"]["url"]
                        if url.startswith("data:"):
                            header, b64data = url.split(",", 1)
                            mime_type = header.split(":")[1].split(";")[0]
                            raw_bytes = _b64.b64decode(b64data)
                            parts.append(Part.from_data(data=raw_bytes, mime_type=mime_type))
            else:
                parts = [Part.from_text(str(raw))]
            if parts:
                contents.append(Content(role=vertex_role, parts=parts))
        return system, contents

    async def chat(self, messages: list[dict], system: str = "", max_tokens: int = 2000) -> str:
        from vertexai.generative_models import GenerationConfig
        sys_from_msgs, contents = self._format(messages)
        system_instruction = system or sys_from_msgs or None
        model = self.GenerativeModel(self.chat_model_name, system_instruction=system_instruction)
        cfg = GenerationConfig(max_output_tokens=max_tokens)
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: model.generate_content(contents, generation_config=cfg),
        )
        return response.text or ""

    async def stream(self, messages: list[dict], system: str = "", max_tokens: int = 2000) -> AsyncGenerator[str, None]:
        from vertexai.generative_models import GenerationConfig
        sys_from_msgs, contents = self._format(messages)
        system_instruction = system or sys_from_msgs or None
        model = self.GenerativeModel(self.chat_model_name, system_instruction=system_instruction)
        cfg = GenerationConfig(max_output_tokens=max_tokens)
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

    async def embed(self, texts: list[str]) -> list[list[float]]:
        from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel
        if not texts:
            return []
        embed_model = TextEmbeddingModel.from_pretrained(self.embed_model_name)
        inputs = [TextEmbeddingInput(text=t, task_type="RETRIEVAL_DOCUMENT") for t in texts]
        all_embeddings: list[list[float]] = []
        for i in range(0, len(inputs), 250):
            batch = inputs[i: i + 250]
            resp = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda b=batch: embed_model.get_embeddings(b),
            )
            all_embeddings.extend(e.values for e in resp)
        return all_embeddings

    async def generate_structured_json(
        self, prompt: str, schema_description: str, image_b64: str | None = None
    ) -> dict | list:
        import base64 as _b64
        from vertexai.generative_models import GenerationConfig, Part
        parts = []
        if image_b64:
            raw_bytes = _b64.b64decode(image_b64)
            parts.append(Part.from_data(data=raw_bytes, mime_type="image/jpeg"))
        parts.append(Part.from_text(
            f"Return ONLY valid JSON matching: {schema_description}\n\n{prompt}"
        ))
        model = self.GenerativeModel(self.chat_model_name)
        cfg = GenerationConfig(max_output_tokens=4096, temperature=0.1)
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: model.generate_content(parts, generation_config=cfg),
        )
        raw = (response.text or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)


# ─── Claude on Vertex AI ─────────────────────────────────────────────────────

class ClaudeVertexProvider:
    """Claude Sonnet via Vertex AI — uses Application Default Credentials.

    Embeddings are delegated to GeminiVertexProvider (Claude has no embedding API).
    """

    def __init__(self, cfg=None) -> None:
        from anthropic import AnthropicVertex
        from app.core.config import settings as _s
        s = cfg or _s
        self.client = AnthropicVertex(region="global", project_id=s.GCP_PROJECT_ID)
        self.chat_model = "claude-sonnet-4-5@20250929"
        self.chat_model_name = self.chat_model
        self._embed_provider = GeminiVertexProvider(s)
        self.embed_model = self._embed_provider.embed_model_name
        self.embed_model_name = self.embed_model

    def _convert_content(self, content: Any) -> Any:
        """Convert OpenAI-style content blocks to Anthropic format."""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            blocks = []
            for item in content:
                if item.get("type") == "text":
                    blocks.append({"type": "text", "text": item["text"]})
                elif item.get("type") == "image_url":
                    url: str = item["image_url"]["url"]
                    if url.startswith("data:"):
                        header, b64data = url.split(",", 1)
                        mime_type = header.split(":")[1].split(";")[0]
                        blocks.append({
                            "type": "image",
                            "source": {"type": "base64", "media_type": mime_type, "data": b64data},
                        })
            return blocks
        return str(content)

    async def chat(self, messages: list[dict], system: str = "", max_tokens: int = 2000) -> str:
        anthropic_msgs = [
            {"role": m["role"], "content": self._convert_content(m["content"])}
            for m in messages if m["role"] != "system"
        ]
        sys_text = system or next((m["content"] for m in messages if m["role"] == "system"), "")
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.messages.create(
                model=self.chat_model,
                max_tokens=max_tokens,
                system=sys_text or "You are a helpful AI assistant.",
                messages=anthropic_msgs,
            ),
        )
        return response.content[0].text if response.content else ""

    async def stream(self, messages: list[dict], system: str = "", max_tokens: int = 2000) -> AsyncGenerator[str, None]:
        anthropic_msgs = [
            {"role": m["role"], "content": self._convert_content(m["content"])}
            for m in messages if m["role"] != "system"
        ]
        sys_text = system or next((m["content"] for m in messages if m["role"] == "system"), "")
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _sync() -> None:
            try:
                with self.client.messages.stream(
                    model=self.chat_model,
                    max_tokens=max_tokens,
                    system=sys_text or "You are a helpful AI assistant.",
                    messages=anthropic_msgs,
                ) as s:
                    for text in s.text_stream:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:
                logger.error(f"Claude Vertex stream error: {exc}")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        loop.run_in_executor(None, _sync)
        while True:
            token = await queue.get()
            if token is None:
                break
            yield token

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return await self._embed_provider.embed(texts)

    async def generate_structured_json(
        self, prompt: str, schema_description: str, image_b64: str | None = None
    ) -> dict | list:
        content: list[dict] = []
        if image_b64:
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64},
            })
        content.append({
            "type": "text",
            "text": f"Return ONLY valid JSON matching: {schema_description}\n\n{prompt}",
        })
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.messages.create(
                model=self.chat_model,
                max_tokens=4096,
                system="Return ONLY valid JSON. No explanation, no markdown.",
                messages=[{"role": "user", "content": content}],
            ),
        )
        raw = (response.content[0].text if response.content else "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)


# ─── Service facade ───────────────────────────────────────────────────────────

class AIService:
    def __init__(self):
        provider = settings.AI_PROVIDER.lower()
        if provider == "gemini":
            self.provider = GeminiVertexProvider()
            self._is_gcp = True
        elif provider == "claude_vertex":
            self.provider = ClaudeVertexProvider()
            self._is_gcp = True
        elif provider == "gemini_vertex":
            self.provider = GeminiVertexProvider()
            self._is_gcp = True
        elif provider == "bedrock":
            self.provider = BedrockAIProvider()
            self._is_gcp = False
        elif provider == "nvidia":
            self.provider = NvidiaAIProvider()
            self._is_gcp = False
        elif provider == "ollama":
            self.provider = OllamaProvider()
            self._is_gcp = False
        else:
            self.provider = OpenAICompatProvider()
            self._is_gcp = False
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
        if self._is_gcp:
            if stream:
                return self.provider.stream(messages, max_tokens=max_tokens)
            return await self.provider.chat(messages, max_tokens=max_tokens)
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
        if self._is_gcp:
            return await self.provider.embed(texts)
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
        if self._is_gcp:
            result = await self.provider.chat(messages, max_tokens=256)
        else:
            result = await self.provider.complete(
                {"model": self.chat_model, "messages": messages, "temperature": 0.3, "max_tokens": 256, "stream": False}
            )
        return result.strip() or query

    async def generate_structured_json(
        self, prompt: str, schema_description: str, max_tokens: int = 8192
    ) -> dict | list:
        if self._is_gcp:
            return await self.provider.generate_structured_json(prompt, schema_description)
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
            if self._is_gcp:
                result = await self.provider.chat(messages, max_tokens=20)
            else:
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
