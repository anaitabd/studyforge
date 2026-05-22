import asyncio
import json
import logging
from typing import Any, AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Gemini on Vertex AI ─────────────────────────────────────────────────────

class GeminiVertexProvider:
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
    """Claude Sonnet via Vertex AI. Embeddings delegated to GeminiVertexProvider."""

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
        if provider == "claude_vertex":
            self.provider = ClaudeVertexProvider()
        else:
            self.provider = GeminiVertexProvider()
            provider = "gemini"
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
        if stream:
            return self.provider.stream(messages, max_tokens=max_tokens)
        return await self.provider.chat(messages, max_tokens=max_tokens)

    async def embed_texts(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        return await self.provider.embed(texts)

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
        result = await self.provider.chat(messages, max_tokens=256)
        return result.strip() or query

    async def generate_structured_json(
        self, prompt: str, schema_description: str, max_tokens: int = 8192
    ) -> dict | list:
        return await self.provider.generate_structured_json(prompt, schema_description)

    async def moderate_content(self, text: str) -> bool:
        messages = [
            {"role": "system", "content": "You are a content moderation assistant for an educational platform. Respond with ONLY 'safe' or 'unsafe'."},
            {"role": "user", "content": f"Is this text appropriate for students? Text: {text[:500]}"},
        ]
        try:
            result = await self.provider.chat(messages, max_tokens=20)
            if "UNSAFE" in result.strip().upper():
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
        response = await self.chat_completion(messages=messages, stream=False, temperature=0.1, max_tokens=1000)
        return response.strip() if isinstance(response, str) else ""


ai_service = AIService()
